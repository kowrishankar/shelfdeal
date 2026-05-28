"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizedListingIdentity } from "@/lib/product-matching";
import type { RetailerListing } from "@/lib/types";

interface ProductPackOptionsPanelProps {
  listings: RetailerListing[];
}

const HIDE_LOW_CONFIDENCE_KEY = "shelfdeal:hide-low-confidence";

function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

interface PackBucket {
  key: string;
  label: string;
  sizeMl?: number | null;
  packCount: number;
  confidence?: "high" | "medium" | "low";
  listings: RetailerListing[];
}

interface VariantBucket {
  key: string;
  label: string;
  packs: PackBucket[];
}

function confidenceRank(label?: "high" | "medium" | "low"): number {
  if (label === "high") return 3;
  if (label === "medium") return 2;
  if (label === "low") return 1;
  return 0;
}

function confidenceBadgeClass(label?: "high" | "medium" | "low"): string {
  if (label === "high") return "bg-emerald-500/15 text-emerald-200";
  if (label === "medium") return "bg-sky-500/15 text-sky-200";
  return "bg-amber-500/15 text-amber-200";
}

function buildVariantBuckets(listings: RetailerListing[]): VariantBucket[] {
  const priced = listings.filter((l) => l.prices.length > 0);
  const byVariant = new Map<string, VariantBucket>();

  for (const listing of priced) {
    const identity = normalizedListingIdentity(listing.productName, listing.packLabel);
    const flavor = identity.flavor && identity.flavor !== "original" ? identity.flavor : "Original";
    const variantLabel = `${flavor}${identity.sizeMl ? ` ${identity.sizeMl}ml` : ""}`.trim();
    const variantKey = `${flavor}|${identity.sizeMl ?? "na"}`;

    const packCount = identity.packCount ?? (identity.isMultipack ? 2 : 1);
    const label = identity.isMultipack ? `${packCount} pack` : "Single";
    const key = `${variantKey}|${packCount}|${identity.isMultipack}`;

    let variant = byVariant.get(variantKey);
    if (!variant) {
      variant = {
        key: variantKey,
        label: variantLabel,
        packs: [],
      };
      byVariant.set(variantKey, variant);
    }

    const existing = variant.packs.find((p) => p.key === key);
    if (!existing) {
      variant.packs.push({
        key,
        label,
        sizeMl: identity.sizeMl,
        packCount,
        confidence: listing.matchConfidenceLabel,
        listings: [listing],
      });
      continue;
    }
    if (
      confidenceRank(listing.matchConfidenceLabel) >
      confidenceRank(existing.confidence)
    ) {
      existing.confidence = listing.matchConfidenceLabel;
    }
    existing.listings.push(listing);
  }

  return [...byVariant.values()]
    .map((variant) => ({
      ...variant,
      packs: variant.packs
        .map((pack) => ({
          ...pack,
          listings: [...pack.listings].sort((a, b) => a.sortPrice - b.sortPrice),
        }))
        .sort((a, b) => {
          const sizeA = a.sizeMl ?? 0;
          const sizeB = b.sizeMl ?? 0;
          if (sizeA !== sizeB) return sizeA - sizeB;
          return a.packCount - b.packCount;
        }),
    }))
    .sort((a, b) => {
      const sizeA = Number(a.label.match(/(\d+)ml/i)?.[1] ?? 0);
      const sizeB = Number(b.label.match(/(\d+)ml/i)?.[1] ?? 0);
      return sizeA - sizeB;
    });
}

export function ProductPackOptionsPanel({ listings }: ProductPackOptionsPanelProps) {
  const variants = buildVariantBuckets(listings);
  if (!variants.length) return null;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hideLowConfidence, setHideLowConfidence] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HIDE_LOW_CONFIDENCE_KEY);
      if (saved === "1") setHideLowConfidence(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        HIDE_LOW_CONFIDENCE_KEY,
        hideLowConfidence ? "1" : "0",
      );
    } catch {
      // ignore
    }
  }, [hideLowConfidence]);

  const visibleVariants = useMemo(() => {
    if (!hideLowConfidence) return variants;
    return variants
      .map((variant) => ({
        ...variant,
        packs: variant.packs.filter((p) => p.confidence !== "low"),
      }))
      .filter((variant) => variant.packs.length > 0);
  }, [variants, hideLowConfidence]);

  function isExpanded(key: string): boolean {
    return expanded[key] ?? true;
  }

  return (
    <section className="surface-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Pack options
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            variant → pack → supplier
          </span>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={hideLowConfidence}
            onChange={(e) => setHideLowConfidence(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--accent)]"
          />
          Hide low confidence
        </label>
      </div>
      <div className="space-y-3">
        {visibleVariants.map((variant) => (
          <div
            key={variant.key}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
          >
            <button
              type="button"
              onClick={() =>
                setExpanded((prev) => ({
                  ...prev,
                  [variant.key]: !isExpanded(variant.key),
                }))
              }
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {variant.label}
              </p>
              <span className="text-xs text-[var(--text-muted)]">
                {variant.packs.length} pack option
                {variant.packs.length === 1 ? "" : "s"} {isExpanded(variant.key) ? "▾" : "▸"}
              </span>
            </button>
            {isExpanded(variant.key) && (
              <div className="mt-2 space-y-2">
                {variant.packs.map((bucket) => {
                  const cheapest = bucket.listings[0];
                  return (
                    <div
                      key={bucket.key}
                      className="rounded-lg border border-[var(--border)]/80 bg-[var(--bg-card)] p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          {bucket.label}
                        </p>
                        <div className="flex items-center gap-2">
                          {bucket.confidence && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${confidenceBadgeClass(
                                bucket.confidence,
                              )}`}
                            >
                              {bucket.confidence} confidence
                            </span>
                          )}
                          <span className="text-xs text-[var(--text-muted)]">
                            {bucket.listings.length} supplier
                            {bucket.listings.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        Cheapest:{" "}
                        <span className="font-semibold text-[var(--accent)]">
                          {formatGbp(cheapest.sortPrice)}
                        </span>{" "}
                        at {cheapest.retailerName}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {bucket.listings.map((listing) => (
                          <a
                            key={`${bucket.key}-${listing.retailerId}`}
                            href={listing.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]"
                          >
                            {listing.retailerName}: {formatGbp(listing.sortPrice)}
                            {listing.matchConfidenceLabel
                              ? ` (${listing.matchConfidenceLabel})`
                              : ""}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {visibleVariants.length === 0 && (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-muted)]">
            No high/medium confidence pack matches available yet.
          </p>
        )}
      </div>
    </section>
  );
}
