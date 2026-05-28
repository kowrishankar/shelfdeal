import type { RetailerId, RetailerListing } from "./types";
import {
  applyMultipackUnitPricing,
  reorderWholesalePrices,
} from "./pack-pricing";
import {
  fetchJsonLdListing,
  listingFromJsonLd,
  parseBookerPricing,
  parseTescoClubcardMeta,
  unavailable,
} from "./retailers/shared";
import {
  fetchAsdaPrice,
  isAsdaGroceriesProductUrl,
} from "./retailers/asda-algolia";
import { fetchAmazonPrice, isAmazonProductUrl } from "./retailers/amazon";
import {
  fetchTescoProductViaXapi,
  normalizeTescoProductUrl,
} from "./retailers/tesco-xapi";
import { fetchHtml } from "./http";

export const ACTIVE_RETAILERS: RetailerId[] = [
  "asda",
  "tesco",
  "morrisons",
  "sainsburys",
  "amazon",
  "costco",
  "booker",
];

async function fetchTesco(url: string): Promise<RetailerListing> {
  const normalizedUrl = normalizeTescoProductUrl(url);
  try {
    const fromXapi = await fetchTescoProductViaXapi(normalizedUrl);
    if (fromXapi) return fromXapi;
  } catch {
    // Fallback to HTML parse for resilience.
  }

  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchHtml(normalizedUrl, {
      warmUrl: "https://www.tesco.com/groceries/en-GB/",
      referer: "https://www.tesco.com/groceries/en-GB/",
      scraperProxy: Boolean(process.env.SCRAPER_API_KEY),
    });
    const base = listingFromJsonLd("tesco", normalizedUrl, html);
    const club = parseTescoClubcardMeta(html);
    const prices = [];

    if (club.regular !== undefined) {
      prices.push({
        kind: "standard" as const,
        label: "Regular",
        amount: club.regular,
        currency: "GBP" as const,
      });
    }
    if (club.clubcard !== undefined) {
      prices.push({
        kind: "clubcard" as const,
        label: "Clubcard",
        amount: club.clubcard,
        currency: "GBP" as const,
      });
    }

    if (prices.length === 0) {
      if (base) return base;
      return unavailable(
        "tesco",
        normalizedUrl,
        fetchedAt,
        "Could not parse Tesco product price",
      );
    }

    const sortPrice = Math.min(...prices.map((p) => p.amount));
    const product = base ?? listingFromJsonLd("tesco", normalizedUrl, html);

    if (!product) {
      return unavailable(
        "tesco",
        normalizedUrl,
        fetchedAt,
        "Could not parse Tesco product details",
      );
    }

    return {
      retailerId: "tesco",
      retailerName: "Tesco",
      productName: product?.productName ?? "Product",
      url: normalizedUrl,
      imageUrl: product?.imageUrl,
      inStock: product?.inStock ?? true,
      prices,
      sortPrice,
      fetchedAt,
      note: club.until ? `Clubcard offer until ${club.until}` : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return unavailable("tesco", normalizedUrl, fetchedAt, message);
  }
}

async function fetchBooker(url: string): Promise<RetailerListing> {
  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchHtml(url);
    const parsed = parseBookerPricing(html);
    if (parsed.prices.length === 0) {
      return unavailable("booker", url, fetchedAt, "Could not parse Booker trade price");
    }

    const prices = reorderWholesalePrices(parsed.prices);
    const incVat = prices.find((p) => p.kind === "inc_vat")?.amount;
    const nameMatch = html.match(/"name":"([^"]{5,120})"/);

    const listing = applyMultipackUnitPricing({
      retailerId: "booker",
      retailerName: "Booker",
      productName: nameMatch?.[1]?.replace(/\\u0027/g, "'") ?? "Product",
      url,
      inStock: !html.includes('"status":"outOfStock"'),
      prices,
      sortPrice: incVat ?? prices[0].amount,
      fetchedAt,
      packSize: parsed.packSize,
      packLabel: parsed.packLabel,
      note: parsed.packSize
        ? `Wholesale ${parsed.packLabel} — per-unit & POR shown for shelf pricing`
        : "Wholesale — Booker account required at checkout",
    });

    return listing;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return unavailable("booker", url, fetchedAt, message);
  }
}

function normalizeRetailerId(retailerId: RetailerId | string): RetailerId {
  return String(retailerId).toLowerCase() as RetailerId;
}

export async function fetchRetailerPrice(
  retailerId: RetailerId,
  url: string,
): Promise<RetailerListing> {
  if (isAsdaGroceriesProductUrl(url)) {
    return fetchAsdaPrice(url);
  }
  if (isAmazonProductUrl(url)) {
    return fetchAmazonPrice(url);
  }

  const id = normalizeRetailerId(retailerId);
  let listing: RetailerListing;
  switch (id) {
    case "tesco":
      listing = await fetchTesco(url);
      break;
    case "booker":
      listing = await fetchBooker(url);
      break;
    case "amazon":
      listing = await fetchAmazonPrice(url);
      break;
    case "asda":
      listing = await fetchAsdaPrice(url);
      break;
    default:
      listing = await fetchJsonLdListing(id, url);
  }

  if (listing.prices.length > 0 && id !== "booker") {
    return applyMultipackUnitPricing(listing);
  }
  return listing;
}
