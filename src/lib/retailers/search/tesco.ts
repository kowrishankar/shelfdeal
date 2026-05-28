import { fetchHtml } from "../../http";
import { extractPackInfo } from "../../product-matching";
import { extractJsonLdProducts } from "../../parse-json-ld";
import { normalizeTescoProductUrl, searchTescoViaXapi } from "../tesco-xapi";
import { extractImageFromHtml, normalizeImageUrl } from "./images";
import type { RetailerSearchHit } from "./types";

function extractItemListUrls(html: string): string[] {
  const pattern =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const urls: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]) as Record<string, unknown>;
      const graph = (data["@graph"] as Record<string, unknown>[] | undefined) ?? [
        data,
      ];
      for (const node of graph) {
        if (node["@type"] === "ItemList" && Array.isArray(node.itemListElement)) {
          for (const item of node.itemListElement as { url?: string }[]) {
            if (item.url) urls.push(item.url);
          }
        }
      }
    } catch {
      // skip
    }
  }
  return urls;
}

interface TescoTile {
  title: string;
  imageUrl?: string;
  tpnc?: string;
}

/** Apollo cache blobs embedded in Tesco search HTML. */
function extractTescoApolloTiles(html: string): TescoTile[] {
  const tiles: TescoTile[] = [];
  const pattern =
    /"tpnc":"(\d+)"[\s\S]{0,800}?"title":"([^"]+)"(?:[\s\S]{0,500}?"defaultImageUrl":"([^"]+)")?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const title = match[2].replace(/\\u0027/g, "'");
    const imageUrl = match[3] ? normalizeImageUrl(match[3]) : undefined;
    if (!tiles.some((t) => t.tpnc === match![1])) {
      tiles.push({ tpnc: match[1], title, imageUrl });
    }
  }
  return tiles;
}

function extractTescoTiles(html: string): TescoTile[] {
  const apollo = extractTescoApolloTiles(html);
  if (apollo.length) return apollo;

  const tiles: TescoTile[] = [];
  const pattern =
    /"title":"([^"]{8,160})"[\s\S]{0,800}?"defaultImageUrl":"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const title = match[1].replace(/\\u0027/g, "'");
    const imageUrl = normalizeImageUrl(match[2]);
    if (!tiles.some((t) => t.title === title)) {
      tiles.push({ title, imageUrl });
    }
  }

  if (!tiles.length) {
    for (const m of html.matchAll(/"title":"([^"]{8,120})"/g)) {
      const title = m[1].replace(/\\u0027/g, "'");
      if (!tiles.some((t) => t.title === title)) tiles.push({ title });
    }
  }
  return tiles;
}

async function searchTescoHtml(query: string): Promise<RetailerSearchHit[]> {
  const url = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url, {
    warmUrl: "https://www.tesco.com/groceries/en-GB/",
    referer: "https://www.tesco.com/groceries/en-GB/",
    scraperProxy: Boolean(process.env.SCRAPER_API_KEY),
  });
  const productUrls = extractItemListUrls(html);
  const tiles = extractTescoTiles(html);

  const hits: RetailerSearchHit[] = [];
  for (let i = 0; i < productUrls.length; i++) {
    const productUrl = productUrls[i];
    const id = productUrl.match(/products\/(\d+)/)?.[1];
    const tile =
      tiles[i] ??
      tiles.find((t) =>
        t.title.toLowerCase().includes(query.split(" ")[0].toLowerCase()),
      );
    const name = tile?.title ?? `Tesco product ${id ?? ""}`;

    hits.push({
      retailerId: "tesco",
      url: normalizeTescoProductUrl(
        productUrl.startsWith("http")
        ? productUrl
          : `https://www.tesco.com${productUrl}`,
      ),
      name,
      packLabel: extractPackInfo(name).packLabel,
      imageUrl: tile?.imageUrl ?? extractImageFromHtml(html),
    });
  }

  if (hits.length === 0) {
    for (const tile of tiles.slice(0, 8)) {
      const id = tile.tpnc;
      if (!id) continue;
      hits.push({
        retailerId: "tesco",
        url: `https://www.tesco.com/shop/en-GB/products/${id}`,
        name: tile.title,
        packLabel: extractPackInfo(tile.title).packLabel,
        imageUrl: tile.imageUrl,
      });
    }
  }

  if (hits.length === 0) {
    const ids = [...html.matchAll(/\/shop\/en-GB\/products\/(\d{6,})/g)].map(
      (m) => m[1],
    );
    const unique = [...new Set(ids)].slice(0, 8);
    for (let i = 0; i < unique.length; i++) {
      const id = unique[i];
      const tile = tiles[i];
      hits.push({
        retailerId: "tesco",
        url: `https://www.tesco.com/shop/en-GB/products/${id}`,
        name: tile?.title ?? `Tesco product ${id}`,
        imageUrl: tile?.imageUrl,
      });
    }
  }

  return hits.slice(0, 8);
}

export async function searchTesco(query: string): Promise<RetailerSearchHit[]> {
  try {
    const fromApi = await searchTescoViaXapi(query);
    if (fromApi.length > 0) return fromApi;
  } catch {
    // HTML fallback (local dev or if xAPI is down)
  }
  return searchTescoHtml(query);
}

export async function extractTescoBarcode(url: string): Promise<string | undefined> {
  try {
    const html = await fetchHtml(normalizeTescoProductUrl(url), {
      warmUrl: "https://www.tesco.com/groceries/en-GB/",
      referer: "https://www.tesco.com/groceries/en-GB/",
      scraperProxy: Boolean(process.env.SCRAPER_API_KEY),
    });
    const products = extractJsonLdProducts(html);
    const gtin = (products[0] as { gtin13?: string })?.gtin13;
    return gtin;
  } catch {
    return undefined;
  }
}
