import { decodeBase64Url, encodeBase64Url } from "./base64url";
import type { RetailerSearchHit } from "./retailers/search/types";

export interface VariantSelectionPayload {
  name: string;
  listings: RetailerSearchHit[];
  /** Shown on product page before live fetch completes */
  displayName?: string;
  imageUrl?: string;
  /** Flavour picked on discovery (e.g. honey, original) */
  flavorKey?: string;
  flavorLabel?: string;
  brandLabel?: string;
}

export function encodeVariantSelection(payload: VariantSelectionPayload): string {
  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeVariantSelection(
  encoded: string,
): VariantSelectionPayload | null {
  try {
    const data = JSON.parse(decodeBase64Url(encoded)) as VariantSelectionPayload;
    if (!data.name || !Array.isArray(data.listings)) return null;
    return data;
  } catch {
    return null;
  }
}
