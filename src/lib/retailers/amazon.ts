import { fetchHtml } from "../http";
import { applyMultipackUnitPricing } from "../pack-pricing";
import type { RetailerListing } from "../types";
import {
  fetchAmazonPriceViaCreators,
  isAmazonCreatorsConfigured,
} from "./amazon-creators";
import { listingFromJsonLd, unavailable } from "./shared";

const AMAZON_COOKIE = "i18n-prefs=GBP; lc-acbuk=en_GB";

export function extractAsinFromAmazonUrl(url: string): string | null {
  const match = url.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  return match?.[1]?.toUpperCase() ?? null;
}

export function isAmazonProductUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("amazon.") && extractAsinFromAmazonUrl(url) != null;
  } catch {
    return false;
  }
}

export function amazonProductUrl(asin: string): string {
  return `https://www.amazon.co.uk/dp/${asin}`;
}

function parsePriceFromText(text: string): number | undefined {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function parseAmazonPrice(html: string): number | undefined {
  const whole = html.match(/class="a-price-whole"[^>]*>([\d,]+)/)?.[1];
  const fraction = html.match(/class="a-price-fraction"[^>]*>(\d+)/)?.[1];
  if (whole) {
    return parseFloat(`${whole.replace(/,/g, "")}.${fraction ?? "00"}`);
  }

  for (const pattern of [
    /"priceAmount"\s*:\s*(\d+\.?\d*)/,
    /"displayPrice"\s*:\s*"£([\d,.]+)"/,
    /"priceToPay"\s*:\s*\{[^}]*"value"\s*:\s*(\d+\.?\d*)/,
    /"apexPriceAmount"\s*:\s*(\d+\.?\d*)/,
    /data-a-color="price"[^>]*>[\s\S]{0,120}?£([\d,.]+)/,
  ]) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const value = parsePriceFromText(match[1]);
      if (value != null) return value;
    }
  }

  return undefined;
}

export function parseAmazonProductName(html: string): string | undefined {
  const productTitle =
    html.match(/id="productTitle"[^>]*>\s*([^<]+)/i)?.[1] ??
    html.match(/id="title"[^>]*>\s*<span[^>]*>([^<]+)/i)?.[1];
  if (productTitle?.trim()) return productTitle.trim();

  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  if (!title) return undefined;
  return title
    .replace(/\s*[:|]\s*Amazon\.co\.uk.*$/i, "")
    .replace(/\s*[:|]\s*Amazon.*$/i, "")
    .trim();
}

async function fetchAmazonFromHtml(url: string): Promise<RetailerListing | null> {
  const fetchedAt = new Date().toISOString();
  const html = await fetchHtml(url, { cookie: AMAZON_COOKIE });
  const price = parseAmazonPrice(html);
  const base = listingFromJsonLd("amazon", url, html);
  const productName =
    base?.productName ??
    parseAmazonProductName(html) ??
    "Product";

  if (price == null && !base?.prices.length) {
    return null;
  }

  const prices = base?.prices.length
    ? base.prices
    : price != null
      ? [
          {
            kind: "standard" as const,
            label: "Amazon",
            amount: price,
            currency: "GBP" as const,
          },
        ]
      : [];

  return applyMultipackUnitPricing(
    {
      retailerId: "amazon",
      retailerName: "Amazon",
      productName,
      url,
      imageUrl: base?.imageUrl,
      inStock: base?.inStock ?? true,
      prices,
      sortPrice: Math.min(...prices.map((p) => p.amount)),
      fetchedAt,
      note: "Amazon price may vary by seller",
    },
    html,
  );
}

export async function fetchAmazonPrice(url: string): Promise<RetailerListing> {
  const fetchedAt = new Date().toISOString();
  const asin = extractAsinFromAmazonUrl(url);
  const productUrl = asin ? amazonProductUrl(asin) : url;

  if (asin && isAmazonCreatorsConfigured()) {
    try {
      const listing = await fetchAmazonPriceViaCreators(asin, productUrl);
      if (listing.prices.length) return listing;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Creators API failed";
      return unavailable("amazon", productUrl, fetchedAt, message);
    }
  }

  try {
    const listing = await fetchAmazonFromHtml(productUrl);
    if (listing) return listing;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return unavailable("amazon", productUrl, fetchedAt, message);
  }

  return unavailable(
    "amazon",
    productUrl,
    fetchedAt,
    isAmazonCreatorsConfigured()
      ? "Price unavailable from Amazon"
      : "Price hidden on Amazon — add Amazon Creators API credentials in Vercel env, or view on Amazon",
  );
}
