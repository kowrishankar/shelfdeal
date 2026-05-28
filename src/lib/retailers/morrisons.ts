import { fetchHtml } from "../http";
import { finalizeListingPricing } from "../pack-pricing";
import { decodeHtmlEntities } from "../text-normalize";
import type { RetailerListing } from "../types";
import { listingFromJsonLd, unavailable } from "./shared";

const SIZE_TOKEN =
  /\b(\d+(?:\.\d+)?\s*(?:ml|cl|l|ltr|litre|liter))\b/i;

/** First text inside Morrisons PDP `data-test="size-container"` (e.g. "70cl"). */
export function extractMorrisonsSizeFromHtml(html: string): string | null {
  const container = html.match(
    /data-test=["']size-container["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  if (!container?.[1]) return null;

  const firstSpan = container[1].match(/<span[^>]*>([^<]+)/i);
  if (!firstSpan?.[1]) return null;

  const text = decodeHtmlEntities(firstSpan[1].trim());
  const match = text.match(SIZE_TOKEN);
  if (!match?.[1]) return null;

  return match[1].replace(/\s+/g, "").toLowerCase();
}

export function isMorrisonsProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.toLowerCase().includes("morrisons") &&
      /\/products\//i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function productNameWithSize(name: string, size: string | null): string {
  if (!size) return name;
  const norm = name.toLowerCase();
  if (norm.includes(size.replace(/\s+/g, ""))) return name;
  return `${name} ${size}`;
}

export async function fetchMorrisonsPrice(url: string): Promise<RetailerListing> {
  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchHtml(url);
    const base = listingFromJsonLd("morrisons", url, html);
    const size = extractMorrisonsSizeFromHtml(html);

    if (!base) {
      return unavailable(
        "morrisons",
        url,
        fetchedAt,
        "Could not parse Morrisons product price",
      );
    }

    const listing: RetailerListing = {
      ...base,
      productName: productNameWithSize(base.productName, size),
      note: size ? `Size: ${size}` : base.note,
    };

    return finalizeListingPricing(listing, html);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return unavailable("morrisons", url, fetchedAt, message);
  }
}
