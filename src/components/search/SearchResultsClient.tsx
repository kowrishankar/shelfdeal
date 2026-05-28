"use client";

import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  groupVariantsByFlavor,
  type DiscoveryFlavorOption,
} from "@/lib/flavor-profile";
import { encodeVariantSelection } from "@/lib/variant-selection";
import {
  readDiscoverCache,
  writeDiscoverCache,
} from "@/lib/search-discovery-cache";
import { RETAILER_NAMES } from "@/lib/retailers/shared";
import type {
  DiscoverSearchResponse,
  ProductFamilySummary,
} from "@/lib/search-types";

interface SearchResultsClientProps {
  query: string;
}

function goToProductParams(
  discoveryQuery: string,
  flavor: DiscoveryFlavorOption,
  family: ProductFamilySummary,
) {
  const displayName = `${family.label} — ${flavor.label}`;
  const sel = encodeVariantSelection({
    name: flavor.searchText,
    listings: [],
    displayName,
    imageUrl: flavor.imageUrl ?? family.imageUrl,
    flavorKey: flavor.key,
    flavorLabel: flavor.label,
    brandLabel: family.label,
  });
  const returnTo = `/search?q=${encodeURIComponent(discoveryQuery)}`;
  return new URLSearchParams({
    q: flavor.searchText,
    sel,
    returnTo,
  });
}

const FLAVOR_BUTTON_CLASS =
  "flex min-h-[3.25rem] w-full items-center justify-between gap-3 rounded-xl border-2 border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-3 text-left transition hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] active:scale-[0.99]";

function CompareChevron() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function FlavorButton({
  flavor,
  onClick,
}: {
  flavor: DiscoveryFlavorOption;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={FLAVOR_BUTTON_CLASS}>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-[var(--text-primary)]">
          {flavor.label}
        </span>
        {flavor.variantCount > 1 && (
          <span className="mt-0.5 block text-sm text-[var(--text-muted)]">
            {flavor.variantCount} sizes to compare
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-[var(--accent)]">
        Compare
        <CompareChevron />
      </span>
    </button>
  );
}

function countDiscoveryFlavors(groups: ProductFamilySummary[]): number {
  let total = 0;
  for (const family of groups) {
    total += groupVariantsByFlavor(family.label, family.variants).length;
  }
  return total;
}

function shouldAutoRedirect(body: DiscoverSearchResponse): boolean {
  const groups = body.groups ?? [];
  if ((body.other?.length ?? 0) > 0) return false;
  if (groups.length !== 1) return false;
  const flavors = groupVariantsByFlavor(groups[0].label, groups[0].variants);
  return flavors.length === 1;
}

export function SearchResultsClient({ query }: SearchResultsClientProps) {
  const router = useRouter();
  const [data, setData] = useState<DiscoverSearchResponse | null>(() =>
    readDiscoverCache(query),
  );
  const [loading, setLoading] = useState(() => !readDiscoverCache(query));
  const [error, setError] = useState<string | null>(null);

  const navigateToFlavor = (
    family: ProductFamilySummary,
    flavor: DiscoveryFlavorOption,
  ) => {
    const params = goToProductParams(query, flavor, family);
    router.push(`/product/new?${params}`);
  };

  useEffect(() => {
    const cached = readDiscoverCache(query);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`/api/search/discover?q=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((body: DiscoverSearchResponse & { error?: string }) => {
        if (cancelled) return;
        if (body.error) {
          setError(body.error);
          return;
        }
        setData(body);
        writeDiscoverCache(query, body);

        if (shouldAutoRedirect(body)) {
          const [family] = body.groups ?? [];
          const [flavor] = groupVariantsByFlavor(
            family.label,
            family.variants,
          );
          const params = goToProductParams(query, flavor, family);
          router.push(`/product/new?${params}`);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load products");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, router]);

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-muted)]">
          Searching Tesco, ASDA, Morrisons, Amazon, Booker and more…
        </p>
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="skeleton h-28 rounded-[var(--radius-card)]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface-card p-6 text-center">
        <p className="text-sm text-[#f0a8a8]">{error}</p>
        <Link href="/" className="link-accent mt-4 inline-block text-sm">
          ← Back to search
        </Link>
      </div>
    );
  }

  const groups = data?.groups ?? [];
  const other = data?.other ?? [];
  const flavorCount = countDiscoveryFlavors(groups);
  const hasResults = flavorCount > 0 || other.length > 0;

  if (!hasResults) {
    return (
      <div className="surface-card p-6 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          No products found for &ldquo;{query}&rdquo;. Try a more specific name or
          include the size (e.g. 70cl).
        </p>
        <Link href="/" className="link-accent mt-4 inline-block text-sm">
          ← New search
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {data?.retailerHits && Object.keys(data.retailerHits).length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          Found on:{" "}
          {["tesco", "asda", "morrisons", "booker", "amazon", "costco", "sainsburys"]
            .filter((id) => (data.retailerHits?.[id] ?? 0) > 0)
            .map(
              (id) =>
                `${RETAILER_NAMES[id as keyof typeof RETAILER_NAMES] ?? id} (${data.retailerHits![id]})`,
            )
            .join(" · ")}
        </p>
      )}

      {groups.length > 0 && (
        <section className="space-y-4">
          <p className="text-base text-[var(--text-secondary)]">
            Tap a flavour to compare prices across retailers.
          </p>
          {groups.map((family) => {
            const flavors = groupVariantsByFlavor(family.label, family.variants);
            return (
              <article key={family.id} className="surface-card overflow-hidden">
                <div className="flex items-start gap-4 p-4 pb-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)] sm:h-24 sm:w-24">
                    <ProductImage
                      src={family.imageUrl}
                      alt={family.label}
                      variant="card"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-[var(--text-primary)] sm:text-xl">
                      {family.label}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {flavors.length} flavour{flavors.length === 1 ? "" : "s"} ·{" "}
                      {family.retailerCount} supplier
                      {family.retailerCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 px-4 pb-4">
                  {flavors.map((flavor) => (
                    <FlavorButton
                      key={flavor.key}
                      flavor={flavor}
                      onClick={() => navigateToFlavor(family, flavor)}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {other.length > 0 && (
        <section>
          <h2 className="section-label mb-3">Other results</h2>
          <div className="space-y-2">
            {other.map((variant) => {
              const flavor = groupVariantsByFlavor(variant.label, [variant])[0];
              const pseudoFamily: ProductFamilySummary = {
                id: variant.id,
                label: variant.label,
                imageUrl: variant.imageUrl,
                retailerCount: variant.retailerCount,
                variants: [variant],
              };
              const pick =
                flavor ??
                ({
                  key: "original",
                  label: "Original",
                  searchText: variant.label,
                  imageUrl: variant.imageUrl,
                  retailerCount: variant.retailerCount,
                  variantCount: 1,
                } satisfies DiscoveryFlavorOption);

              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => navigateToFlavor(pseudoFamily, pick)}
                  className="surface-card flex min-h-[4.5rem] w-full items-center gap-4 p-4 text-left transition hover:ring-2 hover:ring-[var(--accent)]/30 active:scale-[0.99]"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)]">
                    <ProductImage
                      src={variant.imageUrl}
                      alt={variant.label}
                      variant="card"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-base font-semibold text-[var(--text-primary)]">
                      {variant.label}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {variant.retailerCount} supplier
                      {variant.retailerCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-[var(--accent)]">
                    Compare
                    <CompareChevron />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
