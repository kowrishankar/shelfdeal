import { decodeHtmlEntities, normalizeForMatch } from "@/lib/text-normalize";

export interface FlavorProfile {
  key: string;
  label: string;
}

/** Ordered — first match wins (specific flavours before Original). */
const FLAVOR_RULES: Array<{
  key: string;
  label: string;
  test: (text: string) => boolean;
}> = [
  { key: "blackberry", label: "Blackberry", test: (t) => /\bblackberry\b/.test(t) },
  { key: "raspberry", label: "Raspberry", test: (t) => /\braspberry\b/.test(t) },
  { key: "strawberry", label: "Strawberry", test: (t) => /\bstrawberry\b/.test(t) },
  { key: "cherry", label: "Cherry", test: (t) => /\bcherry\b/.test(t) },
  { key: "grapefruit", label: "Grapefruit", test: (t) => /\bgrapefruit\b/.test(t) },
  { key: "watermelon", label: "Watermelon", test: (t) => /\bwatermelon\b/.test(t) },
  { key: "mango", label: "Mango", test: (t) => /\bmango\b/.test(t) },
  { key: "peach", label: "Peach", test: (t) => /\bpeach\b/.test(t) },
  { key: "pineapple", label: "Pineapple", test: (t) => /\bpineapple\b/.test(t) },
  { key: "coconut", label: "Coconut", test: (t) => /\bcoconut\b/.test(t) },
  { key: "vanilla", label: "Vanilla", test: (t) => /\bvanilla\b/.test(t) },
  { key: "berry", label: "Berry", test: (t) => /\bberry\b/.test(t) },
  { key: "tropical", label: "Tropical", test: (t) => /\btropical\b/.test(t) },
  { key: "passion", label: "Passion", test: (t) => /\bpassion\b/.test(t) },
  { key: "guava", label: "Guava", test: (t) => /\bguava\b/.test(t) },
  { key: "blueberry", label: "Blueberry", test: (t) => /\bblueberry\b/.test(t) },
  {
    key: "honey",
    label: "Honey",
    test: (t) => /\b(honey|tennessee honey)\b/.test(t),
  },
  {
    key: "fire",
    label: "Fire",
    test: (t) => /\b(tennessee fire|\bfire\b|fireball)\b/.test(t),
  },
  {
    key: "apple",
    label: "Apple",
    test: (t) =>
      (/\btennessee apple\b/.test(t) || /\bapple\b/.test(t)) &&
      !/\bpineapple\b/.test(t),
  },
  {
    key: "sugar-free",
    label: "Sugar free",
    test: (t) => /\b(sugar free|sugarfree|zero|total zero)\b/.test(t),
  },
  { key: "lime", label: "Lime", test: (t) => /\blime\b/.test(t) },
  { key: "lemon", label: "Lemon", test: (t) => /\blemon\b/.test(t) },
  { key: "orange", label: "Orange", test: (t) => /\borange\b/.test(t) },
  { key: "cola", label: "Cola", test: (t) => /\bcola\b/.test(t) },
];

const EDITION_FLAVOR_PHRASES = [
  "red edition",
  "blue edition",
  "green edition",
  "pink edition",
  "white peach",
  "juneberry",
  "curuba",
  "elderflower",
  "sakura",
  "forest fruits",
  "citrus zest",
];

function editionFlavorFromTitle(name: string): FlavorProfile | null {
  const lower = name.toLowerCase();
  for (const phrase of EDITION_FLAVOR_PHRASES) {
    if (lower.includes(phrase)) {
      const key = phrase.replace(/\s+/g, "-");
      const label = phrase
        .replace(/\s+edition\b/, "")
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return { key, label };
    }
  }
  if (/\bedition\b/i.test(lower)) {
    const match = lower.match(
      /([a-z]+(?:\s+[a-z]+)?)\s+edition/,
    );
    if (match?.[1]) {
      const label = match[1]
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return { key: match[1].replace(/\s+/g, "-"), label };
    }
  }
  return null;
}

export function detectFlavorProfile(name: string): FlavorProfile {
  const t = normalizeForMatch(decodeHtmlEntities(name));

  for (const rule of FLAVOR_RULES) {
    if (rule.test(t)) {
      return { key: rule.key, label: rule.label };
    }
  }

  const fromEdition = editionFlavorFromTitle(name);
  if (fromEdition) return fromEdition;

  return { key: "original", label: "Original" };
}

export function stripSizeAndPackFromLabel(label: string): string {
  return decodeHtmlEntities(label)
    .replace(/\s*\d+(?:\.\d+)?\s*(?:ml|cl|l|ltr|litre|liter)\b/gi, "")
    .replace(/\s*\(\d+\s*(?:pack|pk|x).*?\)\s*$/i, "")
    .replace(/\s*\((?:single|single unit).*?\)\s*$/i, "")
    .replace(/\s+\d+\s*(?:pack|pk)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface FlavorGroupingInput {
  label: string;
  imageUrl?: string;
  retailerCount: number;
  score: number;
  confidence?: "high" | "medium" | "low";
}

export interface DiscoveryFlavorOption {
  key: string;
  label: string;
  imageUrl?: string;
  retailerCount: number;
  variantCount: number;
  /** Title sent to retailer search when this flavour is selected */
  searchText: string;
  confidence?: "high" | "medium" | "low";
}

function confidenceRank(c?: "high" | "medium" | "low"): number {
  if (c === "high") return 3;
  if (c === "medium") return 2;
  if (c === "low") return 1;
  return 0;
}

export function groupVariantsByFlavor(
  familyLabel: string,
  variants: FlavorGroupingInput[],
): DiscoveryFlavorOption[] {
  const buckets = new Map<
    string,
    {
      profile: FlavorProfile;
      variants: FlavorGroupingInput[];
      imageUrl?: string;
      retailerCount: number;
      confidence?: "high" | "medium" | "low";
    }
  >();

  for (const variant of variants) {
    const profile = detectFlavorProfile(variant.label);
    const existing = buckets.get(profile.key);
    if (!existing) {
      buckets.set(profile.key, {
        profile,
        variants: [variant],
        imageUrl: variant.imageUrl,
        retailerCount: variant.retailerCount,
        confidence: variant.confidence,
      });
      continue;
    }
    existing.variants.push(variant);
    existing.retailerCount = Math.max(existing.retailerCount, variant.retailerCount);
    if (!existing.imageUrl && variant.imageUrl) existing.imageUrl = variant.imageUrl;
    if (
      confidenceRank(variant.confidence) > confidenceRank(existing.confidence)
    ) {
      existing.confidence = variant.confidence;
    }
  }

  const options: DiscoveryFlavorOption[] = [];
  for (const bucket of buckets.values()) {
    const sorted = [...bucket.variants].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const stripped = best ? stripSizeAndPackFromLabel(best.label) : "";
    const searchText =
      stripped.length >= 4
        ? stripped
        : bucket.profile.key === "original"
          ? familyLabel
          : `${familyLabel} ${bucket.profile.label}`.trim();

    options.push({
      key: bucket.profile.key,
      label: bucket.profile.label,
      imageUrl: bucket.imageUrl,
      retailerCount: bucket.retailerCount,
      variantCount: sorted.length,
      searchText,
      confidence: bucket.confidence,
    });
  }

  const flavorOrder = (key: string) => {
    if (key === "original") return 0;
    const idx = FLAVOR_RULES.findIndex((r) => r.key === key);
    return idx >= 0 ? idx + 1 : 50;
  };

  return options.sort((a, b) => {
    const order = flavorOrder(a.key) - flavorOrder(b.key);
    if (order !== 0) return order;
    return b.retailerCount - a.retailerCount;
  });
}

export function formatVolumeLabel(sizeMl: number | null | undefined): string {
  if (sizeMl == null) return "Standard";
  if (sizeMl >= 1000 && sizeMl % 1000 === 0) return `${sizeMl / 1000}L`;
  if (sizeMl >= 100 && sizeMl % 10 === 0) return `${sizeMl / 10}cl`;
  return `${sizeMl}ml`;
}
