import { fetchHtml } from "../../http";
import { extractPackInfo } from "../../product-matching";
import type { RetailerSearchHit } from "./types";

const BASE = "https://groceries.morrisons.com";

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function extractItemListUrls(html: string): string[] {
  const pattern =
    /data-test=["']product-listing-structured-data["'][^>]*>([\s\S]*?)<\/script>/i;
  const match = html.match(pattern);
  if (!match) return [];

  try {
    const data = JSON.parse(match[1]) as {
      itemListElement?: { url?: string }[];
    };
    return (data.itemListElement ?? [])
      .map((item) => item.url)
      .filter((url): url is string => Boolean(url));
  } catch {
    return [];
  }
}

function hitFromProductPath(path: string): RetailerSearchHit | null {
  const match = path.match(/^\/products\/([^/]+)\/(\d+)\/?$/i);
  if (!match) return null;

  const [, slug, id] = match;
  const name = slugToTitle(slug);
  return {
    retailerId: "morrisons",
    url: `${BASE}/products/${slug}/${id}`,
    name,
    packLabel: extractPackInfo(name).packLabel,
  };
}

export async function searchMorrisons(
  query: string,
): Promise<RetailerSearchHit[]> {
  const url = `${BASE}/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const hits: RetailerSearchHit[] = [];
  const seen = new Set<string>();

  for (const fullUrl of extractItemListUrls(html)) {
    let path: string;
    try {
      path = new URL(fullUrl).pathname;
    } catch {
      continue;
    }
    const hit = hitFromProductPath(path);
    if (!hit || seen.has(hit.url)) continue;
    seen.add(hit.url);
    hits.push(hit);
  }

  if (hits.length === 0) {
    for (const m of html.matchAll(/href="(\/products\/[^"]+)"/gi)) {
      const hit = hitFromProductPath(m[1]);
      if (!hit || seen.has(hit.url)) continue;
      seen.add(hit.url);
      hits.push(hit);
    }
  }

  return hits.slice(0, 8);
}
