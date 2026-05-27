export interface JsonLdProduct {
  name?: string;
  image?: string | string[];
  offers?: {
    price?: number | string;
    priceCurrency?: string;
    availability?: string;
  };
}

function normalizeProducts(data: unknown): JsonLdProduct[] {
  if (!data || typeof data !== "object") return [];

  const record = data as Record<string, unknown>;
  const graph = record["@graph"];
  if (Array.isArray(graph)) {
    return graph.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as Record<string, unknown>)["@type"] === "Product",
    ) as JsonLdProduct[];
  }

  if (record["@type"] === "Product" || record["@type"] === "product") {
    return [record as JsonLdProduct];
  }

  return [];
}

export function extractJsonLdProducts(html: string): JsonLdProduct[] {
  const pattern =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const products: JsonLdProduct[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      products.push(...normalizeProducts(parsed));
    } catch {
      // ignore malformed blocks
    }
  }

  return products;
}

export function parseOfferPrice(
  offers: JsonLdProduct["offers"],
): number | undefined {
  if (!offers?.price) return undefined;
  const value =
    typeof offers.price === "string"
      ? parseFloat(offers.price.replace(/[^0-9.]/g, ""))
      : offers.price;
  return Number.isFinite(value) ? value : undefined;
}

export function isInStock(availability?: string): boolean {
  if (!availability) return true;
  const lower = availability.toLowerCase();
  return !lower.includes("outofstock") && !lower.includes("out_of_stock");
}

export function firstImage(image?: string | string[]): string | undefined {
  if (!image) return undefined;
  return Array.isArray(image) ? image[0] : image;
}
