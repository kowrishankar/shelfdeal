import { normalizeForMatch, stripDiacritics } from "./text-normalize";

export function normalizeQuery(query: string): string {
  return normalizeForMatch(query);
}

export function slugify(text: string): string {
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function productSlug(name: string, query: string): string {
  const base = slugify(name) || slugify(query) || "product";
  const suffix = Buffer.from(normalizeQuery(query))
    .toString("base64url")
    .slice(0, 8);
  return `${base}-${suffix}`;
}
