import { getSql } from "../db";
import { getListingsForProduct, getProductById } from "../db/products";
import { enrichWithAiSummary } from "./ai-narrative";
import { upsertProductEmbedding, findSimilarProducts } from "./embeddings";
import {
  buildRetailPricingInsights,
  getScoreRating,
  type RetailPricingInsights,
  type ScoreRating,
} from "./retail-insights";
import { collectMarketSignals } from "./signals";
import { computeScores } from "./scoring-engine";
import type {
  DashboardFilters,
  ProductIntelligenceCard,
  ScoringResult,
} from "./types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function getOrComputeIntelligence(
  productId: string,
  options?: { force?: boolean },
): Promise<ProductIntelligenceCard | null> {
  const product = await getProductById(productId);
  if (!product) return null;

  if (!options?.force) {
    const cached = await getCachedIntelligence(productId);
    if (cached) return { ...cached, name: product.canonicalName, imageUrl: product.imageUrl };
  }

  const signals = await collectMarketSignals(productId, product.canonicalName);
  let scored = computeScores(product.canonicalName, signals);
  scored = await enrichWithAiSummary(product.canonicalName, scored);

  await saveIntelligence(productId, scored);
  try {
    await upsertProductEmbedding(
      productId,
      `${product.canonicalName}. Category: ${signals.category}. ${scored.summary}`,
    );
  } catch {
    /* requires pgvector + OPENAI_API_KEY */
  }

  return {
    productId,
    name: product.canonicalName,
    imageUrl: product.imageUrl,
    barcode: product.barcode,
    category: signals.category,
    intelligence: scored,
    computedAt: new Date().toISOString(),
  };
}

async function getCachedIntelligence(
  productId: string,
): Promise<ProductIntelligenceCard | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT pi.*, p.canonical_name, p.image_url, p.barcode, p.category
    FROM product_intelligence pi
    JOIN products p ON p.id = pi.product_id
    WHERE pi.product_id = ${productId}::uuid
      AND pi.expires_at > now()
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0];
  return mapIntelligenceRow(row);
}

async function saveIntelligence(productId: string, scored: ScoringResult) {
  const sql = getSql();
  const expires = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  await sql`
    INSERT INTO product_intelligence (
      product_id, popularity_score, sell_speed, estimated_turnover,
      confidence_score, risk_level, profit_potential, trend_direction,
      buyer_types, seasonality, summary, wholesale_cost, estimated_resale,
      margin_percent, opportunity_score, signals_snapshot, computed_at, expires_at
    ) VALUES (
      ${productId}::uuid,
      ${scored.popularity_score},
      ${scored.sell_speed},
      ${scored.estimated_turnover},
      ${scored.confidence_score},
      ${scored.risk_level},
      ${scored.profit_potential},
      ${scored.trend_direction},
      ${JSON.stringify(scored.buyer_type)}::jsonb,
      ${scored.seasonality},
      ${scored.summary},
      ${scored.wholesale_cost},
      ${scored.estimated_resale},
      ${scored.margin_percent},
      ${scored.opportunity_score},
      ${JSON.stringify(scored.signals)}::jsonb,
      now(),
      ${expires}::timestamptz
    )
    ON CONFLICT (product_id) DO UPDATE SET
      popularity_score = EXCLUDED.popularity_score,
      sell_speed = EXCLUDED.sell_speed,
      estimated_turnover = EXCLUDED.estimated_turnover,
      confidence_score = EXCLUDED.confidence_score,
      risk_level = EXCLUDED.risk_level,
      profit_potential = EXCLUDED.profit_potential,
      trend_direction = EXCLUDED.trend_direction,
      buyer_types = EXCLUDED.buyer_types,
      seasonality = EXCLUDED.seasonality,
      summary = EXCLUDED.summary,
      wholesale_cost = EXCLUDED.wholesale_cost,
      estimated_resale = EXCLUDED.estimated_resale,
      margin_percent = EXCLUDED.margin_percent,
      opportunity_score = EXCLUDED.opportunity_score,
      signals_snapshot = EXCLUDED.signals_snapshot,
      computed_at = now(),
      expires_at = EXCLUDED.expires_at
  `;
}

function mapIntelligenceRow(row: Record<string, unknown>): ProductIntelligenceCard {
  const signals =
    typeof row.signals_snapshot === "string"
      ? (JSON.parse(row.signals_snapshot) as ScoringResult["signals"])
      : (row.signals_snapshot as ScoringResult["signals"]);
  const buyerTypes =
    typeof row.buyer_types === "string"
      ? (JSON.parse(row.buyer_types) as string[])
      : (row.buyer_types as string[]);
  const intelligence: ScoringResult = {
    popularity_score: Number(row.popularity_score),
    sell_speed: row.sell_speed as ScoringResult["sell_speed"],
    estimated_turnover: row.estimated_turnover as string,
    confidence_score: Number(row.confidence_score),
    risk_level: row.risk_level as ScoringResult["risk_level"],
    profit_potential: row.profit_potential as ScoringResult["profit_potential"],
    trend_direction: row.trend_direction as ScoringResult["trend_direction"],
    buyer_type: buyerTypes,
    seasonality: row.seasonality as string,
    summary: row.summary as string,
    opportunity_score: Number(row.opportunity_score),
    wholesale_cost: row.wholesale_cost != null ? Number(row.wholesale_cost) : null,
    estimated_resale:
      row.estimated_resale != null ? Number(row.estimated_resale) : null,
    margin_percent: row.margin_percent != null ? Number(row.margin_percent) : null,
    signals,
  };

  return {
    productId: (row.product_id ?? row.productId) as string,
    name: row.canonical_name as string,
    imageUrl: (row.image_url as string) ?? null,
    barcode: (row.barcode as string) ?? null,
    category: (row.category as string) ?? null,
    intelligence,
    computedAt: (row.computed_at as Date).toISOString?.() ?? String(row.computed_at),
  };
}

export async function listIntelligenceDashboard(
  filters: DashboardFilters,
): Promise<{
  products: ProductIntelligenceCard[];
  sections: {
    trending: ProductIntelligenceCard[];
    lowRisk: ProductIntelligenceCard[];
    highMargin: ProductIntelligenceCard[];
  };
}> {
  const sql = getSql();
  const q = filters.q?.trim();
  const section = filters.section ?? "all";

  let rows = await sql`
    SELECT pi.*, p.canonical_name, p.image_url, p.barcode, p.category
    FROM product_intelligence pi
    JOIN products p ON p.id = pi.product_id
  `;

  let cards = rows.map(mapIntelligenceRow);

  if (q) {
    const lower = q.toLowerCase();
    cards = cards.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.category?.toLowerCase().includes(lower),
    );
  }
  if (filters.category) {
    cards = cards.filter((c) => c.category === filters.category);
  }
  if (filters.risk) {
    cards = cards.filter((c) => c.intelligence.risk_level === filters.risk);
  }
  if (filters.profit) {
    cards = cards.filter(
      (c) => c.intelligence.profit_potential === filters.profit,
    );
  }
  if (filters.trend) {
    cards = cards.filter(
      (c) => c.intelligence.trend_direction === filters.trend,
    );
  }

  cards = sortCards(cards, filters.sort ?? "opportunity");

  const trending = [...cards]
    .filter((c) => c.intelligence.trend_direction === "Rising")
    .sort((a, b) => b.intelligence.popularity_score - a.intelligence.popularity_score)
    .slice(0, 8);

  const lowRisk = [...cards]
    .filter((c) => c.intelligence.risk_level === "Low")
    .sort((a, b) => b.intelligence.opportunity_score - a.intelligence.opportunity_score)
    .slice(0, 8);

  const highMargin = [...cards]
    .filter((c) => c.intelligence.profit_potential === "High")
    .sort(
      (a, b) =>
        (b.intelligence.margin_percent ?? 0) - (a.intelligence.margin_percent ?? 0),
    )
    .slice(0, 8);

  if (section === "trending") cards = trending;
  else if (section === "low_risk") cards = lowRisk;
  else if (section === "high_margin") cards = highMargin;

  return { products: cards, sections: { trending, lowRisk, highMargin } };
}

function sortCards(
  cards: ProductIntelligenceCard[],
  sort: NonNullable<DashboardFilters["sort"]>,
) {
  const cmp: Record<typeof sort, (a: ProductIntelligenceCard, b: ProductIntelligenceCard) => number> = {
    opportunity: (a, b) =>
      b.intelligence.opportunity_score - a.intelligence.opportunity_score,
    popularity: (a, b) =>
      b.intelligence.popularity_score - a.intelligence.popularity_score,
    margin: (a, b) =>
      (b.intelligence.margin_percent ?? 0) - (a.intelligence.margin_percent ?? 0),
    sell_speed: (a, b) => {
      const order = { "Very Fast": 4, Fast: 3, Medium: 2, Slow: 1 };
      return order[b.intelligence.sell_speed] - order[a.intelligence.sell_speed];
    },
    risk: (a, b) => {
      const order = { Low: 3, Medium: 2, High: 1 };
      return order[b.intelligence.risk_level] - order[a.intelligence.risk_level];
    },
  };
  return [...cards].sort(cmp[sort]);
}

export async function getProductInsightsBundle(
  productId: string,
  options?: { force?: boolean },
) {
  const card = await getOrComputeIntelligence(productId, options);
  if (!card) return null;

  const listings = await getListingsForProduct(productId);
  let similar: Awaited<ReturnType<typeof findSimilarProducts>> = [];
  try {
    similar = await findSimilarProducts(productId, 5);
  } catch {
    // pgvector may be empty
  }

  const avoid =
    card.intelligence.risk_level === "High" &&
    card.intelligence.profit_potential === "Low";

  const buyingAdvice = buildBuyingAdvice(card);
  const retailPricing = buildRetailPricingInsights(listings);
  const scoreRating = getScoreRating(card.intelligence.opportunity_score);

  return {
    ...card,
    listings,
    similarProducts: similar,
    productsToAvoid: avoid ? [card] : [],
    buyingAdvice,
    retailPricing,
    scoreRating,
  };
}

export type { ScoreRating, RetailPricingInsights };

function buildBuyingAdvice(card: ProductIntelligenceCard): string[] {
  const i = card.intelligence;
  const tips: string[] = [];

  if (i.opportunity_score >= 75) {
    tips.push("Strong opportunity score — consider a trial case before scaling.");
  }
  if (i.sell_speed === "Very Fast" || i.sell_speed === "Fast") {
    tips.push("Reorder while in stock; fast movers often need twice-weekly top-ups.");
  }
  if (i.risk_level === "High") {
    tips.push("Start with limited units until sell-through is confirmed in your store.");
  }
  if (i.margin_percent != null && i.margin_percent >= 25) {
    tips.push(
      `Per-unit margin about ${i.margin_percent.toFixed(0)}% — price near RRP where local competition allows.`,
    );
  }
  if (i.margin_percent != null && i.margin_percent < 15) {
    tips.push("Margin looks tight on a single unit — negotiate promos or reconsider shelf space.");
  }
  if (i.trend_direction === "Rising") {
    tips.push("Trend is rising — secure supply before competitors stock up.");
  }
  if (i.trend_direction === "Declining") {
    tips.push("Demand may be softening — avoid deep bulk orders.");
  }

  return tips.length ? tips : ["Monitor weekly sales and compare against Booker trade price."];
}
