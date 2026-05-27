"use client";

import type { PriceComparisonState, PriceLine, RetailerListing } from "@/lib/types";

const RETAILER_COLORS: Record<string, string> = {
  asda: "from-green-600/80 to-green-800/80",
  tesco: "from-blue-600/80 to-blue-900/80",
  sainsburys: "from-orange-500/80 to-orange-700/80",
  amazon: "from-amber-500/80 to-amber-700/80",
  costco: "from-red-600/80 to-red-900/80",
  booker: "from-sky-600/80 to-sky-900/80",
  morrisons: "from-yellow-500/80 to-yellow-700/80",
  ocado: "from-teal-600/80 to-teal-900/80",
};

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function priceLineStyle(line: PriceLine, highlight?: boolean): string {
  if (highlight) {
    return "bg-[var(--accent)]/15 text-[var(--text-primary)] ring-1 ring-[var(--accent)]/40";
  }
  if (line.kind === "clubcard") return "bg-blue-500/10 text-blue-200";
  if (line.kind === "unit_inc_vat" || line.kind === "unit_ex_vat") {
    return "bg-[var(--accent)]/10 text-[var(--accent)]";
  }
  if (line.kind === "rrp") return "bg-violet-500/10 text-violet-200";
  if (line.kind === "por") return "bg-[var(--positive-bg)] text-[var(--positive-text)]";
  return "bg-[var(--bg-elevated)] text-[var(--text-secondary)]";
}

function PriceBadge({ line, highlight }: { line: PriceLine; highlight?: boolean }) {
  const isClubcard = line.kind === "clubcard";
  const isPor = line.kind === "por";

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm ${priceLineStyle(line, highlight)}`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {isClubcard && (
          <span className="badge-accent shrink-0">Clubcard</span>
        )}
        {(line.kind === "unit_inc_vat" || line.kind === "unit_ex_vat") && (
          <span className="badge-accent shrink-0">Each</span>
        )}
        <span className="truncate">{line.label}</span>
      </span>
      <span className="shrink-0 tabular-nums font-semibold">
        {isPor && line.percent != null ? `${line.percent}%` : formatPrice(line.amount)}
      </span>
    </div>
  );
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
  const gradient = RETAILER_COLORS[listing.retailerId] ?? "from-slate-600/80 to-slate-800/80";
  const hasError = Boolean(listing.error);
  const highlightPrice = listing.prices.find(
    (p) =>
      p.kind === "unit_inc_vat" ||
      p.kind === "clubcard" ||
      p.kind === "inc_vat" ||
      p.kind === "standard",
  );

  return (
    <article
      className={`surface-card p-4 transition ${
        isCheapest ? "ring-2 ring-[var(--accent)]/50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-sm font-bold text-white shadow-lg`}
          aria-hidden
        >
          {hasError ? "—" : rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[var(--text-primary)]">
              {listing.retailerName}
            </h3>
            {isCheapest && <span className="badge-positive">Lowest</span>}
            {listing.packLabel && listing.packSize && listing.packSize > 1 && (
              <span className="badge-accent">{listing.packLabel}</span>
            )}
          </div>

          {hasError ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">{listing.error}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {listing.prices.map((line) => (
                <PriceBadge
                  key={`${line.kind}-${line.label}`}
                  line={line}
                  highlight={highlightPrice === line && isCheapest}
                />
              ))}
            </div>
          )}

          {listing.note && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">{listing.note}</p>
          )}

          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-accent mt-3 inline-flex"
          >
            View on {listing.retailerName} →
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
          <div key={i} className="skeleton h-28 rounded-[var(--radius-card)]" />
        ))}
        <p className="text-center text-sm text-[var(--text-muted)]">
          {result?.statusMessage ?? "Searching retailers…"}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[#f0a8a8]">
        {error}
      </div>
    );
  }

  if (!result?.product && !result?.listings.length) return null;

  const priced = result.listings.filter((l) => l.prices.length > 0);
  const failed = result.listings.filter((l) => l.error && !l.prices.length);

  return (
    <div className="space-y-4">
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

      <div className="space-y-3">
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
      </div>

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
