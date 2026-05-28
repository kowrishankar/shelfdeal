"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePriceComparison } from "@/hooks/usePriceComparison";
import { ProductInsightsPanel } from "@/components/intelligence/ProductInsightsPanel";
import { PriceResults } from "@/components/PriceResults";
import { ProductPackOptionsPanel } from "@/components/ProductPackOptionsPanel";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { UnitEconomicsSection } from "@/components/UnitEconomicsSection";
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

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
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

  const displayName =
    previewName ??
    (selection?.brandLabel && selection?.flavorLabel
      ? `${selection.brandLabel} — ${selection.flavorLabel}`
      : null) ??
    result?.product?.name ??
    searchQuery;
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

      {displayName && searchQuery && !result?.isComplete && (
        <p className="mt-5 text-sm text-[var(--text-secondary)]">
          {result?.statusMessage ?? `Finding the best price for “${displayName}”…`}
        </p>
      )}

      {displayName && searchQuery && result?.isComplete && (
        <div className="mt-5 flex flex-wrap items-start justify-between gap-2">
          <h1 className="min-w-0 flex-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">
            {displayName}
          </h1>
          {resolvedId && <TrackPriceButton productId={resolvedId} />}
        </div>
      )}

      {result?.isComplete && result.cheapest && (
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--positive)]/20 bg-[var(--positive-bg)] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--positive-text)]">
            Cheapest
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--text-primary)]">
            {formatPrice(result.cheapest.sortPrice)}
            {result.cheapest.packSize && result.cheapest.packSize > 1 ? (
              <span className="ml-2 text-base font-medium text-[var(--text-secondary)]">
                per unit
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            at {result.cheapest.retailerName}
          </p>
        </div>
      )}

      <div className="mt-5">
        <h2 className="section-label mb-3">Where to buy</h2>
        <PriceResults
          result={result}
          loading={loading && !result?.listings.length}
          error={error}
          showProductHeader={false}
        />
      </div>

      {result?.isComplete && (result?.listings?.length ?? 0) > 0 && (
        <div className="mt-5">
          <ProductPackOptionsPanel
            listings={result?.listings ?? []}
            initialFlavorKey={selection?.flavorKey}
            brandLabel={selection?.brandLabel}
          />
        </div>
      )}

      {resolvedId && result?.isComplete && (
        <div className="mt-5 space-y-3">
          <CollapsibleSection
            title="Product intelligence"
            subtitle="Score, trends & buying tips"
          >
            <ProductInsightsPanel
              productId={resolvedId}
              refreshKey={intelRefreshKey}
              liveListings={result?.listings ?? []}
              productImage={productImage}
              productName={displayName}
            />
          </CollapsibleSection>

          {(result?.listings?.length ?? 0) > 0 && (
            <CollapsibleSection
              title="Margin & POR"
              subtitle="For shop owners"
            >
              <UnitEconomicsSection
                listings={result?.listings ?? []}
                productKey={resolvedId ?? searchQuery}
              />
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}
