import { fetchHtml } from "../../http";
import { extractPackInfo, scoreProductMatch } from "../../product-matching";
import { extractImageFromHtml } from "./images";
import type { RetailerSearchHit } from "./types";

function extractTitleFromChunk(chunk: string): string | null {
  const patterns = [
    /<span class="a-size-base-plus a-color-base a-text-normal">([^<]+)<\/span>/,
    /<span class="a-size-medium a-color-base a-text-normal">([^<]+)<\/span>/,
    /<span class="a-size-base a-color-base a-text-normal">([^<]+)<\/span>/,
    /<h2[^>]*>[\s\S]*?<span[^>]*>([^<]{10,})<\/span>/,
  ];
  for (const pat of patterns) {
    const m = chunk.match(pat);
    if (m?.[1] && m[1].length > 10) return m[1].trim();
  }
  const aria = chunk.match(/aria-label="([^"]{15,140})"/);
  if (
    aria?.[1] &&
    !aria[1].includes("Go to review") &&
    !aria[1].includes("Sponsored") &&
    !aria[1].includes("Leave ad feedback") &&
    !aria[1].includes("Rated ")
  ) {
    return aria[1].trim();
  }
  return null;
}

function parseAmazonHtml(
  html: string,
  query: string,
  seen: Set<string>,
): RetailerSearchHit[] {
  const hits: RetailerSearchHit[] = [];
  const brandRequired = query.toLowerCase().includes("red bull");

  for (const m of html.matchAll(/data-asin="(B[A-Z0-9]{9})"/g)) {
    const asin = m[1];
    if (seen.has(asin)) continue;
    seen.add(asin);

    const chunk = html.slice(m.index ?? 0, (m.index ?? 0) + 15000);
    const name = extractTitleFromChunk(chunk);
    if (!name) continue;

    const lower = name.toLowerCase();
    if (brandRequired && !lower.includes("red bull")) continue;

    const { packLabel } = extractPackInfo(name);

    hits.push({
      retailerId: "amazon",
      url: `https://www.amazon.co.uk/dp/${asin}`,
      name,
      packLabel,
      imageUrl: extractImageFromHtml(chunk),
    });
  }

  return hits;
}

export async function searchAmazon(query: string): Promise<RetailerSearchHit[]> {
  const seen = new Set<string>();
  const queries = [query];
  const intent = query.toLowerCase();
  if (intent.includes("red bull") && intent.includes("250")) {
    queries.push("red bull energy drink 250ml");
  }

  let hits: RetailerSearchHit[] = [];
  for (const q of queries) {
    const url = `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}`;
    const html = await fetchHtml(url, {
      cookie: "i18n-prefs=GBP; lc-acbuk=en_GB",
    });
    hits.push(...parseAmazonHtml(html, query, seen));
    const best = hits.reduce(
      (max, h) => Math.max(max, scoreProductMatch(query, h.name, h.packLabel)),
      -999,
    );
    if (hits.length >= 3 && best >= 70) break;
  }

  return hits
    .sort(
      (a, b) =>
        scoreProductMatch(query, b.name, b.packLabel) -
        scoreProductMatch(query, a.name, a.packLabel),
    )
    .slice(0, 10);
}
