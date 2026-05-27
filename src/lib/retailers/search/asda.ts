import { fetchHtml } from "../../http";
import { extractPackInfo } from "../../product-matching";
import type { RetailerSearchHit } from "./types";

/** Public client-side Algolia credentials embedded in ASDA's grocery SPA */
const DEFAULT_ALGOLIA = {
  appId: "8I6WSKCCNV",
  searchKey: "03e4272048dd17f771da37b57ff8a75e",
  index: "ASDA_PRODUCTS",
};

interface AsdaAlgoliaHit {
  CIN?: string;
  NAME?: string;
  IMAGE_ID?: string;
}

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
    const html = await fetchHtml("https://www.asda.com/groceries/search");
    return parseAlgoliaConfig(html) ?? DEFAULT_ALGOLIA;
  } catch {
    return DEFAULT_ALGOLIA;
  }
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function productUrl(cin: string, name: string): string {
  return `https://www.asda.com/groceries/product/${slugFromName(name)}/${cin}`;
}

function imageUrlFromHit(hit: AsdaAlgoliaHit): string | undefined {
  if (!hit.IMAGE_ID) return undefined;
  return `https://asda.scene7.com/is/image/asdagroceries/${hit.IMAGE_ID}?fmt=webp`;
}

async function searchAsdaAlgolia(
  query: string,
  config: AlgoliaConfig,
): Promise<RetailerSearchHit[]> {
  const url = `https://${config.appId}-dsn.algolia.net/1/indexes/${config.index}/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Algolia-Application-Id": config.appId,
      "X-Algolia-API-Key": config.searchKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      params: `query=${encodeURIComponent(query)}&hitsPerPage=8`,
    }),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`ASDA Algolia HTTP ${response.status}`);
  }

  const data = (await response.json()) as { hits?: AsdaAlgoliaHit[] };
  const hits: RetailerSearchHit[] = [];

  for (const item of data.hits ?? []) {
    if (!item.CIN || !item.NAME) continue;
    const name = item.NAME.trim();
    hits.push({
      retailerId: "asda",
      url: productUrl(item.CIN, name),
      name,
      packLabel: extractPackInfo(name).packLabel,
      imageUrl: imageUrlFromHit(item),
    });
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
  const html = await fetchHtml(searchUrl);
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
}
