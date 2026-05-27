import type { RetailerId, RetailerListing } from "./types";
import {
  applyMultipackUnitPricing,
  reorderWholesalePrices,
} from "./pack-pricing";
import {
  fetchJsonLdListing,
  listingFromJsonLd,
  parseAmazonPrice,
  parseBookerPricing,
  parseTescoClubcardMeta,
  unavailable,
} from "./retailers/shared";
import { fetchAsdaPrice } from "./retailers/asda-algolia";
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
  return fetchJsonLdListing("tesco", url, (html, base) => {
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

    if (prices.length === 0) return base;

    const sortPrice = Math.min(...prices.map((p) => p.amount));
    const product = base ?? listingFromJsonLd("tesco", url, html);

    return {
      retailerId: "tesco",
      retailerName: "Tesco",
      productName: product?.productName ?? "Product",
      url,
      imageUrl: product?.imageUrl,
      inStock: product?.inStock ?? true,
      prices,
      sortPrice,
      fetchedAt: new Date().toISOString(),
      note: club.until ? `Clubcard offer until ${club.until}` : undefined,
    };
  });
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

async function fetchAmazon(url: string): Promise<RetailerListing> {
  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchHtml(url, {
      cookie: "i18n-prefs=GBP; lc-acbuk=en_GB",
    });
    const price = parseAmazonPrice(html);
    const base = listingFromJsonLd("amazon", url, html);

    if (price === undefined && !base) {
      return unavailable("amazon", url, fetchedAt, "Price hidden — view on Amazon");
    }

    const prices = base?.prices.length
      ? base.prices
      : price !== undefined
        ? [
            {
              kind: "standard" as const,
              label: "Amazon",
              amount: price,
              currency: "GBP" as const,
            },
          ]
        : [];

    return {
      retailerId: "amazon",
      retailerName: "Amazon",
      productName: base?.productName ?? "Product",
      url,
      imageUrl: base?.imageUrl,
      inStock: base?.inStock ?? true,
      prices,
      sortPrice: Math.min(...prices.map((p) => p.amount)),
      fetchedAt,
      note: "Amazon price may vary by seller",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return unavailable("amazon", url, fetchedAt, message);
  }
}

export async function fetchRetailerPrice(
  retailerId: RetailerId,
  url: string,
): Promise<RetailerListing> {
  let listing: RetailerListing;
  switch (retailerId) {
    case "tesco":
      listing = await fetchTesco(url);
      break;
    case "booker":
      listing = await fetchBooker(url);
      break;
    case "amazon":
      listing = await fetchAmazon(url);
      break;
    case "asda":
      listing = await fetchAsdaPrice(url);
      break;
    default:
      listing = await fetchJsonLdListing(retailerId, url);
  }

  if (listing.prices.length > 0 && retailerId !== "booker") {
    return applyMultipackUnitPricing(listing);
  }
  return listing;
}
