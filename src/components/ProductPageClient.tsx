"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePriceComparison } from "@/hooks/usePriceComparison";
import { ProductInsightsPanel } from "@/components/intelligence/ProductInsightsPanel";
import { PriceResults } from "@/components/PriceResults";
import { ShelfPricingPanel } from "@/components/ShelfPricingPanel";
import { TrackPriceButton } from "@/components/TrackPriceButton";
import { VariantSearchBar } from "@/components/VariantSearchBar";
import { decodeVariantSelection } from "@/lib/variant-selection";

interface ProductPageClientProps {
  productId: string;
  query: string;
  selectionEncoded?: string;
  /** Path to return to when user came from product picker (e.g. /search?q=…) */
  returnTo?: string;
}

export function ProductPageClient({
  productId,
  query,
  selectionEncoded,
  returnTo,
}: ProductPageClientProps) {
  const router = useRouter();
  const { result, loading, error, startComparison } = usePriceComparison();
  const started = useRef(false);
  const historyRecorded = useRef(false);
  const resolvedId = result?.product?.id ?? (productId !== "new" ? productId : null);
  const intelRefreshKey = result?.isComplete ? result.fetchedAt : "";

  const selection = selectionEncoded
    ? decodeVariantSelection(selectionEncoded)
    : null;
  const selectedName = selection?.name ?? query;
  const searchQuery = selectedName.trim();
  const previewImage = selection?.imageUrl;
  const previewName = selection?.displayName;

  useEffect(() => {
    started.current = false;
    historyRecorded.current = false;
  }, [searchQuery, selectionEncoded]);

  useEffect(() => {
    if (!searchQuery || started.current) return;
    started.current = true;
    startComparison(
      searchQuery,
      selectionEncoded ? undefined : productId === "new" ? undefined : productId,
      { selectionEncoded },
    );
  }, [searchQuery, productId, selectionEncoded, startComparison]);

  useEffect(() => {
    if (
      result?.product?.id &&
      productId === "new" &&
      result.product.id !== productId
    ) {
      const params = new URLSearchParams({ q: searchQuery });
      if (selectionEncoded) params.set("sel", selectionEncoded);
      if (returnTo) params.set("returnTo", returnTo);
      window.history.replaceState(
        null,
        "",
        `/product/${result.product.id}?${params}`,
      );
    }
  }, [result?.product?.id, productId, searchQuery, selectionEncoded, returnTo]);

  useEffect(() => {
    if (
      !result?.isComplete ||
      !resolvedId ||
      historyRecorded.current
    ) {
      return;
    }
    historyRecorded.current = true;
    void fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: resolvedId,
        queryText: searchQuery,
        productName: result.product?.name ?? searchQuery,
      }),
    });
  }, [result?.isComplete, resolvedId, searchQuery, result?.product?.name]);

  const handleSearch = (name: string) => {
    started.current = false;
    router.push(`/search?q=${encodeURIComponent(name)}`);
  };

  const displayName = result?.product?.name ?? previewName ?? searchQuery;
  const productImage =
    result?.product?.imageUrl ??
    result?.listings.find((l) => l.imageUrl)?.imageUrl ??
    previewImage;
  const backLabel = returnTo?.startsWith("/search") ? "All products" : "New search";

  function handleBack() {
    if (returnTo?.startsWith("/search")) {
      router.back();
      return;
    }
    router.push(returnTo ?? "/");
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-4">
      <button
        type="button"
        onClick={handleBack}
        className="link-accent inline-flex items-center gap-1"
      >
        ← {backLabel}
      </button>

      <div className="mt-4">
        <VariantSearchBar
          onSearch={handleSearch}
          onSelectDbProduct={(p) => {
            started.current = false;
            router.push(
              `/product/${p.id}?q=${encodeURIComponent(p.name)}`,
            );
          }}
          loading={loading}
          initialQuery={searchQuery}
        />
      </div>

      {displayName && searchQuery && (
        <div className="mt-5 flex flex-wrap items-start justify-between gap-2">
          <h1 className="min-w-0 flex-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {displayName}
          </h1>
          {resolvedId && <TrackPriceButton productId={resolvedId} />}
        </div>
      )}

      {resolvedId && (
        <div className="mt-5">
          <ProductInsightsPanel
            productId={resolvedId}
            refreshKey={intelRefreshKey}
            liveListings={result?.listings ?? []}
            productImage={productImage}
            productName={displayName}
          />
        </div>
      )}

      {(result?.listings?.length ?? 0) > 0 && (
        <div className="mt-6">
          <ShelfPricingPanel
            listings={result?.listings ?? []}
            productKey={resolvedId ?? searchQuery}
          />
        </div>
      )}

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-label">Live prices</h2>
          {result?.cheapest && (
            <span className="badge-positive">
              Best{" "}
              {new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: "GBP",
              }).format(result.cheapest.sortPrice)}
            </span>
          )}
        </div>
        <PriceResults
          result={result}
          loading={loading && !result?.listings.length}
          error={error}
          showProductHeader={false}
        />
      </div>
    </div>
  );
}
