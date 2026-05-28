"use client";

import { useEffect, useMemo, useState } from "react";
import {
  detectFlavorProfile,
  formatVolumeLabel,
} from "@/lib/flavor-profile";
import { normalizedListingIdentity } from "@/lib/product-matching";
import type { RetailerListing } from "@/lib/types";

interface ProductPackOptionsPanelProps {
  listings: RetailerListing[];
  initialFlavorKey?: string;
  brandLabel?: string;
}

const HIDE_LOW_CONFIDENCE_KEY = "shelfdeal:hide-low-confidence";

function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

interface PackOption {
  key: string;
  label: string;
  packCount: number;
  confidence?: "high" | "medium" | "low";
  listings: RetailerListing[];
}

interface SizeOption {
  key: string;
  label: string;
  sizeMl: number | null;
  packs: PackOption[];
}

interface FlavorOption {
  key: string;
  label: string;
  sizes: SizeOption[];
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

function buildFlavorSizePackTree(listings: RetailerListing[]): FlavorOption[] {
  const priced = listings.filter((l) => l.prices.length > 0);
  const byFlavor = new Map<string, FlavorOption>();

  for (const listing of priced) {
    const identity = normalizedListingIdentity(
      listing.productName,
      listing.packLabel,
    );
    const flavor = detectFlavorProfile(listing.productName);
    const sizeMl = identity.sizeMl;
    const sizeKey = sizeMl?.toString() ?? "standard";
    const packCount = identity.packCount ?? (identity.isMultipack ? 2 : 1);
    const packLabel = identity.isMultipack ? `${packCount} pack` : "Single";
    const packKey = `${packCount}|${identity.isMultipack}`;

    let flavorBucket = byFlavor.get(flavor.key);
    if (!flavorBucket) {
      flavorBucket = { key: flavor.key, label: flavor.label, sizes: [] };
      byFlavor.set(flavor.key, flavorBucket);
    }

    let sizeBucket = flavorBucket.sizes.find((s) => s.key === sizeKey);
    if (!sizeBucket) {
      sizeBucket = {
        key: sizeKey,
        label: formatVolumeLabel(sizeMl),
        sizeMl,
        packs: [],
      };
      flavorBucket.sizes.push(sizeBucket);
    }

    let packBucket = sizeBucket.packs.find((p) => p.key === packKey);
    if (!packBucket) {
      packBucket = {
        key: packKey,
        label: packLabel,
        packCount,
        confidence: listing.matchConfidenceLabel,
        listings: [listing],
      };
      sizeBucket.packs.push(packBucket);
      continue;
    }
    if (
      confidenceRank(listing.matchConfidenceLabel) >
      confidenceRank(packBucket.confidence)
    ) {
      packBucket.confidence = listing.matchConfidenceLabel;
    }
    packBucket.listings.push(listing);
  }

  return [...byFlavor.values()]
    .map((flavor) => ({
      ...flavor,
      sizes: flavor.sizes
        .map((size) => ({
          ...size,
          packs: size.packs
            .map((pack) => ({
              ...pack,
              listings: [...pack.listings].sort(
                (a, b) => a.sortPrice - b.sortPrice,
              ),
            }))
            .sort((a, b) => a.packCount - b.packCount),
        }))
        .sort((a, b) => (a.sizeMl ?? 0) - (b.sizeMl ?? 0)),
    }))
    .sort((a, b) => {
      if (a.key === "original") return -1;
      if (b.key === "original") return 1;
      return a.label.localeCompare(b.label);
    });
}

function chipClass(active: boolean): string {
  return active
    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text-primary)]"
    : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]";
}

export function ProductPackOptionsPanel({
  listings,
  initialFlavorKey,
  brandLabel,
}: ProductPackOptionsPanelProps) {
  const tree = useMemo(() => buildFlavorSizePackTree(listings), [listings]);
  const [selectedFlavorKey, setSelectedFlavorKey] = useState(
    initialFlavorKey ?? tree[0]?.key ?? "original",
  );
  const [selectedSizeKey, setSelectedSizeKey] = useState<string | null>(null);
  const [hideLowConfidence, setHideLowConfidence] = useState(false);

  const activeFlavor =
    tree.find((f) => f.key === selectedFlavorKey) ?? tree[0] ?? null;

  const visibleSizes = useMemo(() => {
    if (!activeFlavor) return [];
    if (!hideLowConfidence) return activeFlavor.sizes;
    return activeFlavor.sizes
      .map((size) => ({
        ...size,
        packs: size.packs.filter((p) => p.confidence !== "low"),
      }))
      .filter((size) => size.packs.length > 0);
  }, [activeFlavor, hideLowConfidence]);

  const activeSize =
    visibleSizes.find((s) => s.key === selectedSizeKey) ??
    visibleSizes[0] ??
    null;

  useEffect(() => {
    if (initialFlavorKey) setSelectedFlavorKey(initialFlavorKey);
  }, [initialFlavorKey]);

  useEffect(() => {
    setSelectedSizeKey(null);
  }, [selectedFlavorKey]);

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

  if (!tree.length) return null;

  return (
    <section className="surface-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Sizes &amp; packs
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {brandLabel
              ? `Choose a size and pack for ${brandLabel}`
              : "Choose flavour, size, then pack"}
          </p>
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

      {tree.length > 1 && (
        <div className="mb-4">
          <p className="section-label mb-2">Flavour</p>
          <div className="flex flex-wrap gap-2">
            {tree.map((flavor) => (
              <button
                key={flavor.key}
                type="button"
                onClick={() => setSelectedFlavorKey(flavor.key)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${chipClass(
                  selectedFlavorKey === flavor.key,
                )}`}
              >
                {flavor.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeFlavor && visibleSizes.length > 0 && (
        <div className="mb-4">
          <p className="section-label mb-2">Size</p>
          <div className="flex flex-wrap gap-2">
            {visibleSizes.map((size) => {
              const cheapest = size.packs[0]?.listings[0];
              return (
                <button
                  key={size.key}
                  type="button"
                  onClick={() => setSelectedSizeKey(size.key)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${chipClass(
                    activeSize?.key === size.key,
                  )}`}
                >
                  {size.label}
                  {cheapest && (
                    <span className="ml-1.5 text-xs text-[var(--text-muted)]">
                      from {formatGbp(cheapest.sortPrice)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeSize && activeSize.packs.length > 0 && (
        <div>
          <p className="section-label mb-2">Pack</p>
          <div className="space-y-2">
            {activeSize.packs.map((pack) => {
              const cheapest = pack.listings[0];
              return (
                <div
                  key={pack.key}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {pack.label}
                    </p>
                    <div className="flex items-center gap-2">
                      {pack.confidence && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${confidenceBadgeClass(
                            pack.confidence,
                          )}`}
                        >
                          {pack.confidence}
                        </span>
                      )}
                      <span className="text-xs text-[var(--text-muted)]">
                        {pack.listings.length} supplier
                        {pack.listings.length === 1 ? "" : "s"}
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
                    {pack.listings.map((listing) => (
                      <a
                        key={`${pack.key}-${listing.retailerId}`}
                        href={listing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]"
                      >
                        {listing.retailerName}: {formatGbp(listing.sortPrice)}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeFlavor && visibleSizes.length === 0 && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-muted)]">
          No high/medium confidence sizes for this flavour yet.
        </p>
      )}
    </section>
  );
}
