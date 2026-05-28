import { extractPackInfo } from "../../product-matching";
import {
  costcoProductUrl,
  searchCostcoViaApi,
} from "../costco";
import type { RetailerSearchHit } from "./types";

export async function searchCostco(query: string): Promise<RetailerSearchHit[]> {
  const products = await searchCostcoViaApi(query, 12);
  const seen = new Set<string>();
  const hits: RetailerSearchHit[] = [];

  for (const product of products) {
    if (product.price?.value == null) continue;
    const name = product.name?.trim();
    const path = product.url;
    if (!name || !path) continue;

    const url = costcoProductUrl(path);
    const dedupeKey = name.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const pack = extractPackInfo(name);
    hits.push({
      retailerId: "costco",
      url,
      name,
      packLabel: pack.isMultipack ? pack.packLabel : undefined,
      imageUrl: product.images?.find((i) => i.format === "product-webp")?.url
        ? costcoProductUrl(
            product.images.find((i) => i.format === "product-webp")!.url!,
          )
        : product.images?.[0]?.url
          ? costcoProductUrl(product.images[0].url)
          : undefined,
    });
  }

  return hits.slice(0, 8);
}
