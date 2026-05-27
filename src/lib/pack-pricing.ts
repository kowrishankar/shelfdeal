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

/** Add per-unit price lines and set sortPrice for fair multipack comparison */
export function applyMultipackUnitPricing(listing: RetailerListing): RetailerListing {
  const pack =
    listing.packSize && listing.packSize > 1
      ? {
          unitCount: listing.packSize,
          packLabel: listing.packLabel ?? `Pack of ${listing.packSize}`,
        }
      : extractPackFromProductName(listing.productName, listing.packLabel);

  if (!pack || pack.unitCount <= 1) return listing;

  const prices = [...listing.prices];
  const exVat = prices.find((p) => p.kind === "ex_vat");
  const incVat = prices.find((p) => p.kind === "inc_vat");
  const standard = prices.find((p) => p.kind === "standard");

  const caseEx = exVat?.amount ?? standard?.amount;
  const caseInc = incVat?.amount ?? standard?.amount;

  if (caseEx != null && !prices.some((p) => p.kind === "unit_ex_vat")) {
    prices.push({
      kind: "unit_ex_vat",
      label: `Per unit (ex VAT) · ${pack.packLabel}`,
      amount: roundMoney(caseEx / pack.unitCount),
      currency: "GBP",
    });
  }

  if (caseInc != null && !prices.some((p) => p.kind === "unit_inc_vat")) {
    prices.push({
      kind: "unit_inc_vat",
      label: `Per unit (inc VAT) · ${pack.packLabel}`,
      amount: roundMoney(caseInc / pack.unitCount),
      currency: "GBP",
    });
  } else if (caseEx != null && incVat == null && standard && !prices.some((p) => p.kind === "unit_inc_vat")) {
    prices.push({
      kind: "unit_inc_vat",
      label: `Per unit · ${pack.packLabel}`,
      amount: roundMoney(standard.amount / pack.unitCount),
      currency: "GBP",
    });
  }

  const unitForSort =
    prices.find((p) => p.kind === "unit_inc_vat") ??
    prices.find((p) => p.kind === "unit_ex_vat");

  const sortPrice = unitForSort?.amount ?? listing.sortPrice;

  return {
    ...listing,
    packSize: pack.unitCount,
    packLabel: pack.packLabel,
    prices,
    sortPrice,
  };
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
