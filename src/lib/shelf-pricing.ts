import { RETAILER_NAMES } from "./retailers/shared";
import type { PriceLine, RetailerId, RetailerListing } from "./types";

export interface MembershipOffer {
  id: string;
  retailerId: RetailerId;
  retailerName: string;
  label: string;
  price: number;
}

export interface ShelfEconomics {
  sellPrice: number;
  unitCost: number | null;
  unitCostRetailer: string | null;
  referenceRetail: number | null;
  referenceRetailLabel: string;
  marginPercent: number | null;
  porPercent: number | null;
  profitPerUnit: number | null;
  bookerRrp: number | null;
  bookerPorAtRrp: number | null;
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

function shelfRetailPrice(prices: PriceLine[], useMembership: boolean): number | null {
  if (useMembership) {
    const club = prices.find((p) => p.kind === "clubcard");
    if (club) return club.amount;
    const promo = prices.find((p) => p.kind === "promo");
    if (promo) return promo.amount;
  }

  const unit =
    prices.find((p) => p.kind === "unit_inc_vat") ??
    prices.find((p) => p.kind === "unit_ex_vat");
  if (unit) return unit.amount;

  const shelf =
    prices.find((p) => p.kind === "standard") ??
    prices.find((p) => p.kind === "inc_vat");
  return shelf ? shelf.amount : null;
}

export function detectMembershipOffers(
  listings: RetailerListing[],
): MembershipOffer[] {
  const offers: MembershipOffer[] = [];

  for (const listing of listings) {
    const club = listing.prices.find((p) => p.kind === "clubcard");
    if (club) {
      offers.push({
        id: `${listing.retailerId}-clubcard`,
        retailerId: listing.retailerId,
        retailerName: listing.retailerName,
        label: `${listing.retailerName} Clubcard`,
        price: club.amount,
      });
    }
  }

  return offers;
}

export function extractWholesaleUnitCost(listings: RetailerListing[]): {
  unitCost: number | null;
  unitCostRetailer: string | null;
  bookerRrp: number | null;
  bookerPorAtRrp: number | null;
} {
  let unitCost: number | null = null;
  let unitCostRetailer: string | null = null;
  let bookerRrp: number | null = null;
  let bookerPorAtRrp: number | null = null;

  for (const listing of listings) {
    const wholesale = unitCostFromPrices(listing.prices, listing.retailerId);
    if (wholesale != null && (unitCost == null || wholesale < unitCost)) {
      unitCost = wholesale;
      unitCostRetailer = RETAILER_NAMES[listing.retailerId];
    }

    if (listing.retailerId === "booker") {
      const rrp = listing.prices.find((p) => p.kind === "rrp");
      if (rrp) bookerRrp = rrp.amount;
      const por = listing.prices.find((p) => p.kind === "por");
      if (por?.percent != null) bookerPorAtRrp = por.percent;
    }
  }

  return { unitCost, unitCostRetailer, bookerRrp, bookerPorAtRrp };
}

export function pickReferenceRetail(
  listings: RetailerListing[],
  useMembership: boolean,
): { price: number | null; label: string } {
  let best: number | null = null;
  let bestRetailer: string | null = null;

  for (const listing of listings) {
    if (listing.retailerId === "booker") continue;
    const price = shelfRetailPrice(listing.prices, useMembership);
    if (price == null) continue;
    if (best == null || price < best) {
      best = price;
      bestRetailer = listing.retailerName;
    }
  }

  if (best == null) return { price: null, label: "Market retail" };

  const suffix = useMembership ? " (membership)" : "";
  return {
    price: best,
    label: bestRetailer ? `${bestRetailer}${suffix}` : `Market retail${suffix}`,
  };
}

export function computeShelfEconomics(
  sellPrice: number,
  listings: RetailerListing[],
  useMembership: boolean,
): ShelfEconomics {
  const { unitCost, unitCostRetailer, bookerRrp, bookerPorAtRrp } =
    extractWholesaleUnitCost(listings);
  const { price: referenceRetail, label: referenceRetailLabel } =
    pickReferenceRetail(listings, useMembership);

  let marginPercent: number | null = null;
  let porPercent: number | null = null;
  let profitPerUnit: number | null = null;

  if (unitCost != null && sellPrice > 0) {
    profitPerUnit = roundMoney(sellPrice - unitCost);
    marginPercent = (profitPerUnit / sellPrice) * 100;
    if (unitCost > 0) {
      porPercent = (profitPerUnit / unitCost) * 100;
    }
  }

  return {
    sellPrice,
    unitCost,
    unitCostRetailer,
    referenceRetail,
    referenceRetailLabel,
    marginPercent,
    porPercent,
    profitPerUnit,
    bookerRrp,
    bookerPorAtRrp,
  };
}

export function suggestSellPrice(
  listings: RetailerListing[],
  useMembership: boolean,
): number | null {
  const { bookerRrp } = extractWholesaleUnitCost(listings);
  if (bookerRrp != null) return bookerRrp;

  const { price } = pickReferenceRetail(listings, useMembership);
  if (price != null) return price;

  const { price: standard } = pickReferenceRetail(listings, false);
  return standard;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
