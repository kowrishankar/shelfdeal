import type { RetailerId } from "../../types";
import {
  buildRetailerSearchQueries,
  pickBestMatch,
  scoreProductMatch,
} from "../../product-matching";
import { expandSearchQueries } from "../../text-normalize";
import type { RetailerSearchHit } from "./types";
import { searchTesco, extractTescoBarcode } from "./tesco";
import { searchBooker } from "./booker";
import { searchAmazon } from "./amazon";
import { searchCostco } from "./costco";
import { searchSainsburys } from "./sainsburys";
import { searchAsda } from "./asda";
import { searchMorrisons } from "./morrisons";

const SEARCHERS: Record<
  RetailerId,
  ((query: string) => Promise<RetailerSearchHit[]>) | null
> = {
  tesco: searchTesco,
  booker: searchBooker,
  amazon: searchAmazon,
  costco: searchCostco,
  sainsburys: searchSainsburys,
  asda: searchAsda,
  morrisons: searchMorrisons,
  ocado: null,
};

export const DISCOVERY_RETAILERS: RetailerId[] = [
  "tesco",
  "asda",
  "morrisons",
  "booker",
  "amazon",
  "costco",
  "sainsburys",
];

export async function discoverAcrossRetailers(
  query: string,
  onRetailerDone?: (retailerId: RetailerId, hits: RetailerSearchHit[]) => void,
): Promise<RetailerSearchHit[]> {
  const queries = expandSearchQueries(query);
  const allHits: RetailerSearchHit[] = [];
  const seen = new Set<string>();

  const addHits = (retailerId: RetailerId, hits: RetailerSearchHit[]) => {
    for (const h of hits) {
      const key = `${h.retailerId}:${h.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allHits.push(h);
    }
    onRetailerDone?.(retailerId, hits);
  };

  await Promise.all(
    DISCOVERY_RETAILERS.map(async (retailerId) => {
      const search = SEARCHERS[retailerId];
      if (!search) return;
      const retailerHits: RetailerSearchHit[] = [];
      try {
        for (const q of queries) {
          const hits = await search(q);
          for (const h of hits) {
            const key = `${h.retailerId}:${h.url}`;
            if (!seen.has(key)) retailerHits.push(h);
          }
        }
        addHits(retailerId, retailerHits);
      } catch {
        onRetailerDone?.(retailerId, []);
      }
    }),
  );

  return allHits;
}

const MIN_SELECTION_SCORE = 25;
const MIN_FALLBACK_SCORE = 12;

async function barcodeFromListings(
  listings: RetailerSearchHit[],
): Promise<string | undefined> {
  const tesco = listings.find((l) => l.retailerId === "tesco");
  if (tesco) return extractTescoBarcode(tesco.url);
  return undefined;
}

function acceptSelectionMatch(
  selected: string,
  best: RetailerSearchHit,
  hitCount: number,
): boolean {
  const score = scoreProductMatch(selected, best.name, best.packLabel);
  if (score >= MIN_SELECTION_SCORE) return true;
  return hitCount > 0 && score >= MIN_FALLBACK_SCORE;
}

/**
 * Match dropdown selection across every retailer.
 * Searches each retailer with the selected title (not variant URLs).
 */
export async function discoverAndResolveForSelection(selectedName: string): Promise<{
  canonicalName: string;
  listings: RetailerSearchHit[];
  barcode?: string;
  imageUrl?: string;
  discoveryCounts: Partial<Record<RetailerId, number>>;
}> {
  const selected = selectedName.trim();
  const bestPerRetailer = new Map<RetailerId, RetailerSearchHit>();
  const discoveryCounts: Partial<Record<RetailerId, number>> = {};

  const retailerQueries = buildRetailerSearchQueries(selected);

  await Promise.all(
    DISCOVERY_RETAILERS.map(async (retailerId) => {
      const search = SEARCHERS[retailerId];
      if (!search) {
        discoveryCounts[retailerId] = 0;
        return;
      }
      try {
        const retailerHits: RetailerSearchHit[] = [];
        const seen = new Set<string>();
        for (const q of retailerQueries) {
          for (const h of await search(q)) {
            const key = `${h.retailerId}:${h.url}`;
            if (!seen.has(key)) {
              seen.add(key);
              retailerHits.push(h);
            }
          }
        }
        discoveryCounts[retailerId] = retailerHits.length;
        const best = pickBestMatch(selected, retailerHits);
        if (best && acceptSelectionMatch(selected, best, retailerHits.length)) {
          bestPerRetailer.set(retailerId, best);
        } else if (best && retailerHits.length > 0) {
          const score = scoreProductMatch(selected, best.name, best.packLabel);
          if (score >= 8) bestPerRetailer.set(retailerId, best);
        }
      } catch {
        discoveryCounts[retailerId] = 0;
      }
    }),
  );

  const listings = [...bestPerRetailer.values()];

  return {
    canonicalName: selected,
    listings,
    barcode: await barcodeFromListings(listings),
    imageUrl: listings.find((l) => l.imageUrl)?.imageUrl,
    discoveryCounts,
  };
}

/** @deprecated Use discoverAndResolveForSelection — kept for tests */
export async function resolveListingsForSelection(
  selectedName: string,
  hits: RetailerSearchHit[],
): Promise<{
  canonicalName: string;
  listings: RetailerSearchHit[];
  barcode?: string;
  imageUrl?: string;
}> {
  const { discoveryCounts: _, ...result } = await discoverAndResolveForSelection(
    selectedName,
  );
  void hits;
  return result;
}

export async function resolveBestListings(
  query: string,
  hits: RetailerSearchHit[],
): Promise<{
  canonicalName: string;
  listings: RetailerSearchHit[];
  barcode?: string;
  imageUrl?: string;
}> {
  const bestPerRetailer = new Map<RetailerId, RetailerSearchHit>();

  for (const retailerId of DISCOVERY_RETAILERS) {
    const retailerHits = hits.filter((h) => h.retailerId === retailerId);
    const best = pickBestMatch(query, retailerHits);
    if (best) bestPerRetailer.set(retailerId, best);
  }

  const listings = [...bestPerRetailer.values()];
  const canonical =
    pickBestMatch(query, listings)?.name ??
    listings[0]?.name ??
    query.trim();

  return {
    canonicalName: canonical,
    listings,
    barcode: await barcodeFromListings(listings),
    imageUrl: listings.find((l) => l.imageUrl)?.imageUrl,
  };
}
