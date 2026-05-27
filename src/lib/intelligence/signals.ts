import { getSql } from "../db";
import { getListingsForProduct } from "../db/products";
import type { PriceLine } from "../types";
import { inferCategory } from "./category";
import type { MarketSignalSnapshot } from "./types";

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function extractRetailPrices(
  listings: Awaited<ReturnType<typeof getListingsForProduct>>,
): number[] {
  const prices: number[] = [];
  for (const row of listings) {
    if (!row.lastPrices?.length) continue;
    const unit = row.lastPrices.find(
      (p: PriceLine) => p.kind === "unit_inc_vat" || p.kind === "unit_ex_vat",
    );
    if (unit) {
      prices.push(unit.amount);
      continue;
    }
    const standard = row.lastPrices.find(
      (p: PriceLine) =>
        p.kind === "clubcard" || p.kind === "standard" || p.kind === "inc_vat",
    );
    if (standard) prices.push(standard.amount);
  }
  return prices;
}

function extractWholesaleCost(
  listings: Awaited<ReturnType<typeof getListingsForProduct>>,
): number | null {
  const booker = listings.find((l) => l.retailerId === "booker");
  if (!booker?.lastPrices?.length) return null;

  const unitEx = booker.lastPrices.find((p) => p.kind === "unit_ex_vat");
  const unitInc = booker.lastPrices.find((p) => p.kind === "unit_inc_vat");
  if (unitEx) return unitEx.amount;
  if (unitInc) return unitInc.amount;

  const exVat = booker.lastPrices.find((p) => p.kind === "ex_vat");
  return exVat?.amount ?? null;
}

function extractRrp(
  listings: Awaited<ReturnType<typeof getListingsForProduct>>,
): number | null {
  for (const row of listings) {
    const rrp = row.lastPrices?.find((p: PriceLine) => p.kind === "rrp");
    if (rrp) return rrp.amount;
  }
  return null;
}

export async function collectMarketSignals(
  productId: string,
  productName: string,
): Promise<MarketSignalSnapshot> {
  const sql = getSql();
  const category = inferCategory(productName);

  const [productRow, listings, searchStats, priceHistory] = await Promise.all([
    sql`
      SELECT search_count FROM products WHERE id = ${productId}::uuid
    `,
    getListingsForProduct(productId),
    sql`
      SELECT COALESCE(SUM(hit_count), 0)::int AS total_hits
      FROM search_queries WHERE product_id = ${productId}::uuid
    `,
    sql`
      SELECT ps.sort_price, ps.fetched_at
      FROM price_snapshots ps
      JOIN retailer_listings rl ON rl.id = ps.listing_id
      WHERE rl.product_id = ${productId}::uuid
      ORDER BY ps.fetched_at DESC
      LIMIT 60
    `,
  ]);

  const searchCount = Number(productRow[0]?.search_count ?? 0);
  const queryHits = Number(searchStats[0]?.total_hits ?? 0);
  const searchVelocity = Math.min(100, searchCount * 8 + queryHits * 12);

  const retailPrices = extractRetailPrices(listings);
  const wholesaleCost = extractWholesaleCost(listings);
  const retailMedian = median(retailPrices);
  const retailMin = retailPrices.length ? Math.min(...retailPrices) : null;
  const retailMax = retailPrices.length ? Math.max(...retailPrices) : null;
  const retailSpread =
    retailMin != null && retailMax != null ? retailMax - retailMin : null;

  const rrp = extractRrp(listings);
  let marginPercent: number | null = null;
  if (wholesaleCost != null && rrp != null && rrp > 0) {
    marginPercent = ((rrp - wholesaleCost) / rrp) * 100;
  } else if (wholesaleCost != null && retailMedian != null && retailMedian > 0) {
    marginPercent = ((retailMedian - wholesaleCost) / retailMedian) * 100;
  }

  const retailerCoverage = listings.filter((l) => l.lastPrices?.length).length;

  let priceTrend30d: number | null = null;
  if (priceHistory.length >= 4) {
    const recent = Number(priceHistory[0].sort_price);
    const older = Number(priceHistory[priceHistory.length - 1].sort_price);
    if (older > 0) priceTrend30d = ((recent - older) / older) * 100;
  }

  const competitionDensity = Math.min(
    100,
    retailerCoverage * 14 + (retailSpread ?? 0) * 2,
  );

  const demandMomentum =
    searchVelocity * 0.35 +
    category.demand * 0.25 +
    (priceTrend30d != null && priceTrend30d > 0 ? 20 : 0) +
    category.impulse * 0.15;

  await persistSignals(productId, {
    search_count: searchCount,
    search_velocity: searchVelocity,
    retailer_coverage: retailerCoverage,
    wholesale_cost: wholesaleCost,
    retail_median: retailMedian,
    margin_percent: marginPercent,
    category: category.id,
    demand_momentum: demandMomentum,
  });

  try {
    await sql`
      UPDATE products
      SET category = ${category.label}, updated_at = now()
      WHERE id = ${productId}::uuid
        AND (category IS NULL OR category = '')
    `;
  } catch {
    /* category column may be missing until db/migrate-production.sql is applied */
  }

  return {
    search_count: searchCount,
    search_velocity: searchVelocity,
    retailer_coverage: retailerCoverage,
    price_samples: priceHistory.length,
    wholesale_cost: wholesaleCost,
    retail_median: retailMedian,
    retail_spread: retailSpread,
    margin_percent: marginPercent,
    price_trend_30d: priceTrend30d,
    category: category.label,
    category_demand: category.demand,
    category_turnover_days: category.turnoverDays,
    seasonality_index: category.seasonalityIndex,
    impulse_score: category.impulse,
    demand_momentum: demandMomentum,
    competition_density: competitionDensity,
  };
}

async function persistSignals(
  productId: string,
  signals: Record<string, number | string | null>,
) {
  const sql = getSql();
  for (const [key, value] of Object.entries(signals)) {
    if (value == null) continue;
    await sql`
      INSERT INTO market_signals (product_id, signal_key, signal_value, signal_text)
      VALUES (
        ${productId}::uuid,
        ${key},
        ${typeof value === "number" ? value : null},
        ${typeof value === "string" ? value : null}
      )
      ON CONFLICT (product_id, signal_key) DO UPDATE SET
        signal_value = EXCLUDED.signal_value,
        signal_text = EXCLUDED.signal_text,
        fetched_at = now()
    `;
  }
}
