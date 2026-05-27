import type { PriceLine, RetailerListing, RetailerId } from "../types";
import {
  extractJsonLdProducts,
  firstImage,
  isInStock,
  parseOfferPrice,
} from "../parse-json-ld";
import { fetchHtml } from "../http";

export const RETAILER_NAMES: Record<RetailerId, string> = {
  asda: "ASDA",
  tesco: "Tesco",
  sainsburys: "Sainsbury's",
  amazon: "Amazon",
  costco: "Costco",
  booker: "Booker",
  morrisons: "Morrisons",
  ocado: "Ocado",
};

export function parseTescoClubcardMeta(html: string): {
  regular?: number;
  clubcard?: number;
  until?: string;
} {
  const meta =
    html.match(/name="description"[^>]*content="([^"]+)"/i)?.[1] ??
    html.match(/content="([^"]+)"[^>]*name="description"/i)?.[1];
  if (!meta) return {};

  const regular = meta.match(/Regular price £([\d.]+)/i)?.[1];
  const clubcard = meta.match(/Clubcard price is £([\d.]+)/i)?.[1];
  const until = meta.match(/available until ([^,]+)/i)?.[1];

  return {
    regular: regular ? parseFloat(regular) : undefined,
    clubcard: clubcard ? parseFloat(clubcard) : undefined,
    until,
  };
}

export function listingFromJsonLd(
  retailerId: RetailerId,
  url: string,
  html: string,
  extraPrices: PriceLine[] = [],
  note?: string,
): RetailerListing | null {
  const products = extractJsonLdProducts(html);
  const product = products[0];
  if (!product) return null;

  const standard = parseOfferPrice(product.offers);
  const prices: PriceLine[] = [...extraPrices];

  if (standard !== undefined) {
    prices.push({
      kind: "standard",
      label: "Price",
      amount: standard,
      currency: "GBP",
    });
  }

  if (prices.length === 0) return null;

  const sortCandidates = prices
    .filter((p) => p.kind !== "ex_vat")
    .map((p) => p.amount);

  return {
    retailerId,
    retailerName: RETAILER_NAMES[retailerId],
    productName: product.name ?? "Product",
    url,
    imageUrl: firstImage(product.image),
    inStock: isInStock(product.offers?.availability),
    prices,
    sortPrice: Math.min(...sortCandidates),
    fetchedAt: new Date().toISOString(),
    note,
  };
}

export async function fetchJsonLdListing(
  retailerId: RetailerId,
  url: string,
  transform?: (html: string, base: RetailerListing | null) => RetailerListing | null,
): Promise<RetailerListing> {
  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchHtml(url);
    const base = listingFromJsonLd(retailerId, url, html);
    if (transform) {
      const transformed = transform(html, base);
      if (transformed) return transformed;
    }
    if (base) return base;
    return unavailable(retailerId, url, fetchedAt, "Could not parse product price");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return unavailable(retailerId, url, fetchedAt, message);
  }
}

export function unavailable(
  retailerId: RetailerId,
  url: string,
  fetchedAt: string,
  error: string,
): RetailerListing {
  return {
    retailerId,
    retailerName: RETAILER_NAMES[retailerId],
    productName: RETAILER_NAMES[retailerId],
    url,
    inStock: false,
    prices: [],
    sortPrice: 0,
    fetchedAt,
    error,
  };
}

export function parseBookerPricing(html: string): {
  prices: PriceLine[];
  packSize?: number;
  packLabel?: string;
  rrpPerUnit?: number;
  porPercent?: number;
} {
  const match = html.match(
    /"standardPricing":\{"price":"£([\d.]+)","pricewithvat":"£([\d.]+)"(?:,"pricepor":\{"value":"([\d.]+)%")?/,
  );
  if (!match) return { prices: [] };

  const exVat = parseFloat(match[1]);
  const incVat = parseFloat(match[2]);
  const porRaw = match[3];
  const prev = html.match(/"prevText":"£([\d.]+)"/)?.[1];

  const packSizeRaw = html.match(/"packSize":(\d+)/)?.[1];
  const packInfo =
    html.match(/"packSizeInformation":"([^"]+)"/)?.[1]?.trim() ??
    html.match(/"servings":\["([^"]+)"\]/)?.[1];
  const packSize = packSizeRaw ? Number(packSizeRaw) : undefined;
  const isMultipack = packSize != null && packSize > 1;
  const packLabel = packInfo || (isMultipack ? `Case of ${packSize}` : undefined);

  const caseSuffix = isMultipack && packLabel ? ` · ${packLabel}` : "";

  const prices: PriceLine[] = [
    {
      kind: "ex_vat",
      label: isMultipack ? `Case price (ex VAT)${caseSuffix}` : "Trade (ex VAT)",
      amount: exVat,
      currency: "GBP",
    },
    {
      kind: "inc_vat",
      label: isMultipack ? `Case price (inc VAT)${caseSuffix}` : "Trade (inc VAT)",
      amount: incVat,
      currency: "GBP",
    },
  ];

  const rrpRaw = html.match(/"rrp":([\d.]+)/)?.[1];
  const rrpPerUnit = rrpRaw ? parseFloat(rrpRaw) : undefined;
  if (rrpPerUnit != null && Number.isFinite(rrpPerUnit)) {
    prices.push({
      kind: "rrp",
      label: "RRP (per unit)",
      amount: rrpPerUnit,
      currency: "GBP",
    });
  }

  const porPercent = porRaw ? parseFloat(porRaw) : undefined;
  if (porPercent != null && Number.isFinite(porPercent)) {
    prices.push({
      kind: "por",
      label: "POR (profit on return)",
      amount: 0,
      currency: "GBP",
      percent: porPercent,
    });
  }

  if (prev) {
    const was = parseFloat(prev);
    if (was > exVat) {
      prices.push({
        kind: "promo",
        label: "Was (case ex VAT)",
        amount: was,
        currency: "GBP",
      });
    }
  }

  return {
    prices,
    packSize: isMultipack ? packSize : undefined,
    packLabel,
    rrpPerUnit,
    porPercent,
  };
}

export function parseAmazonPrice(html: string): number | undefined {
  const whole = html.match(/class="a-price-whole"[^>]*>(\d+)/)?.[1];
  const fraction = html.match(/class="a-price-fraction"[^>]*>(\d+)/)?.[1];
  if (whole) {
    return parseFloat(`${whole}.${fraction ?? "00"}`);
  }

  const prices = [...html.matchAll(/£(\d+\.\d{2})/g)].map((m) =>
    parseFloat(m[1]),
  );
  const plausible = prices.filter((p) => p >= 15 && p <= 80);
  return plausible.length ? Math.min(...plausible) : undefined;
}
