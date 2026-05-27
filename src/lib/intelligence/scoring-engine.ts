import { inferCategory } from "./category";
import type {
  MarketSignalSnapshot,
  ProductIntelligenceOutput,
  ProfitPotential,
  RiskLevel,
  ScoringResult,
  SellSpeed,
  TrendDirection,
} from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sellSpeedFromDays(days: number): SellSpeed {
  if (days <= 7) return "Very Fast";
  if (days <= 14) return "Fast";
  if (days <= 28) return "Medium";
  return "Slow";
}

function turnoverLabel(days: number): string {
  if (days <= 7) return "3–7 days";
  if (days <= 14) return "1–2 weeks";
  if (days <= 28) return "2–4 weeks";
  if (days <= 45) return "1–2 months";
  return "1+ months";
}

function trendFromSignals(s: MarketSignalSnapshot): TrendDirection {
  const momentum = s.demand_momentum;
  const price = s.price_trend_30d ?? 0;
  const combined = momentum * 0.6 + price * 0.4;
  if (combined >= 58) return "Rising";
  if (combined <= 42) return "Declining";
  return "Stable";
}

function riskLevel(s: MarketSignalSnapshot, margin: number | null): RiskLevel {
  let risk = 35;
  if (s.retailer_coverage < 3) risk += 25;
  if (s.price_samples < 5) risk += 15;
  if (margin != null && margin < 15) risk += 20;
  if (s.competition_density > 75) risk += 10;
  if (s.category.includes("Vape") || s.category.includes("Spirits")) risk += 10;
  if (s.search_velocity > 60) risk -= 15;
  if (margin != null && margin > 30) risk -= 10;

  if (risk <= 35) return "Low";
  if (risk <= 60) return "Medium";
  return "High";
}

function profitPotential(margin: number | null): ProfitPotential {
  if (margin == null) return "Medium";
  if (margin >= 28) return "High";
  if (margin >= 15) return "Medium";
  return "Low";
}

function confidenceScore(s: MarketSignalSnapshot): number {
  let c = 0.35;
  if (s.retailer_coverage >= 4) c += 0.2;
  if (s.price_samples >= 10) c += 0.15;
  if (s.wholesale_cost != null) c += 0.15;
  if (s.search_count >= 2) c += 0.1;
  if (s.retail_median != null) c += 0.05;
  return clamp(c, 0.35, 0.95);
}

function popularityScore(s: MarketSignalSnapshot): number {
  const score =
    s.category_demand * 0.3 +
    s.search_velocity * 0.25 +
    s.impulse_score * 0.2 +
    s.demand_momentum * 0.15 +
    s.retailer_coverage * 8;
  return Math.round(clamp(score, 0, 100));
}

function opportunityScore(
  popularity: number,
  profit: ProfitPotential,
  risk: RiskLevel,
  sellSpeed: SellSpeed,
  trend: TrendDirection,
): number {
  const profitPts = { High: 28, Medium: 16, Low: 6 }[profit];
  const riskPts = { Low: 22, Medium: 12, High: 0 }[risk];
  const speedPts = {
    "Very Fast": 22,
    Fast: 18,
    Medium: 10,
    Slow: 2,
  }[sellSpeed];
  const trendPts = { Rising: 12, Stable: 6, Declining: 0 }[trend];
  return Math.round(
    clamp(popularity * 0.35 + profitPts + riskPts + speedPts + trendPts, 0, 100),
  );
}

export function computeScores(
  productName: string,
  signals: MarketSignalSnapshot,
): ScoringResult {
  const category = inferCategory(productName);
  const popularity = popularityScore(signals);
  const trend = trendFromSignals(signals);

  let turnoverDays = category.turnoverDays;
  if (signals.impulse_score > 80) turnoverDays *= 0.7;
  if (signals.search_velocity > 70) turnoverDays *= 0.85;
  if (trend === "Rising") turnoverDays *= 0.9;
  if (trend === "Declining") turnoverDays *= 1.25;
  turnoverDays = Math.round(clamp(turnoverDays, 3, 90));

  const sellSpeed = sellSpeedFromDays(turnoverDays);
  const margin = signals.margin_percent;
  const risk = riskLevel(signals, margin);
  const profit = profitPotential(margin);
  const confidence = confidenceScore(signals);
  const opportunity = opportunityScore(popularity, profit, risk, sellSpeed, trend);

  const output: ProductIntelligenceOutput = {
    popularity_score: popularity,
    sell_speed: sellSpeed,
    estimated_turnover: turnoverLabel(turnoverDays),
    confidence_score: Math.round(confidence * 100) / 100,
    risk_level: risk,
    profit_potential: profit,
    trend_direction: trend,
    buyer_type: category.buyerTypes,
    seasonality: category.seasonality,
    summary: "",
  };

  return {
    ...output,
    opportunity_score: opportunity,
    wholesale_cost: signals.wholesale_cost,
    estimated_resale: signals.retail_median,
    margin_percent: margin,
    signals,
  };
}
