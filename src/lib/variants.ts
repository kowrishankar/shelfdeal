import { createHash } from "crypto";
import { discoverAcrossRetailers } from "./retailers/search";
import type { RetailerSearchHit } from "./retailers/search/types";
import {
  buildVariantSearchQuery,
  extractPackInfo,
  pickBestMatch,
  scoreProductMatch,
  variantGroupKey,
} from "./product-matching";
import { decodeHtmlEntities } from "./text-normalize";

export interface ProductVariantOption {
  id: string;
  /** Display label in the dropdown */
  label: string;
  /** Query sent to every retailer when this variant is selected */
  searchQuery: string;
  packLabel: string;
  imageUrl?: string;
  retailerCount: number;
  score: number;
  listings: RetailerSearchHit[];
}

function variantId(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function buildDisplayLabel(name: string, packLabel: string): string {
  const pack = extractPackInfo(`${name} ${packLabel}`);
  const clean = decodeHtmlEntities(name)
    .replace(/\s+PM\s*£[\d.]+/gi, "")
    .replace(/\s+\d+\s*Pack.*$/i, "")
    .replace(/\s*\|\s*[\d.]+%\s*vol.*$/i, "")
    .replace(/\s*-\s*.*$/, "")
    .trim();
  if (pack.isMultipack && pack.unitCount && pack.unitCount > 1) {
    return `${clean} (${pack.packLabel})`;
  }
  return clean;
}

export interface BuildVariantsOptions {
  /** Omit or set null to return all variants (discovery page). Default 12. */
  limit?: number | null;
}

export function buildProductVariantsFromHits(
  query: string,
  hits: RetailerSearchHit[],
  options?: BuildVariantsOptions,
): ProductVariantOption[] {
  if (!hits.length) return [];

  const scored = hits
    .map((h) => ({
      hit: h,
      score: scoreProductMatch(query, h.name, h.packLabel),
    }))
    .filter((s) => s.score >= 20);

  const groups = new Map<string, { hits: RetailerSearchHit[]; maxScore: number }>();

  for (const { hit, score } of scored) {
    const key = variantGroupKey(hit.name, hit.packLabel);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { hits: [hit], maxScore: score });
      continue;
    }
    const sameRetailer = existing.hits.find((h) => h.retailerId === hit.retailerId);
    if (sameRetailer) {
      const existingScore = scoreProductMatch(
        query,
        sameRetailer.name,
        sameRetailer.packLabel,
      );
      if (score > existingScore) {
        existing.hits = existing.hits.filter(
          (h) => h.retailerId !== hit.retailerId,
        );
        existing.hits.push(hit);
      }
    } else {
      existing.hits.push(hit);
    }
    existing.maxScore = Math.max(existing.maxScore, score);
  }

  const variants: ProductVariantOption[] = [];

  for (const [key, group] of groups) {
    const bestHit = pickBestMatch(query, group.hits) ?? group.hits[0];
    const packLabel =
      bestHit.packLabel ?? extractPackInfo(bestHit.name).packLabel;

    const listingsByRetailer = new Map<string, RetailerSearchHit>();
    for (const h of group.hits) {
      const prev = listingsByRetailer.get(h.retailerId);
      if (
        !prev ||
        scoreProductMatch(query, h.name, h.packLabel) >
          scoreProductMatch(query, prev.name, prev.packLabel)
      ) {
        listingsByRetailer.set(h.retailerId, h);
      }
    }

    const listings = [...listingsByRetailer.values()];
    if (!listings.length) continue;

    const label = buildDisplayLabel(bestHit.name, packLabel);
    const imageUrl =
      listings.find((l) => l.imageUrl)?.imageUrl ??
      bestHit.imageUrl ??
      listings.find((l) => l.retailerId === "amazon")?.imageUrl;
    variants.push({
      id: variantId(key),
      label,
      searchQuery: buildVariantSearchQuery(bestHit.name, packLabel),
      packLabel,
      imageUrl,
      retailerCount: listings.length,
      score: group.maxScore,
      listings,
    });
  }

  const ranked = variants.sort((a, b) => b.score - a.score);
  const limit = options?.limit === undefined ? 12 : options.limit;

  const classic = ranked.filter(
    (v) =>
      !/edition/i.test(v.label) &&
      !extractPackInfo(v.label).isMultipack &&
      v.retailerCount >= 1,
  );
  const ordered =
    classic.length > 0
      ? [...classic, ...ranked.filter((v) => !classic.includes(v))]
      : ranked;

  if (limit == null) return ordered;
  return ordered.slice(0, limit);
}

export async function discoverProductVariants(
  query: string,
): Promise<ProductVariantOption[]> {
  const hits = await discoverAcrossRetailers(query);
  return buildProductVariantsFromHits(query, hits);
}

export { decodeVariantSelection, encodeVariantSelection } from "./variant-selection";
