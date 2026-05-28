import { fetchHtml } from "../../http";
import { extractPackInfo } from "../../product-matching";
import { extractImageFromHtml, normalizeImageUrl } from "./images";
import type { RetailerSearchHit } from "./types";

function decodeName(name: string): string {
  return name.replace(/\\u0027/g, "'").replace(/\u00a3/g, "£");
}

function parseBookerServings(servings: string): string | null {
  if (!servings) return null;
  const nx = servings.match(/(\d+)\s*x\s*(\d+)\s*ml/i);
  if (nx) {
    const count = Number(nx[1]);
    return count > 1 ? `${count} x ${nx[2]}ml` : "Single unit";
  }
  if (/^1$/i.test(servings.trim()) || /each/i.test(servings)) {
    return "Single unit";
  }
  return servings.trim() || null;
}

export async function searchBooker(query: string): Promise<RetailerSearchHit[]> {
  const url = `https://www.booker.co.uk/products/product-search?keywords=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url, {
    warmOrigin: "https://www.booker.co.uk",
    referer: "https://www.booker.co.uk/",
  });
  const hits: RetailerSearchHit[] = [];

  const cardsMatch = html.match(
    /"productCards":\[([\s\S]*?)\],"showPrintProductListButton"/,
  );
  if (cardsMatch) {
    const block = cardsMatch[1];
    const cardPattern =
      /"id":"(\d+)"[^}]*"url":"([^"]+)"[^}]*"name":"([^"]+)"[^}]*"servings":\[([^\]]*)\][^}]*?(?:"image":"([^"]+)"|"thumbnail":"([^"]+)")?/g;
    let m: RegExpExecArray | null;
    while ((m = cardPattern.exec(block)) !== null) {
      const [, id, path, rawName, servingsRaw, imageA, imageB] = m;
      const name = decodeName(rawName);
      const servings = servingsRaw.replace(/\\u0022/g, '"').replace(/"/g, "");
      const packLabel = parseBookerServings(servings) ?? extractPackInfo(name).packLabel;
      const rawImage = imageA ?? imageB;
      const imageUrl = rawImage ? normalizeImageUrl(rawImage) : undefined;

      hits.push({
        retailerId: "booker",
        url: path.startsWith("http")
          ? path
          : `https://www.booker.co.uk${path.replace(/\\u0026/g, "&")}`,
        name,
        packLabel,
        imageUrl,
      });
    }
  }

  if (hits.length === 0) {
    const opMatch = html.match(/window\.renderedContentOp = (\{[\s\S]*?\});/);
    if (opMatch) {
      try {
        const data = JSON.parse(opMatch[1]) as {
          products?: { id: string; name: string }[];
        };
        for (const p of data.products ?? []) {
          const name = decodeName(p.name);
          hits.push({
            retailerId: "booker",
            url: `https://www.booker.co.uk/products/product?Code=${p.id}`,
            name,
            packLabel: extractPackInfo(name).packLabel,
          });
        }
      } catch {
        // ignore
      }
    }
  }

  const seen = new Set<string>();
  return hits.filter((h) => {
    const key = `${h.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
