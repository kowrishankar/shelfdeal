import { listingUnitPrice } from "../pack-pricing";
import { extractWholesaleUnitCost } from "../shelf-pricing";
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
  prices?: PriceLine[];
  lastPrices?: PriceLine[] | null;
  lastSortPrice?: number | null;
  sortPrice?: number;
  productName?: string;
  url?: string;
};

function roundPct(n: number): number {
  return Math.round(n * 10) / 10;
}

function toRetailerListing(row: ListingLike): RetailerListing | null {
  const prices = row.prices?.length
    ? row.prices
    : row.lastPrices ?? [];
  if (!prices.length) return null;

  return {
    retailerId: row.retailerId,
    retailerName: RETAILER_NAMES[row.retailerId],
    productName: row.productName ?? "",
    url: row.url ?? "",
    inStock: true,
    prices,
    sortPrice:
      row.sortPrice ??
      (row.lastSortPrice != null ? Number(row.lastSortPrice) : 0),
    fetchedAt: "",
  };
}

export function buildRetailPricingInsights(
  listings: ListingLike[] | RetailerListing[],
): RetailPricingInsights {
  const normalized = listings
    .map((row) => toRetailerListing(row))
    .filter((l): l is RetailerListing => l != null);

  const { unitCost, unitCostRetailer, bookerRrp, bookerPorAtRrp } =
    extractWholesaleUnitCost(normalized);

  let lowestPrice: number | null = null;
  let lowestRetailerId: RetailerId | null = null;

  for (const listing of normalized) {
    if (listing.retailerId === "booker") continue;
    const unitComparable = listingUnitPrice(listing);
    if (unitComparable == null) continue;
    if (lowestPrice == null || unitComparable < lowestPrice) {
      lowestPrice = unitComparable;
      lowestRetailerId = listing.retailerId;
    }
  }

  const rrp = bookerRrp;

  let marginPercent: number | null = null;
  let marginLabel = "Per unit";

  if (unitCost != null && rrp != null && rrp > 0) {
    marginPercent = roundPct(((rrp - unitCost) / rrp) * 100);
    marginLabel = "Per unit (vs RRP)";
  } else if (unitCost != null && lowestPrice != null && lowestPrice > 0) {
    marginPercent = roundPct(((lowestPrice - unitCost) / lowestPrice) * 100);
    marginLabel = "Per unit (vs lowest retail)";
  }

  let porPercent = bookerPorAtRrp;
  if (
    porPercent == null &&
    unitCost != null &&
    unitCost > 0 &&
    rrp != null &&
    rrp > unitCost
  ) {
    porPercent = roundPct(((rrp - unitCost) / unitCost) * 100);
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

