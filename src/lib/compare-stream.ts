import {
  discoverAcrossRetailers,
  discoverAndResolveForSelection,
  resolveBestListings,
  DISCOVERY_RETAILERS,
} from "./retailers/search";
import {
  findProductByQuery,
  getListingsForProduct,
  getProductById,
  listingRowToRetailerListing,
  saveListingPrice,
  upsertProductWithListings,
  type DbListingRow,
  type DbProduct,
} from "./db/products";
import { finalizeAllListingPricing } from "./pack-pricing";
import { fetchRetailerPrice } from "./price-fetcher";
import { isAsdaGroceriesProductUrl } from "./retailers/asda-algolia";
import { RETAILER_NAMES } from "./retailers/shared";
import type { RetailerId, RetailerListing } from "./types";

export type StreamEvent =
  | { type: "status"; message: string; phase: "cache" | "discover" | "prices" }
  | { type: "product"; product: DbProduct }
  | { type: "listing"; listing: RetailerListing; fromCache?: boolean }
  | { type: "discovery"; retailerId: RetailerId; found: number }
  | {
      type: "done";
      cheapest?: RetailerListing;
      total: number;
      priced: number;
    }
  | { type: "error"; message: string };

const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

function isFresh(fetchedAt: string | null): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() < CACHE_MAX_AGE_MS;
}

function enrichListing(
  listing: RetailerListing,
  productName: string,
  fallbackImageUrl?: string | null,
  fallbackConfidenceLabel?: "high" | "medium" | "low" | null,
  fallbackConfidenceScore?: number | null,
): RetailerListing {
  return {
    ...listing,
    retailerName: RETAILER_NAMES[listing.retailerId],
    productName: listing.productName || productName,
    imageUrl: listing.imageUrl ?? fallbackImageUrl ?? undefined,
    matchConfidenceLabel:
      listing.matchConfidenceLabel ?? fallbackConfidenceLabel ?? undefined,
    matchConfidenceScore:
      listing.matchConfidenceScore ?? fallbackConfidenceScore ?? undefined,
  };
}

function rowToListing(
  row: DbListingRow,
  productName: string,
): RetailerListing | null {
  const cached = listingRowToRetailerListing(row, productName);
  if (!cached) return null;
  const [priced] = finalizeAllListingPricing([cached]);
  return enrichListing(priced, productName);
}

function syncPricedListings(
  pricedByRetailer: Map<RetailerId, RetailerListing>,
  queue: ReturnType<typeof createEventQueue>,
) {
  const finalized = finalizeAllListingPricing([...pricedByRetailer.values()]);
  for (const listing of finalized) {
    pricedByRetailer.set(listing.retailerId, listing);
    queue.push({ type: "listing", listing });
  }
}

function sortCheapest(listings: RetailerListing[]): RetailerListing | undefined {
  const priced = listings.filter((l) => l.prices.length > 0);
  if (!priced.length) return undefined;
  return [...priced].sort((a, b) => a.sortPrice - b.sortPrice)[0];
}

/** Async queue for progressive SSE events from parallel fetches */
function createEventQueue() {
  const buffer: StreamEvent[] = [];
  let resolveWait: (() => void) | null = null;
  let closed = false;

  return {
    push(event: StreamEvent) {
      buffer.push(event);
      resolveWait?.();
      resolveWait = null;
    },
    close() {
      closed = true;
      resolveWait?.();
      resolveWait = null;
    },
    async *consume(): AsyncGenerator<StreamEvent> {
      while (true) {
        if (buffer.length) {
          yield buffer.shift()!;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          resolveWait = resolve;
        });
      }
    },
  };
}

export async function* streamPriceComparison(
  query: string,
  productId?: string,
  preselected?: {
    canonicalName: string;
    listings: import("./db/products").DiscoveredListing[];
  },
): AsyncGenerator<StreamEvent> {
  const selectedName = preselected?.canonicalName?.trim();
  const searchQuery = selectedName ?? query;
  let product: DbProduct | null = null;
  let dbListings: DbListingRow[] = [];
  const pricedByRetailer = new Map<RetailerId, RetailerListing>();

  if (productId && !selectedName) {
    product = await getProductById(productId);
    if (product) dbListings = await getListingsForProduct(product.id);
  } else if (searchQuery && !selectedName) {
    product = await findProductByQuery(searchQuery);
    if (product) dbListings = await getListingsForProduct(product.id);
  }

  if (!selectedName && product && dbListings.length) {
    yield { type: "status", message: "Loading saved prices…", phase: "cache" };
    yield { type: "product", product };

    for (const row of dbListings) {
      if (isFresh(row.lastFetchedAt)) {
        const listing = rowToListing(row, product.canonicalName);
        if (listing) {
          pricedByRetailer.set(listing.retailerId, listing);
        }
      }
    }
    for (const listing of finalizeAllListingPricing([
      ...pricedByRetailer.values(),
    ])) {
      pricedByRetailer.set(listing.retailerId, listing);
      yield { type: "listing", listing, fromCache: true };
    }
  }

  const needsDiscovery =
    selectedName != null || !product || !dbListings.length;

  if (needsDiscovery) {
    yield {
      type: "status",
      message: selectedName
        ? `Finding “${selectedName}” across UK retailers…`
        : "Searching UK retailers…",
      phase: "discover",
    };

    let resolved: Awaited<
      ReturnType<typeof resolveBestListings | typeof discoverAndResolveForSelection>
    >;

    if (selectedName) {
      const selectionResult = await discoverAndResolveForSelection(selectedName);
      for (const retailerId of DISCOVERY_RETAILERS) {
        yield {
          type: "discovery",
          retailerId,
          found: selectionResult.discoveryCounts[retailerId] ?? 0,
        };
      }
      resolved = selectionResult;
    } else {
      const hits = await discoverAcrossRetailers(searchQuery);
      for (const retailerId of DISCOVERY_RETAILERS) {
        const found = hits.filter((h) => h.retailerId === retailerId).length;
        yield { type: "discovery", retailerId, found };
      }
      if (!hits.length) {
        yield {
          type: "error",
          message: "No products found. Try a more specific name or barcode.",
        };
        return;
      }
      resolved = await resolveBestListings(searchQuery, hits);
    }

    if (!resolved.listings.length) {

      yield {
        type: "error",
        message: selectedName
          ? `Could not match “${selectedName}” at any retailer. Try another variant.`
          : "No matching products at retailers.",
      };
      return;
    }

    const saved = await upsertProductWithListings(
      searchQuery,
      resolved.canonicalName,
      resolved.listings,
      resolved.barcode,
      resolved.imageUrl,
    );
    product = saved.product;
    dbListings = saved.listings;
    yield { type: "product", product };
  }

  yield {
    type: "status",
    message: "Fetching live prices…",
    phase: "prices",
  };

  const toFetch = dbListings.filter((row) => {
    const retailerKey = isAsdaGroceriesProductUrl(row.url) ? "asda" : row.retailerId;
    return !pricedByRetailer.has(retailerKey);
  });

  const queue = createEventQueue();
  let finishedCount = 0;

  void (async () => {
    await Promise.all(
      toFetch.map(async (row) => {
        try {
          const live = await fetchRetailerPrice(
            isAsdaGroceriesProductUrl(row.url) ? "asda" : row.retailerId,
            row.url,
          );
          const listing = enrichListing(
            live,
            row.retailerProductName ?? product!.canonicalName,
            row.imageUrl,
            row.matchConfidenceLabel,
            row.matchConfidenceScore,
          );
          if (listing.prices.length) {
            await saveListingPrice(row.id, listing);
          }
          pricedByRetailer.set(listing.retailerId, listing);
          syncPricedListings(pricedByRetailer, queue);
        } catch {
          const cached = rowToListing(row, product!.canonicalName);
          const listing =
            cached ??
            enrichListing(
              {
                retailerId: row.retailerId,
                retailerName: RETAILER_NAMES[row.retailerId],
                productName: product!.canonicalName,
                url: row.url,
                inStock: false,
                prices: [],
                sortPrice: 0,
                fetchedAt: new Date().toISOString(),
                error: "Price fetch failed",
              },
              product!.canonicalName,
              row.imageUrl,
              row.matchConfidenceLabel,
              row.matchConfidenceScore,
            );
          pricedByRetailer.set(listing.retailerId, listing);
          syncPricedListings(pricedByRetailer, queue);
        } finally {
          finishedCount += 1;
          if (finishedCount === toFetch.length) {
            const priced = [...pricedByRetailer.values()].filter(
              (l) => l.prices.length > 0,
            );
            queue.push({
              type: "done",
              cheapest: sortCheapest(priced),
              total: dbListings.length,
              priced: priced.length,
            });
            queue.close();
          }
        }
      }),
    );

    if (toFetch.length === 0) {
      const priced = [...pricedByRetailer.values()].filter(
        (l) => l.prices.length > 0,
      );
      queue.push({
        type: "done",
        cheapest: sortCheapest(priced),
        total: dbListings.length,
        priced: priced.length,
      });
      queue.close();
    }

    void import("./intelligence/service")
      .then(({ getOrComputeIntelligence }) => getOrComputeIntelligence(product!.id))
      .catch(() => undefined);
  })();

  for await (const event of queue.consume()) {
    yield event;
  }
}
