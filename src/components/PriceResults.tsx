"use client";

import { ProductImage } from "@/components/ProductImage";
import type { PriceComparisonState, PriceLine, RetailerListing } from "@/lib/types";

const RETAILER_COLORS: Record<string, string> = {
  asda: "bg-emerald-600",
  tesco: "bg-blue-600",
  sainsburys: "bg-orange-500",
  amazon: "bg-amber-500",
  costco: "bg-red-600",
  booker: "bg-sky-600",
  morrisons: "bg-yellow-500",
  ocado: "bg-teal-600",
};

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function pickPrimaryPrice(listing: RetailerListing): PriceLine | null {
  return (
    listing.prices.find((p) => p.kind === "unit_inc_vat") ??
    listing.prices.find((p) => p.kind === "unit_ex_vat") ??
    listing.prices.find((p) => p.kind === "clubcard") ??
    listing.prices.find((p) => p.kind === "inc_vat") ??
    listing.prices.find((p) => p.kind === "standard") ??
    listing.prices[0] ??
    null
  );
}

function pickSecondaryPrices(listing: RetailerListing, primary: PriceLine | null): PriceLine[] {
  return listing.prices.filter((line) => {
    if (line === primary) return false;
    if (line.kind === "por") return false;
    return true;
  });
}

function RetailerRow({
  listing,
  rank,
  isCheapest,
}: {
  listing: RetailerListing;
  rank: number;
  isCheapest: boolean;
}) {
  const color = RETAILER_COLORS[listing.retailerId] ?? "bg-slate-500";
  const hasError = Boolean(listing.error);
  const primary = pickPrimaryPrice(listing);
  const secondary = pickSecondaryPrices(listing, primary);

  return (
    <article
      className={`surface-card p-4 transition ${
        isCheapest ? "border-[var(--positive)]/30 ring-2 ring-[var(--positive)]/20" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color} text-sm font-bold text-white`}
          aria-hidden
        >
          {hasError ? "—" : rank}
        </div>
        <ProductImage
          src={listing.imageUrl}
          alt={`${listing.retailerName} ${listing.productName}`}
          variant="compact"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[var(--text-primary)]">
              {listing.retailerName}
            </h3>
            {isCheapest && <span className="badge-positive">Cheapest</span>}
            {listing.packLabel && listing.packSize && listing.packSize > 1 && (
              <span className="badge-accent">{listing.packLabel}</span>
            )}
          </div>

          {hasError ? (
            <p className="mt-1 text-sm text-[var(--text-muted)]">{listing.error}</p>
          ) : primary ? (
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {formatPrice(primary.amount)}
              </p>
              {primary.kind === "clubcard" && (
                <span className="badge-accent">Clubcard</span>
              )}
              {(primary.kind === "unit_inc_vat" || primary.kind === "unit_ex_vat") && (
                <span className="text-xs text-[var(--text-muted)]">each</span>
              )}
            </div>
          ) : null}

          {secondary.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-[var(--accent)]">
                More prices
              </summary>
              <ul className="mt-2 space-y-1">
                {secondary.map((line) => (
                  <li
                    key={`${line.kind}-${line.label}`}
                    className="flex justify-between text-xs text-[var(--text-secondary)]"
                  >
                    <span>{line.label}</span>
                    <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                      {line.percent != null ? `${line.percent}%` : formatPrice(line.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {listing.note && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">{listing.note}</p>
          )}

          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-accent mt-2 inline-flex text-sm"
          >
            Buy at {listing.retailerName} →
          </a>
        </div>
      </div>
    </article>
  );
}

interface PriceResultsProps {
  result: PriceComparisonState | null;
  loading?: boolean;
  error?: string | null;
  showProductHeader?: boolean;
}

export function PriceResults({
  result,
  loading,
  error,
  showProductHeader = true,
}: PriceResultsProps) {
  if (loading && !result?.listings.length) {
    return (
      <div className="space-y-3" aria-live="polite">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 rounded-[var(--radius-card)]" />
        ))}
        <p className="text-center text-sm text-[var(--text-muted)]">
          {result?.statusMessage ?? "Checking retailers…"}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger)]">
        {error}
      </div>
    );
  }

  if (!result?.product && !result?.listings.length) return null;

  const priced = result.listings.filter((l) => l.prices.length > 0);
  const failed = result.listings.filter((l) => l.error && !l.prices.length);

  return (
    <div className="space-y-3">
      {showProductHeader && result.product && (
        <div className="glass-card p-4">
          <p className="section-label">
            {result.isComplete ? "Compared" : "Comparing"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            {result.product.name}
          </h2>
          {result.cheapest && (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Best so far:{" "}
              <strong className="text-[var(--accent)]">
                {formatPrice(result.cheapest.sortPrice)}
              </strong>
              {result.cheapest.packSize && result.cheapest.packSize > 1
                ? " per unit"
                : ""}{" "}
              at {result.cheapest.retailerName}
            </p>
          )}
          {result.statusMessage && !result.isComplete && (
            <p className="mt-2 text-xs text-[var(--accent)]">{result.statusMessage}</p>
          )}
        </div>
      )}

      {priced.map((listing, index) => (
        <RetailerRow
          key={listing.retailerId}
          listing={listing}
          rank={index + 1}
          isCheapest={listing.retailerId === result.cheapest?.retailerId}
        />
      ))}

      {loading &&
        priced.length > 0 &&
        priced.length < 6 &&
        [1, 2].map((i) => (
          <div key={`skel-${i}`} className="skeleton h-20 rounded-[var(--radius-card)]" />
        ))}

      {failed.length > 0 && result.isComplete && (
        <details className="surface-card p-4 text-sm text-[var(--text-secondary)]">
          <summary className="cursor-pointer font-medium text-[var(--text-primary)]">
            {failed.length} retailer{failed.length > 1 ? "s" : ""} unavailable
          </summary>
          <ul className="mt-2 space-y-1 pl-4 text-[var(--text-muted)]">
            {failed.map((l) => (
              <li key={l.retailerId}>
                {l.retailerName}: {l.error}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
