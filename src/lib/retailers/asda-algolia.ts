import { extractPackInfo } from "../product-matching";
import { applyMultipackUnitPricing } from "../pack-pricing";
import type { PriceLine, RetailerListing } from "../types";
import { unavailable } from "./shared";

/** Public client-side Algolia credentials embedded in ASDA's grocery SPA */
export const ASDA_ALGOLIA = {
  appId: "8I6WSKCCNV",
  searchKey: "03e4272048dd17f771da37b57ff8a75e",
  index: "ASDA_PRODUCTS",
};

export interface AsdaAlgoliaProduct {
  CIN?: string;
  NAME?: string;
  IMAGE_ID?: string;
  PACK_SIZE?: string;
  SALES_TYPE?: string;
  PRICES?: {
    EN?: {
      OFFER?: string;
      PRICE?: number;
      PRICEPERUOM?: number;
      PRICEPERUOMFORMATTED?: string;
    };
  };
}

export function extractCinFromAsdaUrl(url: string): string | null {
  const match = url.match(/\/(\d{5,12})(?:\?|#|$)/);
  return match?.[1] ?? null;
}

/** True for grocery PDP URLs that include a CIN (catalogue id). */
export function isAsdaGroceriesProductUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host.includes("asda.com")) return false;
    return /\/groceries\/product\//i.test(url) && extractCinFromAsdaUrl(url) != null;
  } catch {
    return false;
  }
}

export function asdaProductUrl(cin: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://www.asda.com/groceries/product/${slug}/${cin}`;
}

export function asdaImageUrl(imageId?: string): string | undefined {
  if (!imageId) return undefined;
  return `https://asda.scene7.com/is/image/asdagroceries/${imageId}?fmt=webp`;
}

export async function fetchAsdaProductByCin(
  cin: string,
): Promise<AsdaAlgoliaProduct | null> {
  const endpoint = `https://${ASDA_ALGOLIA.appId}-dsn.algolia.net/1/indexes/${ASDA_ALGOLIA.index}/${cin}`;
  const response = await fetch(endpoint, {
    headers: {
      "X-Algolia-Application-Id": ASDA_ALGOLIA.appId,
      "X-Algolia-API-Key": ASDA_ALGOLIA.searchKey,
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`ASDA Algolia HTTP ${response.status}`);
  }

  return (await response.json()) as AsdaAlgoliaProduct;
}

export function listingFromAsdaAlgoliaProduct(
  product: AsdaAlgoliaProduct,
  url: string,
): RetailerListing | null {
  const name = product.NAME?.trim();
  const price = product.PRICES?.EN?.PRICE;
  if (!name || price == null || !Number.isFinite(price)) return null;

  const pack = extractPackInfo(`${name} ${product.PACK_SIZE ?? ""}`);
  const prices: PriceLine[] = [
    {
      kind: "standard",
      label: product.PRICES?.EN?.OFFER === "List" ? "ASDA" : "ASDA offer",
      amount: price,
      currency: "GBP",
    },
  ];

  const listing = applyMultipackUnitPricing({
    retailerId: "asda",
    retailerName: "ASDA",
    productName: name,
    url,
    imageUrl: asdaImageUrl(product.IMAGE_ID),
    inStock: true,
    prices,
    sortPrice: price,
    fetchedAt: new Date().toISOString(),
    packSize:
      pack.isMultipack && pack.unitCount != null ? pack.unitCount : undefined,
    packLabel: pack.isMultipack ? pack.packLabel : product.PACK_SIZE,
    note: "Price via ASDA catalogue API — confirm on asda.com",
  });

  return listing;
}

export async function fetchAsdaPrice(url: string): Promise<RetailerListing> {
  const fetchedAt = new Date().toISOString();
  const cin = extractCinFromAsdaUrl(url);

  if (!cin) {
    return unavailable("asda", url, fetchedAt, "Invalid ASDA product URL");
  }

  try {
    const product = await fetchAsdaProductByCin(cin);
    if (!product) {
      return unavailable("asda", url, fetchedAt, "Product not found in ASDA catalogue");
    }

    const productUrl =
      url.startsWith("http") ? url : asdaProductUrl(cin, product.NAME ?? "product");
    const listing = listingFromAsdaAlgoliaProduct(product, productUrl);
    if (listing) return listing;

    return unavailable(
      "asda",
      url,
      fetchedAt,
      "Could not read price from ASDA catalogue",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "ASDA fetch failed";
    return unavailable("asda", url, fetchedAt, message);
  }
}
