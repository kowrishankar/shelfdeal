import { RETAILER_NAMES } from "../retailers/shared";
import type { DbListingRow } from "../db/products";
import type { PriceLine, RetailerId, RetailerListing } from "../types";
import type { ScoringResult } from "./types";

export interface RetailPricingInsights {
  lowestPrice: number | null;
  lowestRetailerId: RetailerId | null;
  lowestRetailerName: string | null;
  unitCost: number | null;
  unitCostRetailer: string | null;
  rrp: number | null;
  porPercent: number | null;
  /** Margin per single unit vs RRP (preferred) or vs lowest retail */
  marginPercent: number | null;
  marginLabel: string;
}

export type ScoreTier =
  | "excellent"
  | "strong_buy"
  | "moderate"
  | "caution"
  | "avoid";

export interface ScoreRating {
  tier: ScoreTier;
  /** Display label e.g. "Strong Buy" */
  label: string;
  score: number;
  headline: string;
  summary: string;
  icon: string;
}

const SCORE_BANDS: {
  min: number;
  tier: ScoreTier;
  label: string;
  headline: string;
  summary: string;
  icon: string;
}[] = [
  {
    min: 90,
    tier: "excellent",
    label: "Excellent",
    headline: "Excellent opportunity",
    summary:
      "Top-tier score — strong demand, margin, and sell-through signals. Worth prioritising on shelf.",
    icon: "★",
  },
  {
    min: 75,
    tier: "strong_buy",
    label: "Strong Buy",
    headline: "Strong buy",
    summary:
      "High confidence — good margin potential and manageable risk. Sensible trial or reorder quantity.",
    icon: "✓",
  },
  {
    min: 60,
    tier: "moderate",
    label: "Moderate",
    headline: "Moderate opportunity",
    summary:
      "Decent but not outstanding — stock if it fits your customers; keep quantities modest until proven.",
    icon: "◆",
  },
  {
    min: 40,
    tier: "caution",
    label: "Caution",
    headline: "Proceed with caution",
    summary:
      "Mixed signals — try a small test order only, or wait for a better price or stronger demand.",
    icon: "◷",
  },
  {
    min: 0,
    tier: "avoid",
    label: "Avoid",
    headline: "Avoid for now",
    summary:
      "Low score — weak margin, risk, or demand. Skip bulk orders unless you know it sells in your shop.",
    icon: "✕",
  },
];

/** Map opportunity score (0–100) to a retailer-friendly rating band */
export function getScoreRating(score: number): ScoreRating {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const band = SCORE_BANDS.find((b) => s >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
  return {
    tier: band.tier,
    label: band.label,
    score: s,
    headline: band.headline,
    summary: band.summary,
    icon: band.icon,
  };
}

/** @deprecated Use getScoreRating — kept for API compatibility */
export function computeBuySignal(
  intelligence: ScoringResult,
  _retail?: RetailPricingInsights,
): ScoreRating {
  return getScoreRating(intelligence.opportunity_score);
}

/** @deprecated Use ScoreRating */
export type BuySignal = ScoreRating;

type ListingLike = {
  retailerId: RetailerId;
  lastPrices?: PriceLine[] | null;
  lastSortPrice?: number | null;
};

function pickAmount(line: PriceLine | undefined): number | undefined {
  return line?.amount;
}

function comparableUnitPrice(prices: PriceLine[]): number | null {
  const unit =
    prices.find((p) => p.kind === "unit_inc_vat") ??
    prices.find((p) => p.kind === "unit_ex_vat");
  if (unit) return unit.amount;

  const shelf =
    prices.find((p) => p.kind === "clubcard") ??
    prices.find((p) => p.kind === "standard") ??
    prices.find((p) => p.kind === "inc_vat");
  return shelf ? shelf.amount : null;
}

function unitCostFromPrices(
  prices: PriceLine[],
  retailerId: RetailerId,
): number | null {
  const unitEx = prices.find((p) => p.kind === "unit_ex_vat");
  const unitInc = prices.find((p) => p.kind === "unit_inc_vat");
  if (unitEx) return unitEx.amount;
  if (unitInc) return unitInc.amount;

  if (retailerId === "booker") {
    const ex = prices.find((p) => p.kind === "ex_vat");
    const inc = prices.find((p) => p.kind === "inc_vat");
    return ex?.amount ?? inc?.amount ?? null;
  }
  return null;
}

export function buildRetailPricingInsights(
  listings: ListingLike[] | RetailerListing[],
): RetailPricingInsights {
  let lowestPrice: number | null = null;
  let lowestRetailerId: RetailerId | null = null;

  let unitCost: number | null = null;
  let unitCostRetailer: string | null = null;

  let rrp: number | null = null;
  let porPercent: number | null = null;

  for (const row of listings) {
    const prices =
      "prices" in row && row.prices
        ? row.prices
        : (row as DbListingRow).lastPrices ?? [];
    if (!prices.length) continue;

    const unitComparable = comparableUnitPrice(prices);
    if (unitComparable != null) {
      if (lowestPrice == null || unitComparable < lowestPrice) {
        lowestPrice = unitComparable;
        lowestRetailerId = row.retailerId;
      }
    }

    const rrpLine = prices.find((p) => p.kind === "rrp");
    if (rrpLine && rrp == null) rrp = rrpLine.amount;

    const porLine = prices.find((p) => p.kind === "por");
    if (porLine?.percent != null && porPercent == null) {
      porPercent = porLine.percent;
    }

    const wholesale = unitCostFromPrices(prices, row.retailerId);
    if (wholesale != null && (unitCost == null || wholesale < unitCost)) {
      unitCost = wholesale;
      unitCostRetailer = RETAILER_NAMES[row.retailerId];
    }
  }

  let marginPercent: number | null = null;
  let marginLabel = "Per unit";

  if (unitCost != null && rrp != null && rrp > 0) {
    marginPercent = ((rrp - unitCost) / rrp) * 100;
    marginLabel = "Per unit (vs RRP)";
  } else if (unitCost != null && lowestPrice != null && lowestPrice > 0) {
    marginPercent = ((lowestPrice - unitCost) / lowestPrice) * 100;
    marginLabel = "Per unit (vs lowest retail)";
  }

  return {
    lowestPrice,
    lowestRetailerId,
    lowestRetailerName: lowestRetailerId
      ? RETAILER_NAMES[lowestRetailerId]
      : null,
    unitCost,
    unitCostRetailer,
    rrp,
    porPercent,
    marginPercent,
    marginLabel,
  };
}

