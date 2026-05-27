import { fetchHtml } from "../../http";
import type { RetailerSearchHit } from "./types";

export async function searchSainsburys(
  query: string,
): Promise<RetailerSearchHit[]> {
  const slug = query.trim().toLowerCase().replace(/\s+/g, "-");
  const url = `https://www.sainsburys.co.uk/gol-ui/SearchResults/${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);

  if (html.length < 2000) return [];

  const hits: RetailerSearchHit[] = [];

  for (const m of html.matchAll(
    /href="(\/gol-ui\/product\/[^"]+)"[^>]*>[\s\S]{0,400}?>([^<]{8,100})</gi,
  )) {
    hits.push({
      retailerId: "sainsburys",
      url: `https://www.sainsburys.co.uk${m[1]}`,
      name: m[2].trim(),
    });
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
