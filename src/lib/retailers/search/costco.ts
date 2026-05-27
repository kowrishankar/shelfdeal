import { fetchHtml } from "../../http";
import { extractJsonLdProducts, parseOfferPrice } from "../../parse-json-ld";
import type { RetailerSearchHit } from "./types";

export async function searchCostco(query: string): Promise<RetailerSearchHit[]> {
  const url = `https://www.costco.co.uk/search?text=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const hits: RetailerSearchHit[] = [];

  for (const m of html.matchAll(
    /href="(\/[^"]+\/p\/\d+)"[^>]*>[\s\S]{0,800}?<[^>]+>([^<]{5,100})</gi,
  )) {
    hits.push({
      retailerId: "costco",
      url: `https://www.costco.co.uk${m[1]}`,
      name: m[2].trim(),
    });
  }

  const products = extractJsonLdProducts(html);
  for (const p of products) {
    const offers = p.offers as { url?: string } | undefined;
    const offerUrl =
      typeof offers === "object" && offers && "url" in offers
        ? (offers as { url?: string }).url
        : undefined;
    if (p.name && offerUrl) {
      hits.push({
        retailerId: "costco",
        url: offerUrl,
        name: p.name,
      });
    }
  }

  const seen = new Set<string>();
  return hits
    .filter((h) => {
      if (seen.has(h.url)) return false;
      seen.add(h.url);
      return true;
    })
    .slice(0, 6);
}

export { parseOfferPrice };
