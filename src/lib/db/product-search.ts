import { getSql } from "@/lib/db";
import { buildVariantSearchQuery } from "@/lib/product-matching";
import type { RetailerSearchHit } from "@/lib/retailers/search/types";
import { normalizeQuery } from "@/lib/slug";
import { normalizeForMatch } from "@/lib/text-normalize";
import { createHash } from "crypto";

export interface DbProductSuggestion {
  id: string;
  name: string;
  slug: string;
  barcode?: string;
  imageUrl?: string;
  sourceQuery: string;
}

export interface DbCanonicalVariantSuggestion {
  id: string;
  label: string;
  searchQuery: string;
  packLabel: string;
  imageUrl?: string;
  retailerCount: number;
  score: number;
  confidence: "high" | "medium" | "low";
  listings: RetailerSearchHit[];
}

export interface DbCanonicalFamilySuggestion {
  id: string;
  label: string;
  imageUrl?: string;
  retailerCount: number;
  variants: DbCanonicalVariantSuggestion[];
}

function mapProductRow(row: Record<string, unknown>): DbProductSuggestion {
  return {
    id: row.id as string,
    name: row.canonical_name as string,
    slug: row.slug as string,
    barcode: (row.barcode as string | null) ?? undefined,
    imageUrl: (row.image_url as string | null) ?? undefined,
    sourceQuery: row.source_query as string,
  };
}

export async function findProductsByBarcode(
  barcode: string,
): Promise<DbProductSuggestion[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, slug, canonical_name, barcode, image_url, source_query
    FROM products WHERE barcode = ${barcode}
    ORDER BY search_count DESC LIMIT 8
  `;
  return rows.map(mapProductRow);
}

export async function findProductsByQuery(
  query: string,
): Promise<DbProductSuggestion[]> {
  const sql = getSql();
  const normalized = normalizeQuery(query);
  const trimmed = query.trim();

  const bySearch = await sql`
    SELECT p.id, p.slug, p.canonical_name, p.barcode, p.image_url, p.source_query
    FROM search_queries sq
    JOIN products p ON p.id = sq.product_id
    WHERE sq.query_normalized = ${normalized}
    LIMIT 8
  `;
  if (bySearch.length) return bySearch.map(mapProductRow);

  const byName = await sql`
    SELECT id, slug, canonical_name, barcode, image_url, source_query
    FROM products
    WHERE canonical_name ILIKE ${"%" + trimmed + "%"}
    ORDER BY search_count DESC LIMIT 8
  `;
  if (byName.length) return byName.map(mapProductRow);

  const byTrgm = await sql`
    SELECT id, slug, canonical_name, barcode, image_url, source_query
    FROM products
    WHERE canonical_name % ${trimmed}
    ORDER BY similarity(canonical_name, ${trimmed}) DESC
    LIMIT 8
  `;
  return byTrgm.map(mapProductRow);
}

export async function suggestProductsFromDb(
  query: string,
): Promise<DbProductSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const isBarcode = /^\d{8,14}$/.test(trimmed.replace(/\s/g, ""));
  if (isBarcode) {
    return findProductsByBarcode(trimmed.replace(/\s/g, ""));
  }
  return findProductsByQuery(trimmed);
}

function stableId(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function confidenceFromScore(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export async function getCanonicalGroupsFromDb(
  query: string,
): Promise<DbCanonicalFamilySuggestion[]> {
  const sql = getSql();
  const candidates = await findProductsByQuery(query);
  if (!candidates.length) return [];

  const familyMap = new Map<
    string,
    {
      id: string;
      label: string;
      imageUrl?: string;
      variants: Map<
        string,
        {
          id: string;
          label: string;
          packLabel: string;
          searchQuery: string;
          imageUrl?: string;
          confidenceScoreSum: number;
          confidenceCount: number;
          listingsByRetailer: Map<string, RetailerSearchHit>;
        }
      >;
    }
  >();

  for (const product of candidates.slice(0, 6)) {
    const rows = await sql`
      SELECT
        pf.id AS family_id,
        pf.name AS family_name,
        b.name AS brand_name,
        pv.id AS variant_id,
        pv.name AS variant_name,
        pv.flavor AS flavor,
        pv.size_ml AS size_ml,
        pk.id AS pack_id,
        pk.pack_count AS pack_count,
        pk.is_multipack AS is_multipack,
        rl.retailer_id AS retailer_id,
        rl.url AS url,
        rl.retailer_product_name AS retailer_product_name,
        rl.image_url AS image_url,
        lml.confidence_score AS confidence_score
      FROM retailer_listings rl
      JOIN listing_match_links lml ON lml.listing_id = rl.id
      JOIN pack_variants pk ON pk.id = lml.pack_variant_id
      JOIN product_variants pv ON pv.id = pk.product_variant_id
      JOIN product_families pf ON pf.id = pv.family_id
      JOIN brands b ON b.id = pf.brand_id
      WHERE rl.product_id = ${product.id}::uuid
    `;

    for (const r of rows) {
      const familyId = r.family_id as string;
      const brandName = r.brand_name as string;
      const familyName = r.family_name as string;
      const variantName = (r.variant_name as string) || familyName;
      const sizeMl = (r.size_ml as number | null) ?? null;
      const packCount = Number(r.pack_count ?? 1);
      const isMultipack = Boolean(r.is_multipack);
      const flavor = (r.flavor as string | null) ?? null;
      const packLabel =
        isMultipack && packCount > 1 ? `${packCount} pack` : "Single unit";

      const fullVariantLabel = [
        variantName,
        sizeMl ? `${sizeMl}ml` : null,
        flavor && !normalizeForMatch(variantName).includes(normalizeForMatch(flavor))
          ? flavor
          : null,
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      const familyLabel = `${brandName} ${familyName}`.replace(/\s+/g, " ").trim();
      const variantKey = `${r.variant_id as string}:${r.pack_id as string}`;
      const confidenceScore = Number(r.confidence_score ?? 0);
      const imageUrl = (r.image_url as string | null) ?? undefined;

      let family = familyMap.get(familyId);
      if (!family) {
        family = {
          id: stableId(familyId),
          label: familyLabel,
          imageUrl,
          variants: new Map(),
        };
        familyMap.set(familyId, family);
      }
      if (!family.imageUrl && imageUrl) family.imageUrl = imageUrl;

      let variant = family.variants.get(variantKey);
      if (!variant) {
        variant = {
          id: stableId(variantKey),
          label: fullVariantLabel || variantName,
          packLabel,
          searchQuery: buildVariantSearchQuery(
            fullVariantLabel || variantName,
            packLabel,
          ),
          imageUrl,
          confidenceScoreSum: 0,
          confidenceCount: 0,
          listingsByRetailer: new Map(),
        };
        family.variants.set(variantKey, variant);
      }
      if (!variant.imageUrl && imageUrl) variant.imageUrl = imageUrl;
      variant.confidenceScoreSum += confidenceScore;
      variant.confidenceCount += 1;
      const retailerId = r.retailer_id as RetailerSearchHit["retailerId"];
      variant.listingsByRetailer.set(retailerId, {
        retailerId,
        url: r.url as string,
        name: (r.retailer_product_name as string | null) ?? variant.label,
        imageUrl,
        packLabel,
      });
    }
  }

  const groups: DbCanonicalFamilySuggestion[] = [...familyMap.values()]
    .map((family) => {
      const variants: DbCanonicalVariantSuggestion[] = [...family.variants.values()]
        .map((variant) => {
          const avgScore =
            variant.confidenceCount > 0
              ? variant.confidenceScoreSum / variant.confidenceCount
              : 0;
          const listings = [...variant.listingsByRetailer.values()];
          return {
            id: variant.id,
            label: variant.label,
            searchQuery: variant.searchQuery,
            packLabel: variant.packLabel,
            imageUrl: variant.imageUrl,
            retailerCount: listings.length,
            score: Math.round(avgScore),
            confidence: confidenceFromScore(avgScore),
            listings,
          };
        })
        .sort((a, b) => b.score - a.score);

      const retailerCount = new Set(
        variants.flatMap((v) => v.listings.map((l) => l.retailerId)),
      ).size;

      return {
        id: family.id,
        label: family.label,
        imageUrl:
          family.imageUrl ?? variants.find((v) => v.imageUrl)?.imageUrl,
        retailerCount,
        variants,
      };
    })
    .filter((g) => g.variants.length > 0)
    .sort((a, b) => {
      const scoreA = Math.max(...a.variants.map((v) => v.score));
      const scoreB = Math.max(...b.variants.map((v) => v.score));
      return scoreB - scoreA;
    });

  return groups;
}
