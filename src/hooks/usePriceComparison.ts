"use client";

import { useCallback, useRef, useState } from "react";
import type { StreamEvent } from "@/lib/compare-stream";
import type { PriceComparisonState } from "@/lib/types";

const emptyState = (query = ""): PriceComparisonState => ({
  query,
  product: null,
  listings: [],
  isPartial: false,
  isComplete: false,
  fetchedAt: new Date().toISOString(),
});

function upsertListing(
  listings: PriceComparisonState["listings"],
  incoming: PriceComparisonState["listings"][0],
) {
  const idx = listings.findIndex((l) => l.retailerId === incoming.retailerId);
  if (idx >= 0) {
    const next = [...listings];
    next[idx] = incoming;
    return next;
  }
  return [...listings, incoming];
}

function sortListings(listings: PriceComparisonState["listings"]) {
  const priced = listings.filter((l) => l.prices.length > 0);
  const failed = listings.filter((l) => !l.prices.length);
  return [...priced.sort((a, b) => a.sortPrice - b.sortPrice), ...failed];
}

export function usePriceComparison() {
  const [result, setResult] = useState<PriceComparisonState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<AbortController | null>(null);

  const applyEvent = useCallback((event: StreamEvent, prev: PriceComparisonState) => {
    switch (event.type) {
      case "status":
        return { ...prev, statusMessage: event.message, phase: event.phase };
      case "product":
        return {
          ...prev,
          product: {
            id: event.product.id,
            name: event.product.canonicalName,
            barcode: event.product.barcode ?? undefined,
            imageUrl: event.product.imageUrl ?? undefined,
          },
        };
      case "listing": {
        const listings = sortListings(upsertListing(prev.listings, event.listing));
        const priced = listings.filter((l) => l.prices.length > 0);
        const listingImage = listings.find((l) => l.imageUrl)?.imageUrl;
        const product =
          prev.product && listingImage && !prev.product.imageUrl
            ? { ...prev.product, imageUrl: listingImage }
            : prev.product;
        return { ...prev, product, listings, cheapest: priced[0] };
      }
      case "done":
        return {
          ...prev,
          listings: sortListings(prev.listings),
          cheapest: event.cheapest ?? prev.cheapest,
          isPartial: event.partial ?? false,
          isComplete: !event.partial,
          fetchedAt: new Date().toISOString(),
          product: prev.product,
        };
      default:
        return prev;
    }
  }, []);

  const startComparison = useCallback(
    (
      query: string,
      productId?: string,
      options?: { selectionEncoded?: string },
    ) => {
      streamRef.current?.abort();
      const controller = new AbortController();
      streamRef.current = controller;

      setLoading(true);
      setError(null);
      setResult({
        ...emptyState(query),
        query,
        statusMessage: "Starting comparison…",
        phase: "discover",
      });

      const params = new URLSearchParams({ q: query });
      if (
        productId &&
        productId !== "new" &&
        !options?.selectionEncoded
      ) {
        params.set("productId", productId);
      }
      if (options?.selectionEncoded) params.set("sel", options.selectionEncoded);

      const source = new EventSource(`/api/compare/stream?${params}`);

      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as StreamEvent;
          if (event.type === "error") {
            setError(event.message);
            setLoading(false);
            source.close();
            return;
          }
          setResult((prev) => {
            if (!prev) return prev;
            const next = applyEvent(event, prev);
            if (event.type === "done" && !event.partial) setLoading(false);
            if (event.type === "done" && event.partial) setLoading(true);
            return next;
          });
          if (event.type === "done" && !event.partial) source.close();
        } catch {
          // ignore
        }
      };

      source.onerror = () => {
        setLoading(false);
        setError("Connection lost — try again");
        source.close();
      };

      controller.signal.addEventListener("abort", () => source.close());
    },
    [applyEvent],
  );

  const stop = useCallback(() => {
    streamRef.current?.abort();
    setLoading(false);
  }, []);

  return { result, loading, error, startComparison, stop, setError };
}
