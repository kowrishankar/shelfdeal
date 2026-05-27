/**
 * Normalize text for fuzzy product search — accents, case, spacing.
 * e.g. "ciroc" matches "Cîroc", "cafe" matches "Café"
 */

const LIGATURES: [RegExp, string][] = [
  [/œ/g, "oe"],
  [/æ/g, "ae"],
  [/ß/g, "ss"],
];

export function stripDiacritics(text: string): string {
  let out = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [pattern, replacement] of LIGATURES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Lowercase, strip accents, collapse whitespace — for comparisons */
export function normalizeForMatch(text: string): string {
  return stripDiacritics(text).toLowerCase().replace(/\s+/g, " ").trim();
}

export function matchIncludes(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return normalizeForMatch(haystack).includes(normalizeForMatch(needle));
}

/** Unique search strings to try at retailers (original + accent-stripped if different) */
/** Decode common HTML entities in retailer product titles */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function expandSearchQueries(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const stripped = stripDiacritics(trimmed);
  const out = [trimmed];
  if (normalizeForMatch(stripped) !== normalizeForMatch(trimmed)) {
    out.push(stripped);
  }
  return [...new Set(out)];
}
