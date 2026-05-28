import { fetchHtml } from "../http";
import { finalizeListingPricing } from "../pack-pricing";
import { extractPackInfo } from "../product-matching";
import type { PriceLine, RetailerListing } from "../types";
import { listingFromJsonLd, unavailable } from "./shared";

const BASE = "https://www.costco.co.uk";
const REST_BASE = `${BASE}/rest/v2/uk`;

export interface CostcoApiProduct {
  code?: string;
  name?: string;
  url?: string;
  price?: {
    value?: number;
    formattedValue?: string;
    currencyIso?: string;
  };
  images?: { url?: string; format?: string }[];
}

export function extractCostcoProductCode(url: string): string | null {
  const match = url.match(/\/p\/(\d+(?:_BD)?)\/?(?:\?|#|$)/i);
  return match?.[1] ?? null;
}

export function isCostcoProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.toLowerCase().includes("costco") &&
      /\/p\/\d+/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export function costcoProductUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return `${BASE}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function costcoImageUrl(images?: CostcoApiProduct["images"]): string | undefined {
  if (!images?.length) return undefined;
  const preferred =
    images.find((i) => i.format === "product-webp") ??
    images.find((i) => i.format === "product") ??
    images.find((i) => i.format === "thumbnail-webp") ??
    images[0];
  const path = preferred?.url;
  if (!path) return undefined;
  return path.startsWith("http") ? path : `${BASE}${path}`;
}

export async function fetchCostcoProductByCode(
  code: string,
): Promise<CostcoApiProduct | null> {
  const response = await fetch(
    `${REST_BASE}/products/${encodeURIComponent(code)}?fields=FULL`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; ShelfDeal/1.0; +https://shelfdeal.co.uk)",
      },
      cache: "no-store",
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Costco API HTTP ${response.status}`);
  }
  return (await response.json()) as CostcoApiProduct;
}

export async function searchCostcoViaApi(
  query: string,
  pageSize = 8,
): Promise<CostcoApiProduct[]> {
  const params = new URLSearchParams({
    query: query.trim(),
    pageSize: String(pageSize),
    fields: "FULL",
  });
  const response = await fetch(`${REST_BASE}/products/search?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (compatible; ShelfDeal/1.0; +https://shelfdeal.co.uk)",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Costco search HTTP ${response.status}`);
  }
  const data = (await response.json()) as { products?: CostcoApiProduct[] };
  return data.products ?? [];
}

function listingFromCostcoApiProduct(
  product: CostcoApiProduct,
  fetchedAt: string,
): RetailerListing | null {
  const name = product.name?.trim();
  const price = product.price?.value;
  if (!name || price == null || !Number.isFinite(price)) return null;

  const url = costcoProductUrl(product.url ?? `/p/${product.code ?? ""}`);
  const pack = extractPackInfo(name);
  const prices: PriceLine[] = [
    {
      kind: "standard",
      label: "Costco",
      amount: price,
      currency: "GBP",
    },
  ];

  return {
    retailerId: "costco",
    retailerName: "Costco",
    productName: name,
    url,
    imageUrl: costcoImageUrl(product.images),
    inStock: true,
    prices,
    sortPrice: price,
    fetchedAt,
    packSize:
      pack.isMultipack && pack.unitCount != null ? pack.unitCount : undefined,
    packLabel: pack.isMultipack ? pack.packLabel : undefined,
    note: "Costco membership required at checkout",
  };
}

export async function fetchCostcoPrice(url: string): Promise<RetailerListing> {
  const fetchedAt = new Date().toISOString();
  const code = extractCostcoProductCode(url);

  if (code) {
    try {
      const product = await fetchCostcoProductByCode(code);
      const fromApi = product
        ? listingFromCostcoApiProduct(product, fetchedAt)
        : null;
      if (fromApi) {
        return finalizeListingPricing(fromApi);
      }
    } catch {
      // Fall back to JSON-LD on product page.
    }
  }

  try {
    const html = await fetchHtml(costcoProductUrl(url), {
      referer: `${BASE}/`,
      warmUrl: `${BASE}/`,
    });
    const base = listingFromJsonLd("costco", costcoProductUrl(url), html);
    if (!base) {
      return unavailable(
        "costco",
        costcoProductUrl(url),
        fetchedAt,
        "Could not parse Costco product price",
      );
    }
    return finalizeListingPricing({
      ...base,
      note: "Costco membership required at checkout",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return unavailable("costco", costcoProductUrl(url), fetchedAt, message);
  }
}
