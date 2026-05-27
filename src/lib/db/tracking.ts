import { getSql } from "../db";
import { getListingsForProduct } from "./products";

export interface TrackedProduct {
  productId: string;
  productName: string;
  trackedAt: string;
  currentLowest: number | null;
  previousLowest: number | null;
  priceChange: number | null;
  opportunityScore: number | null;
  trendDirection: string | null;
}

export async function trackProduct(
  userId: string,
  productId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO user_tracked_products (user_id, product_id)
    VALUES (${userId}::uuid, ${productId}::uuid)
    ON CONFLICT (user_id, product_id) DO NOTHING
  `;
}

export async function untrackProduct(
  userId: string,
  productId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM user_tracked_products
    WHERE user_id = ${userId}::uuid AND product_id = ${productId}::uuid
  `;
}

export async function isProductTracked(
  userId: string,
  productId: string,
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM user_tracked_products
    WHERE user_id = ${userId}::uuid AND product_id = ${productId}::uuid
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function getTrackedProducts(
  userId: string,
): Promise<TrackedProduct[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      p.id AS product_id,
      p.canonical_name,
      t.tracked_at,
      pi.opportunity_score,
      pi.trend_direction
    FROM user_tracked_products t
    JOIN products p ON p.id = t.product_id
    LEFT JOIN product_intelligence pi ON pi.product_id = p.id
    WHERE t.user_id = ${userId}::uuid
    ORDER BY t.tracked_at DESC
  `;

  const results: TrackedProduct[] = [];

  for (const row of rows) {
    const productId = row.product_id as string;
    const listings = await getListingsForProduct(productId);
    const prices = listings
      .map((l) => l.lastSortPrice)
      .filter((p): p is number => p != null);

    const currentLowest = prices.length ? Math.min(...prices) : null;

    const historyRows = await sql`
      SELECT ps.sort_price
      FROM price_snapshots ps
      JOIN retailer_listings rl ON rl.id = ps.listing_id
      WHERE rl.product_id = ${productId}::uuid
      ORDER BY ps.fetched_at DESC
      LIMIT 20
    `;
    const histPrices = historyRows.map((h) => Number(h.sort_price));
    const previousLowest =
      histPrices.length > 1 ? Math.min(...histPrices.slice(5)) : null;

    const priceChange =
      currentLowest != null && previousLowest != null
        ? currentLowest - previousLowest
        : null;

    results.push({
      productId,
      productName: row.canonical_name as string,
      trackedAt: row.tracked_at as string,
      currentLowest,
      previousLowest,
      priceChange,
      opportunityScore:
        row.opportunity_score != null ? Number(row.opportunity_score) : null,
      trendDirection: (row.trend_direction as string) ?? null,
    });
  }

  return results;
}
