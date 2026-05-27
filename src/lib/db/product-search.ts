import { getSql } from "@/lib/db";
import { normalizeQuery } from "@/lib/slug";

export interface DbProductSuggestion {
  id: string;
  name: string;
  slug: string;
  barcode?: string;
  imageUrl?: string;
  sourceQuery: string;
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
