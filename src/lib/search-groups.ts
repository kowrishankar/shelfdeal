import { createHash } from "crypto";
import { getCanonicalGroupsFromDb } from "@/lib/db/product-search";
import {
  buildVariantSearchQuery,
  extractPackInfo,
  productLineKey,
  scoreProductMatch,
  variantGroupKey,
} from "@/lib/product-matching";
import {
  buildProductVariantsFromHits,
  type ProductVariantOption,
} from "@/lib/variants";
import { discoverAcrossRetailers } from "@/lib/retailers/search";
import { decodeHtmlEntities, normalizeForMatch } from "@/lib/text-normalize";
import type { RetailerSearchHit } from "@/lib/retailers/search/types";

export interface ProductFamilyGroup {
  id: string;
  /** Family display name (e.g. Johnnie Walker Red Label) */
  label: string;
  imageUrl?: string;
  retailerCount: number;
  variants: ProductVariantOption[];
}

export interface GroupedSearchResult {
  query: string;
  groups: ProductFamilyGroup[];
  other: ProductVariantOption[];
  /** Raw hit counts per retailer from the latest discover scrape */
  retailerHits: Partial<Record<string, number>>;
}

function familyId(key: string): string {
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

function hitToVariantOption(
  query: string,
  hit: RetailerSearchHit,
  score: number,
): ProductVariantOption {
  const packLabel = hit.packLabel ?? extractPackInfo(hit.name).packLabel;
  const key = variantGroupKey(hit.name, hit.packLabel);
  return {
    id: createHash("sha256").update(key).digest("hex").slice(0, 16),
    label: buildDisplayLabel(hit.name, packLabel),
    searchQuery: buildVariantSearchQuery(hit.name, packLabel),
    packLabel,
    imageUrl: hit.imageUrl,
    retailerCount: 1,
    score,
    confidence: score >= 65 ? "high" : score >= 40 ? "medium" : "low",
    listings: [hit],
  };
}

function clusterVariantsIntoFamilies(
  query: string,
  variants: ProductVariantOption[],
): { groups: ProductFamilyGroup[]; other: ProductVariantOption[] } {
  const byLine = new Map<string, ProductVariantOption[]>();

  for (const v of variants) {
    const key = productLineKey(query, v.label);
    const list = byLine.get(key) ?? [];
    list.push(v);
    byLine.set(key, list);
  }

  const groups: ProductFamilyGroup[] = [];
  const other: ProductVariantOption[] = [];

  for (const [lineKey, members] of byLine) {
    const sorted = [...members].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const totalRetailers = new Set(
      sorted.flatMap((m) => m.listings.map((l) => l.retailerId)),
    ).size;

    if (sorted.length >= 2 || best.score >= 45) {
      const label =
        sorted.length === 1
          ? best.label
          : familyLabelFromVariants(query, sorted);
      groups.push({
        id: familyId(lineKey),
        label,
        imageUrl:
          sorted.find((v) => v.imageUrl)?.imageUrl ?? best.imageUrl,
        retailerCount: totalRetailers,
        variants: sorted,
      });
    } else if (best.score >= 28) {
      groups.push({
        id: familyId(lineKey),
        label: best.label,
        imageUrl: best.imageUrl,
        retailerCount: best.retailerCount,
        variants: sorted,
      });
    } else {
      other.push(...sorted);
    }
  }

  groups.sort((a, b) => {
    const scoreA = Math.max(...a.variants.map((v) => v.score));
    const scoreB = Math.max(...b.variants.map((v) => v.score));
    return scoreB - scoreA;
  });
  other.sort((a, b) => b.score - a.score);

  return { groups, other };
}

function familyLabelFromVariants(
  query: string,
  variants: ProductVariantOption[],
): string {
  const labels = variants.map((v) => v.label);
  const first = labels[0] ?? query;

  const lineKey = productLineKey(query, first);
  if (!lineKey.startsWith("solo-")) {
    const phrase = lineKey.replace(/-/g, " ");
    const withBrand = labels.find((l) =>
      l.toLowerCase().includes(phrase.toLowerCase()),
    );
    if (withBrand) {
      const shortened = withBrand
        .replace(/\s*\d+\s*(?:ml|cl|l)\b/gi, "")
        .replace(/\s*\(.*\)\s*$/, "")
        .trim();
      if (shortened.length >= 4) return shortened;
    }
    return phrase
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  const common = longestCommonWordPrefix(labels);
  if (common.length >= 8) return common.trim();

  return first
    .replace(/\s*\d+\s*(?:ml|cl|l)\b/gi, "")
    .replace(/\s*\(.*\)\s*$/, "")
    .trim();
}

function longestCommonWordPrefix(labels: string[]): string {
  if (!labels.length) return "";
  const wordLists = labels.map((l) =>
    l.toLowerCase().split(/\s+/).filter(Boolean),
  );
  const first = wordLists[0];
  const shared: string[] = [];
  for (let i = 0; i < first.length; i++) {
    const w = first[i];
    if (wordLists.every((wl) => wl[i] === w)) shared.push(w);
    else break;
  }
  return shared.join(" ");
}

function otherHitsFromScored(
  query: string,
  hits: RetailerSearchHit[],
  usedListingUrls: Set<string>,
): ProductVariantOption[] {
  const other: ProductVariantOption[] = [];

  for (const hit of hits) {
    if (usedListingUrls.has(hit.url)) continue;
    const score = scoreProductMatch(query, hit.name, hit.packLabel);
    if (score < 12 || score >= 20) continue;
    other.push(hitToVariantOption(query, hit, score));
    usedListingUrls.add(hit.url);
  }

  return other.sort((a, b) => b.score - a.score);
}

export async function discoverGroupedSearch(
  query: string,
): Promise<GroupedSearchResult> {
  const trimmed = query.trim();
  const canonicalGroups = process.env.DATABASE_URL
    ? await getCanonicalGroupsFromDb(trimmed).catch(() => [])
    : [];

  const hits = await discoverAcrossRetailers(trimmed);
  const retailerHits: Partial<Record<string, number>> = {};
  for (const h of hits) {
    retailerHits[h.retailerId] = (retailerHits[h.retailerId] ?? 0) + 1;
  }
  const variants = buildProductVariantsFromHits(trimmed, hits, { limit: null });
  const usedUrls = new Set(
    variants.flatMap((v) => v.listings.map((l) => l.url)),
  );

  const { groups, other: weakVariants } = clusterVariantsIntoFamilies(
    trimmed,
    variants,
  );

  const mergedGroupsByKey = new Map<string, ProductFamilyGroup>();
  for (const g of [...canonicalGroups, ...groups]) {
    const key = normalizeForMatch(g.label);
    const existing = mergedGroupsByKey.get(key);
    if (!existing) {
      mergedGroupsByKey.set(key, g);
      continue;
    }
    const byVariant = new Map<string, ProductVariantOption>();
    for (const v of [...existing.variants, ...g.variants]) {
      const vKey = normalizeForMatch(`${v.label}|${v.packLabel}`);
      const prev = byVariant.get(vKey);
      if (!prev || v.score > prev.score) byVariant.set(vKey, v);
    }
    const mergedVariants = [...byVariant.values()].sort((a, b) => b.score - a.score);
    const retailerCount = new Set(
      mergedVariants.flatMap((v) => v.listings.map((l) => l.retailerId)),
    ).size;
    mergedGroupsByKey.set(key, {
      id: existing.id,
      label: existing.label.length >= g.label.length ? existing.label : g.label,
      imageUrl: existing.imageUrl ?? g.imageUrl,
      retailerCount: Math.max(existing.retailerCount, g.retailerCount, retailerCount),
      variants: mergedVariants,
    });
  }
  const mergedGroups = [...mergedGroupsByKey.values()].sort((a, b) => {
    const scoreA = Math.max(...a.variants.map((v) => v.score));
    const scoreB = Math.max(...b.variants.map((v) => v.score));
    return scoreB - scoreA;
  });

  const orphanHits = otherHitsFromScored(trimmed, hits, usedUrls);

  const otherById = new Map<string, ProductVariantOption>();
  for (const v of [...weakVariants, ...orphanHits]) {
    if (!otherById.has(v.id)) otherById.set(v.id, v);
  }
  const other = [...otherById.values()].sort((a, b) => b.score - a.score);

  return {
    query: trimmed,
    groups: mergedGroups,
    other,
    retailerHits,
  };
}
