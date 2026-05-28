import { extractPackInfo } from "./product-matching";
import type { PriceLine, RetailerListing } from "./types";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Extract pack count from retailer HTML snippets (Booker, etc.) */
export function extractPackSizeFromHtml(html: string): {
  unitCount: number;
  packLabel: string;
} | null {
  const packSize = html.match(/"packSize":(\d+)/)?.[1];
  if (packSize) {
    const n = Number(packSize);
    if (n > 1) {
      const info =
        html.match(/"packSizeInformation":"([^"]+)"/)?.[1] ??
        `Case of ${n}`;
      return { unitCount: n, packLabel: info };
    }
  }

  const servings = html.match(/"servings":\["([^"]+)"\]/)?.[1];
  if (servings) {
    const caseOf = servings.match(/case\s+of\s+(\d+)/i);
    if (caseOf) {
      const n = Number(caseOf[1]);
      if (n > 1) return { unitCount: n, packLabel: servings };
    }
  }

  return null;
}

/** Amazon product pages often state pack count outside the title */
export function extractAmazonPackFromHtml(html: string): {
  unitCount: number;
  packLabel: string;
} | null {
  const perUnit = html.match(
    /£([\d.]+)\s*(?:per|\/)\s*(?:can|unit|item|bottle)/i,
  );
  if (perUnit) {
    const packPrice = html.match(
      /class="a-price-whole"[^>]*>([\d,]+)/,
    )?.[1];
    if (packPrice) {
      const total = parseFloat(packPrice.replace(/,/g, ""));
      const each = parseFloat(perUnit[1]);
      if (each > 0 && total > each) {
        const n = Math.round(total / each);
        if (n > 1 && n <= 48) {
          return { unitCount: n, packLabel: `Pack of ${n}` };
        }
      }
    }
  }

  for (const pattern of [
    /"numberOfItems"\s*:\s*(\d+)/i,
    /"itemPackageQuantity"\s*:\s*(\d+)/i,
    /Item package quantity[^0-9]*(\d+)/i,
    /(\d+)\s*(?:units|items)\s+per\s+pack/i,
  ]) {
    const m = html.match(pattern);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (n > 1 && n <= 48) {
        return { unitCount: n, packLabel: `Pack of ${n}` };
      }
    }
  }

  return null;
}

export function extractPackFromProductName(
  productName: string,
  packLabelHint?: string,
): { unitCount: number; packLabel: string } | null {
  const combined = `${productName} ${packLabelHint ?? ""}`;
  const pack = extractPackInfo(combined);
  if (pack.isMultipack && pack.unitCount && pack.unitCount > 1) {
    return { unitCount: pack.unitCount, packLabel: pack.packLabel };
  }
  return null;
}

export function resolveListingPackSize(
  listing: RetailerListing,
  html?: string,
): { unitCount: number; packLabel: string } | null {
  if (listing.packSize && listing.packSize > 1) {
    return {
      unitCount: listing.packSize,
      packLabel: listing.packLabel ?? `Pack of ${listing.packSize}`,
    };
  }

  const fromName = extractPackFromProductName(
    listing.productName,
    listing.packLabel,
  );
  if (fromName) return fromName;

  if (html) {
    const fromHtml =
      listing.retailerId === "amazon"
        ? extractAmazonPackFromHtml(html)
        : extractPackSizeFromHtml(html);
    if (fromHtml) return fromHtml;
  }

  return null;
}

/** Per-unit price used for comparison, shelf margin, and sort order */
export function listingUnitPrice(listing: RetailerListing): number | null {
  const unit =
    listing.prices.find((p) => p.kind === "unit_inc_vat") ??
    listing.prices.find((p) => p.kind === "unit_ex_vat");
  if (unit) return unit.amount;

  const pack = resolveListingPackSize(listing);
  const casePrice =
    listing.prices.find((p) => p.kind === "inc_vat") ??
    listing.prices.find((p) => p.kind === "standard") ??
    listing.prices.find((p) => p.kind === "ex_vat");
  if (pack && pack.unitCount > 1 && casePrice) {
    return roundMoney(casePrice.amount / pack.unitCount);
  }

  return casePrice?.amount ?? null;
}

/** Add per-unit price lines and set sortPrice for fair multipack comparison */
export function applyMultipackUnitPricing(
  listing: RetailerListing,
  html?: string,
): RetailerListing {
  const pack = resolveListingPackSize(listing, html);
  if (!pack || pack.unitCount <= 1) return listing;

  const prices = [...listing.prices];
  const exVat = prices.find((p) => p.kind === "ex_vat");
  const incVat = prices.find((p) => p.kind === "inc_vat");
  const standard = prices.find((p) => p.kind === "standard");
  const packSuffix = ` · ${pack.packLabel}`;

  const caseEx = exVat?.amount ?? (standard && !incVat ? standard.amount : undefined);
  const caseInc = incVat?.amount ?? standard?.amount;

  if (exVat) {
    exVat.label = exVat.label.includes("Case")
      ? exVat.label
      : `Case price (ex VAT)${packSuffix}`;
  } else if (standard && !incVat) {
    standard.label = `Pack price${packSuffix}`;
  } else if (incVat) {
    incVat.label = incVat.label.includes("Case")
      ? incVat.label
      : `Case price (inc VAT)${packSuffix}`;
  } else if (standard) {
    standard.label = `Pack price${packSuffix}`;
  }

  if (caseEx != null && !prices.some((p) => p.kind === "unit_ex_vat")) {
    prices.push({
      kind: "unit_ex_vat",
      label: `Per unit (ex VAT)${packSuffix}`,
      amount: roundMoney(caseEx / pack.unitCount),
      currency: "GBP",
    });
  }

  if (caseInc != null && !prices.some((p) => p.kind === "unit_inc_vat")) {
    prices.push({
      kind: "unit_inc_vat",
      label: `Per unit (inc VAT)${packSuffix}`,
      amount: roundMoney(caseInc / pack.unitCount),
      currency: "GBP",
    });
  } else if (
    caseEx != null &&
    incVat == null &&
    standard &&
    !prices.some((p) => p.kind === "unit_inc_vat")
  ) {
    prices.push({
      kind: "unit_inc_vat",
      label: `Per unit${packSuffix}`,
      amount: roundMoney(standard.amount / pack.unitCount),
      currency: "GBP",
    });
  }

  const sortPrice =
    listingUnitPrice({ ...listing, prices, packSize: pack.unitCount }) ??
    listing.sortPrice;

  return {
    ...listing,
    packSize: pack.unitCount,
    packLabel: pack.packLabel,
    prices: reorderWholesalePrices(prices),
    sortPrice,
  };
}

/** POR from this listing's own RRP and unit trade price (no cross-retailer comparison). */
export function appendListingOwnPor(listing: RetailerListing): RetailerListing {
  if (!listing.prices.length) return listing;
  if (listing.prices.some((p) => p.kind === "por")) return listing;

  const rrp = listing.prices.find((p) => p.kind === "rrp")?.amount;
  const unitCost =
    listing.prices.find((p) => p.kind === "unit_ex_vat")?.amount ??
    listing.prices.find((p) => p.kind === "unit_inc_vat")?.amount ??
    listingUnitPrice(listing);

  if (
    rrp == null ||
    unitCost == null ||
    unitCost <= 0 ||
    rrp <= unitCost
  ) {
    return listing;
  }

  const prices = [
    ...listing.prices,
    {
      kind: "por" as const,
      label: "POR (profit on return)",
      amount: 0,
      currency: "GBP" as const,
      percent: roundMoney(((rrp - unitCost) / unitCost) * 100),
    },
  ];

  return { ...listing, prices: reorderWholesalePrices(prices) };
}

export function finalizeListingPricing(
  listing: RetailerListing,
  html?: string,
): RetailerListing {
  return appendListingOwnPor(applyMultipackUnitPricing(listing, html));
}

export function finalizeAllListingPricing(
  listings: RetailerListing[],
): RetailerListing[] {
  return listings.map((l) => finalizeListingPricing(l));
}

export function reorderWholesalePrices(prices: PriceLine[]): PriceLine[] {
  const order: PriceLine["kind"][] = [
    "unit_inc_vat",
    "unit_ex_vat",
    "inc_vat",
    "ex_vat",
    "rrp",
    "por",
    "standard",
    "clubcard",
    "promo",
  ];
  return [...prices].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || 0,
  );
}
