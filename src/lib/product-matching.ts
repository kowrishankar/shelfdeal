/**
 * Deterministic product matching — scores titles/packs against search intent.
 */

import {
  decodeHtmlEntities,
  matchIncludes,
  normalizeForMatch,
  stripDiacritics,
} from "./text-normalize";

/** Flavour variants — penalised when the query does not name a flavour */
const SPIRIT_FLAVOR_WORDS = [
  "pineapple",
  "coconut",
  "red berry",
  "strawberry",
  "mango",
  "apple",
  "vanilla",
  "peach",
  "watermelon",
  "berry",
  "limonade",
  "passion",
  "tropical",
  "grapefruit",
  "cherry",
  "raspberry",
  "blueberry",
  "guava",
];

function volumeMlFromText(text: string): number | null {
  const norm = normalizeForMatch(text);
  const ml = norm.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (ml) return Math.round(Number(ml[1]));
  const cl = norm.match(/(\d+(?:\.\d+)?)\s*cl\b/);
  if (cl) return Math.round(Number(cl[1]) * 10);
  return null;
}

function queryMentionsFlavor(query: string): boolean {
  const q = normalizeForMatch(query);
  return SPIRIT_FLAVOR_WORDS.some((f) => q.includes(f));
}

function titleMentionsFlavor(title: string): boolean {
  const t = normalizeForMatch(title);
  return SPIRIT_FLAVOR_WORDS.some((f) => t.includes(f));
}

/** Every word in phrase must appear in title (order does not matter) */
function phraseWordsMatch(title: string, phrase: string): boolean {
  const words = normalizeForMatch(phrase)
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (!words.length) return true;
  const t = normalizeForMatch(title);
  return words.every((w) => t.includes(w));
}

export interface QueryIntent {
  raw: string;
  tokens: string[];
  volumeMl: number | null;
  wantsMultipack: boolean;
  wantsSingle: boolean;
  editionTerms: string[];
}

const EDITION_PHRASES = [
  "red edition",
  "blue edition",
  "green edition",
  "pink edition",
  "lilac edition",
  "coconut edition",
  "apricot edition",
  "tropical edition",
  "summer edition",
  "spring edition",
  "winter edition",
  "cherry edition",
  "sugarfree",
  "sugar free",
  "sugar-free",
  "zero",
  "total zero",
  "peach edition",
  "juneberry",
  "watermelon",
  "forest fruits",
  "grapefruit",
  "citrus zest",
  "sakura",
  "ice edition",
  "apple edition",
  "vanilla edition",
  "berry edition",
  "curuba edition",
  "elderflower edition",
];

const CORE_STOPWORDS = new Set([
  "pm",
  "rrp",
  "pack",
  "case",
  "each",
  "ml",
  "cl",
  "ltr",
  "litre",
  "can",
  "cans",
  "x",
]);

export function parseQueryIntent(query: string): QueryIntent {
  const raw = normalizeForMatch(query);
  const tokens = raw.split(/\s+/).filter((t) => t && !CORE_STOPWORDS.has(t));

  const mlMatch = raw.match(/(\d+)\s*ml\b/);
  const clMatch = raw.match(/(\d+)\s*cl\b/);
  const volumeMl = mlMatch
    ? Number(mlMatch[1])
    : clMatch
      ? Number(clMatch[1]) * 10
      : null;

  const wantsMultipack =
    /\b(\d+\s*x\s*\d+|x\s*\d+|multipack|multi pack)\b/i.test(raw) ||
    /\b(case|pack of|pack)\s*(of\s*)?\d+/i.test(raw) ||
    /\b\d+\s*pack\b/i.test(raw);

  const wantsSingle =
    !wantsMultipack &&
    (/\b(single|each|1\s*can|one can)\b/i.test(raw) ||
      (volumeMl != null && !/\bpack\b/i.test(raw)));

  const editionTerms = EDITION_PHRASES.filter((phrase) =>
    raw.includes(normalizeForMatch(phrase)),
  );

  return {
    raw,
    tokens,
    volumeMl,
    wantsMultipack,
    wantsSingle,
    editionTerms,
  };
}

export function extractPackInfo(text: string): {
  packLabel: string;
  isMultipack: boolean;
  unitCount: number | null;
} {
  const t = text.toLowerCase();

  const caseOf = t.match(/case\s+of\s+(\d+)(?:\s*x\s*(\d+))?/i);
  if (caseOf) {
    const n = Number(caseOf[2] ?? caseOf[1]);
    return {
      packLabel: caseOf[0],
      isMultipack: n > 1,
      unitCount: n,
    };
  }

  const packMatch = t.match(/(\d+)\s*pack\b/i);
  if (packMatch) {
    const n = Number(packMatch[1]);
    return {
      packLabel: `${n} pack`,
      isMultipack: n > 1,
      unitCount: n,
    };
  }

  const nx = t.match(/(\d+)\s*x\s*(\d+)\s*ml/i);
  if (nx) {
    const n = Number(nx[1]);
    return {
      packLabel: `${n} x ${nx[2]}ml`,
      isMultipack: n > 1,
      unitCount: n,
    };
  }

  const volThenX = t.match(/(\d+)\s*ml\s*x\s*(\d+)/i);
  if (volThenX) {
    const n = Number(volThenX[2]);
    return {
      packLabel: `${n} x ${volThenX[1]}ml`,
      isMultipack: n > 1,
      unitCount: n,
    };
  }

  const bareX = t.match(/\bx\s*(\d{2,3})\b/i);
  if (bareX) {
    const n = Number(bareX[1]);
    if (n > 1) {
      return {
        packLabel: `${n} pack`,
        isMultipack: true,
        unitCount: n,
      };
    }
  }

  if (t.includes("case of 1") || /\beach\b/i.test(t)) {
    return { packLabel: "Single unit", isMultipack: false, unitCount: 1 };
  }

  return { packLabel: "Single unit", isMultipack: false, unitCount: 1 };
}

const EDITION_ALIASES: Record<string, string> = {
  "sugar free": "sugarfree",
  sugarfree: "sugarfree",
  "sugar-free": "sugarfree",
  zero: "zero",
  "total zero": "zero",
};

export function detectEditionInTitle(title: string): string | null {
  const lower = title.toLowerCase();
  for (const phrase of EDITION_PHRASES) {
    if (lower.includes(phrase)) {
      return EDITION_ALIASES[phrase] ?? phrase.replace(/\s+/g, "-");
    }
  }
  if (/\benergy drink\b/i.test(lower) && !/edition/i.test(lower)) {
    return "classic";
  }
  return null;
}

function spiritFlavorKey(name: string): string {
  const t = normalizeForMatch(decodeHtmlEntities(name));
  for (const f of SPIRIT_FLAVOR_WORDS) {
    if (t.includes(f)) return f.replace(/\s+/g, "-");
  }
  if (/ultra premium|snap frost/.test(t)) return "original";
  return "plain";
}

/** Known multi-word product lines (whisky labels, etc.) */
const PRODUCT_LINE_PHRASES = [
  "red label",
  "black label",
  "blue label",
  "gold label",
  "green label",
  "white label",
  "double black",
  "green spot",
  "yellow spot",
  "red spot",
  "gold spot",
  "blue spot",
  "honey bourbon",
  "fireball",
  "jameson",
  "jack daniels",
  "johnnie walker",
  "smirnoff",
  "bacardi",
  "captain morgan",
  "red bull",
  "monster energy",
  "lucozade",
  "coca cola",
  "pepsi",
];

/**
 * Groups product variants into a family (e.g. all "Red Label" listings across retailers).
 */
export function productLineKey(query: string, productName: string): string {
  const q = normalizeForMatch(query);
  const n = normalizeForMatch(decodeHtmlEntities(productName));

  const sortedPhrases = [...PRODUCT_LINE_PHRASES].sort(
    (a, b) => b.length - a.length,
  );
  for (const phrase of sortedPhrases) {
    if (q.includes(phrase) && n.includes(phrase)) {
      return phrase.replace(/\s+/g, "-");
    }
  }

  const brand = extractBrandPhrase(query);
  if (brand && phraseWordsMatch(productName, brand)) {
    const brandKey = normalizeForMatch(brand)
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .join("-");
    const extra = q
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 3 &&
          !brandKey.includes(w) &&
          n.includes(w) &&
          !CORE_STOPWORDS.has(w),
      );
    if (extra.length) return `${brandKey}-${extra.sort().join("-")}`;
    return brandKey;
  }

  const typeStop = new Set([
    ...CORE_STOPWORDS,
    "vodka",
    "gin",
    "whisky",
    "whiskey",
    "rum",
    "beer",
    "wine",
    "spirit",
    "spirits",
    "label",
  ]);
  const qTokens = q.split(/\s+/).filter((w) => w.length >= 3 && !typeStop.has(w));
  const matched = qTokens.filter((w) => n.includes(w));
  if (matched.length >= 2) return matched.sort().join("-");

  return `solo-${variantGroupKey(productName)}`;
}

/** Stable key for grouping variants across retailers (edition + flavour + volume + pack) */
export function variantGroupKey(name: string, packLabel?: string): string {
  const edition = detectEditionInTitle(name) ?? "classic";
  const pack = extractPackInfo(`${name} ${packLabel ?? ""}`);
  const vol =
    volumeMlFromText(normalizeForMatch(name))?.toString() ??
    name.match(/(\d+)\s*ml/i)?.[1] ??
    "";
  const brand = name.toLowerCase().includes("red bull") ? "red bull" : "generic";
  const flavor = spiritFlavorKey(name);
  const packKey = pack.isMultipack
    ? `mp-${pack.unitCount ?? pack.packLabel}`
    : "single";
  return `${brand}|${edition}|${flavor}|${vol}|${packKey}`;
}

export function scoreProductMatch(
  query: string,
  title: string,
  packLabel?: string,
): number {
  const intent = parseQueryIntent(query);
  const cleanTitle = decodeHtmlEntities(title);
  const t = normalizeForMatch(cleanTitle);
  const combined = normalizeForMatch(`${cleanTitle} ${packLabel ?? ""}`);
  const pack = extractPackInfo(combined);

  let score = 0;

  for (const token of intent.tokens) {
    if (token.length >= 2 && t.includes(token)) score += 12;
  }

  if (matchIncludes(cleanTitle, intent.raw)) score += intent.tokens.length * 8;

  if (intent.volumeMl != null) {
    const titleVol = volumeMlFromText(t);
    if (titleVol != null && titleVol === intent.volumeMl) score += 25;
    else if (titleVol != null && Math.abs(titleVol - intent.volumeMl) <= 50) {
      score += 12;
    } else if (titleVol != null) score -= 12;
    else if (intent.volumeMl === 250 && /\b250\b/.test(t)) score += 10;
  }

  const titleEdition = detectEditionInTitle(title);
  if (intent.editionTerms.length > 0) {
    for (const ed of intent.editionTerms) {
      if (matchIncludes(title, ed)) score += 30;
    }
    if (titleEdition && titleEdition !== "classic") {
      const matches = intent.editionTerms.some((ed) => titleEdition.includes(ed));
      if (!matches) score -= 45;
    }
  } else {
    if (titleEdition && titleEdition !== "classic") score -= 40;
    if (titleEdition === "classic" || (t.includes("energy drink") && !/edition/i.test(t))) {
      score += 15;
    }
    if (
      /^red bull energy drink\s+\d+\s*ml/i.test(t) &&
      !/edition|sugar\s*free|zero|sugarfree/i.test(t)
    ) {
      score += 20;
    }
  }

  if (intent.wantsSingle && pack.isMultipack) score -= 55;
  if (intent.wantsSingle && /\bx\s*\d{2,3}\b/i.test(combined)) score -= 45;
  if (intent.wantsMultipack && !pack.isMultipack) score -= 20;
  if (intent.wantsMultipack && pack.isMultipack) score += 20;
  if (intent.wantsSingle && !pack.isMultipack) score += 25;

  if (/\b12\s*pack\b/i.test(combined) && intent.wantsSingle) score -= 35;
  if (/\b24\s*pack\b/i.test(combined) && intent.wantsSingle) score -= 35;

  if (/gift set|hamper|miniature|tasting|gift box|chocolate truffle/i.test(t)) {
    score -= 40;
  }
  if (/sponsored|go to review/i.test(t)) score -= 100;

  if (!queryMentionsFlavor(intent.raw)) {
    if (titleMentionsFlavor(cleanTitle)) score -= 45;
    if (
      /ultra premium|snap frost|original vodka/.test(t) &&
      !titleMentionsFlavor(cleanTitle)
    ) {
      score += 22;
    }
  }

  const brandPhrase = extractBrandPhrase(intent.raw);
  if (brandPhrase && !phraseWordsMatch(cleanTitle, brandPhrase)) score -= 35;

  return score;
}

/** Multi-word brand from query (e.g. "red bull", "coca cola") */
function extractBrandPhrase(query: string): string | null {
  const withoutVol = query
    .replace(/\d+\s*ml\b/gi, "")
    .replace(/\d+\s*cl\b/gi, "")
    .replace(/\b(single|pack|case|each)\b/gi, "")
    .trim();
  if (withoutVol.length >= 4 && withoutVol.split(/\s+/).length >= 2) {
    return withoutVol;
  }
  const first = withoutVol.split(/\s+/).filter(Boolean)[0];
  return first && first.length >= 4 ? first : null;
}

const RETAILER_QUERY_STOP = new Set([
  "flavoured",
  "flavored",
  "premium",
  "ultra",
  "bottle",
  "vol",
  "abv",
  "spirit",
  "spirits",
  "each",
  "unit",
  "single",
  "case",
  "gift",
  "box",
  "set",
]);

function cleanProductTitleForSearch(name: string): string {
  return decodeHtmlEntities(name)
    .replace(/\s+PM\s*£[\d.]+/gi, "")
    .replace(/\s+\d+\s*Pack.*$/i, "")
    .replace(/\s*\|.*$/g, "")
    .replace(/\d+(?:\.\d+)?\s*%\s*vol/gi, "")
    .replace(/\b(single unit|single|each|case of \d+)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function volumeSuffixForSearch(norm: string): string {
  const volMl = volumeMlFromText(norm);
  if (volMl == null) return "";
  if (volMl >= 100 && volMl % 10 === 0) return `${volMl / 10}cl`;
  return `${volMl}ml`;
}

/**
 * Short query UK retailer sites understand, e.g. "ciroc coconut 70cl".
 * Used when searching Tesco, Booker, ASDA, etc.
 */
export function buildRetailerSearchQuery(name: string, packLabel?: string): string {
  const combined = normalizeForMatch(
    `${cleanProductTitleForSearch(name)} ${packLabel ?? ""}`,
  );

  const words = combined
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !RETAILER_QUERY_STOP.has(w));

  const brand = words.find((w) => /^[a-z][a-z0-9'-]{2,}$/i.test(w)) ?? words[0];
  const flavor = SPIRIT_FLAVOR_WORDS.find((f) => combined.includes(f));
  const vol = volumeSuffixForSearch(combined);

  const parts: string[] = [];
  if (brand) parts.push(brand);
  if (flavor) parts.push(flavor);
  if (combined.includes("vodka") || combined.includes("gin") || combined.includes("whisky")) {
    const type = combined.includes("vodka")
      ? "vodka"
      : combined.includes("gin")
        ? "gin"
        : "whisky";
    if (!parts.includes(type)) parts.push(type);
  }
  if (vol) parts.push(vol);

  const query = parts.join(" ").trim();
  if (query.length >= 3) return query;

  return words.slice(0, 4).join(" ");
}

/** Queries to try at each retailer (shortest first — most likely to return hits) */
export function buildRetailerSearchQueries(
  name: string,
  packLabel?: string,
): string[] {
  const short = buildRetailerSearchQuery(name, packLabel);
  const clean = cleanProductTitleForSearch(name);
  const candidates = [
    short,
    short.replace(/\s+\d+(?:cl|ml)\b/i, "").trim(),
    wordsOnlyQuery(clean, 4),
    clean,
  ].filter((q) => q.length >= 3);

  const unique = new Set<string>();
  for (const q of candidates) {
    unique.add(q.trim());
    for (const expanded of [q, stripDiacritics(q)]) {
      if (expanded.trim()) unique.add(expanded.trim());
    }
  }
  return [...unique];
}

function wordsOnlyQuery(text: string, maxWords: number): string {
  const norm = normalizeForMatch(text);
  return norm
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !RETAILER_QUERY_STOP.has(w))
    .slice(0, maxWords)
    .join(" ");
}

/**
 * Canonical label for matching after retailer discovery.
 * Same as retailer search query — keeps brand, flavour, and size.
 */
export function buildVariantSearchQuery(name: string, packLabel?: string): string {
  return buildRetailerSearchQuery(name, packLabel);
}

export function pickBestMatch<T extends { name: string; packLabel?: string }>(
  query: string,
  hits: T[],
): T | undefined {
  if (!hits.length) return undefined;
  return [...hits].sort(
    (a, b) =>
      scoreProductMatch(query, b.name, b.packLabel) -
      scoreProductMatch(query, a.name, a.packLabel),
  )[0];
}
