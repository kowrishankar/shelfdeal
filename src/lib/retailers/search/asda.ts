import { fetchHtml } from "../../http";
import { extractPackInfo } from "../../product-matching";
import {
  ASDA_ALGOLIA,
  asdaImageUrl,
  asdaProductUrl,
  fetchAsdaProductByCin,
  type AsdaAlgoliaProduct,
} from "../asda-algolia";
import type { RetailerSearchHit } from "./types";

interface AlgoliaConfig {
  appId: string;
  searchKey: string;
  index: string;
}

function parseAlgoliaConfig(html: string): AlgoliaConfig | null {
  const block = html.match(/"algolia":\{([^}]+)\}/);
  if (!block) return null;
  const appId = block[1].match(/"appId":"([^"]+)"/)?.[1];
  const searchKey = block[1].match(/"searchAPIKey":"([^"]+)"/)?.[1];
  const index = block[1].match(/"productsIndex":"([^"]+)"/)?.[1];
  if (!appId || !searchKey || !index) return null;
  return { appId, searchKey, index };
}

async function resolveAlgoliaConfig(): Promise<AlgoliaConfig> {
  try {
    const html = await fetchHtml("https://www.asda.com/groceries/search", {
      referer: "https://www.asda.com/",
    });
    return parseAlgoliaConfig(html) ?? ASDA_ALGOLIA;
  } catch {
    return ASDA_ALGOLIA;
  }
}

function hitFromAlgoliaItem(item: AsdaAlgoliaProduct): RetailerSearchHit | null {
  if (!item.CIN || !item.NAME) return null;
  const name = item.NAME.trim();
  return {
    retailerId: "asda",
    url: asdaProductUrl(item.CIN, name),
    name,
    packLabel: extractPackInfo(`${name} ${item.PACK_SIZE ?? ""}`).packLabel,
    imageUrl: asdaImageUrl(item.IMAGE_ID),
  };
}

async function searchAsdaAlgolia(
  query: string,
  config: AlgoliaConfig,
): Promise<RetailerSearchHit[]> {
  const endpoint = `https://${config.appId}-dsn.algolia.net/1/indexes/${config.index}/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-Algolia-Application-Id": config.appId,
      "X-Algolia-API-Key": config.searchKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      params: `query=${encodeURIComponent(query)}&hitsPerPage=8`,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ASDA Algolia HTTP ${response.status}`);
  }

  const data = (await response.json()) as { hits?: AsdaAlgoliaProduct[] };
  const hits: RetailerSearchHit[] = [];

  for (const item of data.hits ?? []) {
    const hit = hitFromAlgoliaItem(item);
    if (hit) hits.push(hit);
  }

  return hits;
}

export async function searchAsda(query: string): Promise<RetailerSearchHit[]> {
  const config = await resolveAlgoliaConfig();
  try {
    const hits = await searchAsdaAlgolia(query, config);
    if (hits.length) return hits;
  } catch {
    // fall through to HTML scrape
  }

  const searchUrl = `https://www.asda.com/groceries/search/${encodeURIComponent(query)}`;
  try {
    const html = await fetchHtml(searchUrl, { referer: "https://www.asda.com/" });
    const fallbackHits: RetailerSearchHit[] = [];

    for (const m of html.matchAll(
      /\/groceries\/product\/([a-z0-9-]+)\/(\d+)/gi,
    )) {
      const [, pathSlug, id] = m;
      fallbackHits.push({
        retailerId: "asda",
        url: `https://www.asda.com/groceries/product/${pathSlug}/${id}`,
        name: query,
      });
    }

    const seen = new Set<string>();
    return fallbackHits
      .filter((h) => {
        if (seen.has(h.url) || h.url.includes("/search/")) return false;
        seen.add(h.url);
        return true;
      })
      .slice(0, 8);
  } catch {
    return [];
  }
}

export { fetchAsdaProductByCin };
