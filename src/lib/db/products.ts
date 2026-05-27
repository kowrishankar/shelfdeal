import { getSql } from "../db";
import { RETAILER_NAMES } from "../retailers/shared";
import { normalizeQuery, productSlug } from "../slug";
import { normalizeForMatch } from "../text-normalize";
import type { PriceLine, RetailerId, RetailerListing } from "../types";

export interface DbProduct {
  id: string;
  slug: string;
  canonicalName: string;
  barcode: string | null;
  imageUrl: string | null;
  sourceQuery: string;
}

export interface DbListingRow {
  id: string;
  retailerId: RetailerId;
  url: string;
  retailerProductName: string | null;
  imageUrl: string | null;
  lastSortPrice: number | null;
  lastPrices: PriceLine[] | null;
  lastFetchedAt: string | null;
}

export interface DiscoveredListing {
  retailerId: RetailerId;
  url: string;
  name: string;
  imageUrl?: string;
}

export async function findProductByQuery(
  query: string,
): Promise<DbProduct | null> {
  const sql = getSql();
  const normalized = normalizeQuery(query);

  const bySearch = await sql`
    SELECT p.id, p.slug, p.canonical_name, p.barcode, p.image_url, p.source_query
    FROM search_queries sq
    JOIN products p ON p.id = sq.product_id
    WHERE sq.query_normalized = ${normalized}
    LIMIT 1
  `;
  if (bySearch.length) return rowToProduct(bySearch[0]);

  const nameNeedle = normalizeForMatch(query);
  const byName = await sql`
    SELECT id, slug, canonical_name, barcode, image_url, source_query
    FROM products
    WHERE lower(canonical_name) LIKE ${"%" + nameNeedle + "%"}
    ORDER BY search_count DESC, updated_at DESC
    LIMIT 1
  `;
  if (byName.length) return rowToProduct(byName[0]);

  const byTrgm = await sql`
    SELECT id, slug, canonical_name, barcode, image_url, source_query
    FROM products
    WHERE canonical_name % ${query.trim()}
    ORDER BY similarity(canonical_name, ${query.trim()}) DESC
    LIMIT 1
  `;
  if (byTrgm.length) return rowToProduct(byTrgm[0]);

  return null;
}

export async function getProductById(id: string): Promise<DbProduct | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, slug, canonical_name, barcode, image_url, source_query
    FROM products WHERE id = ${id}::uuid LIMIT 1
  `;
  return rows.length ? rowToProduct(rows[0]) : null;
}

export async function getListingsForProduct(
  productId: string,
): Promise<DbListingRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, retailer_id, url, retailer_product_name, image_url,
           last_sort_price, last_prices, last_fetched_at
    FROM retailer_listings
    WHERE product_id = ${productId}::uuid
  `;
  return rows.map((r) => ({
    id: r.id as string,
    retailerId: r.retailer_id as RetailerId,
    url: r.url as string,
    retailerProductName: r.retailer_product_name as string | null,
    imageUrl: r.image_url as string | null,
    lastSortPrice: r.last_sort_price != null ? Number(r.last_sort_price) : null,
    lastPrices: r.last_prices as PriceLine[] | null,
    lastFetchedAt: r.last_fetched_at as string | null,
  }));
}

export async function upsertProductWithListings(
  query: string,
  canonicalName: string,
  listings: DiscoveredListing[],
  barcode?: string,
  imageUrl?: string,
): Promise<{ product: DbProduct; listings: DbListingRow[] }> {
  const sql = getSql();
  const normalized = normalizeQuery(query);
  const slug = productSlug(canonicalName, query);

  const existing = await sql`
    SELECT id FROM products WHERE slug = ${slug} LIMIT 1
  `;

  let productId: string;

  if (existing.length) {
    productId = existing[0].id as string;
    await sql`
      UPDATE products SET
        canonical_name = ${canonicalName},
        barcode = COALESCE(${barcode ?? null}, barcode),
        image_url = COALESCE(${imageUrl ?? null}, image_url),
        search_count = search_count + 1,
        updated_at = now()
      WHERE id = ${productId}::uuid
    `;
  } else {
    const inserted = await sql`
      INSERT INTO products (slug, canonical_name, barcode, image_url, source_query)
      VALUES (${slug}, ${canonicalName}, ${barcode ?? null}, ${imageUrl ?? null}, ${query.trim()})
      RETURNING id
    `;
    productId = inserted[0].id as string;
  }

  await sql`
    INSERT INTO search_queries (query_normalized, product_id, hit_count, last_searched_at)
    VALUES (${normalized}, ${productId}::uuid, 1, now())
    ON CONFLICT (query_normalized) DO UPDATE SET
      product_id = EXCLUDED.product_id,
      hit_count = search_queries.hit_count + 1,
      last_searched_at = now()
  `;

  for (const listing of listings) {
    await sql`
      INSERT INTO retailer_listings (product_id, retailer_id, url, retailer_product_name, image_url)
      VALUES (
        ${productId}::uuid,
        ${listing.retailerId},
        ${listing.url},
        ${listing.name},
        ${listing.imageUrl ?? null}
      )
      ON CONFLICT (product_id, retailer_id) DO UPDATE SET
        url = EXCLUDED.url,
        retailer_product_name = EXCLUDED.retailer_product_name,
        image_url = COALESCE(EXCLUDED.image_url, retailer_listings.image_url),
        updated_at = now()
    `;
  }

  const product = await getProductById(productId);
  const dbListings = await getListingsForProduct(productId);
  if (!product) throw new Error("Failed to load product after upsert");
  return { product, listings: dbListings };
}

export async function saveListingPrice(
  listingId: string,
  listing: RetailerListing,
): Promise<void> {
  if (!listing.prices.length) return;
  const sql = getSql();

  await sql`
    UPDATE retailer_listings SET
      last_sort_price = ${listing.sortPrice},
      last_prices = ${JSON.stringify(listing.prices)}::jsonb,
      last_fetched_at = ${listing.fetchedAt}::timestamptz,
      retailer_product_name = COALESCE(${listing.productName}, retailer_product_name),
      image_url = COALESCE(${listing.imageUrl ?? null}, image_url),
      updated_at = now()
    WHERE id = ${listingId}::uuid
  `;

  await sql`
    INSERT INTO price_snapshots (listing_id, sort_price, prices, in_stock, fetched_at)
    VALUES (
      ${listingId}::uuid,
      ${listing.sortPrice},
      ${JSON.stringify(listing.prices)}::jsonb,
      ${listing.inStock},
      ${listing.fetchedAt}::timestamptz
    )
  `;
}

export async function getPriceHistory(
  productId: string,
  limit = 30,
): Promise<
  { retailerId: string; sortPrice: number; fetchedAt: string }[]
> {
  const sql = getSql();
  const rows = await sql`
    SELECT rl.retailer_id, ps.sort_price, ps.fetched_at
    FROM price_snapshots ps
    JOIN retailer_listings rl ON rl.id = ps.listing_id
    WHERE rl.product_id = ${productId}::uuid
    ORDER BY ps.fetched_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    retailerId: r.retailer_id as string,
    sortPrice: Number(r.sort_price),
    fetchedAt: r.fetched_at as string,
  }));
}

function rowToProduct(row: Record<string, unknown>): DbProduct {
  return {
    id: row.id as string,
    slug: row.slug as string,
    canonicalName: row.canonical_name as string,
    barcode: (row.barcode as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    sourceQuery: row.source_query as string,
  };
}

export function listingRowToRetailerListing(
  row: DbListingRow,
  productName: string,
): RetailerListing | null {
  if (!row.lastPrices?.length || row.lastSortPrice == null) return null;
  return {
    retailerId: row.retailerId,
    retailerName: RETAILER_NAMES[row.retailerId] ?? row.retailerId,
    productName: row.retailerProductName ?? productName,
    url: row.url,
    imageUrl: row.imageUrl ?? undefined,
    inStock: true,
    prices: row.lastPrices,
    sortPrice: row.lastSortPrice,
    fetchedAt: row.lastFetchedAt ?? new Date().toISOString(),
  };
}
