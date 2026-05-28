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

const FLAVOR_CHIP_CLASS =
  "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]";

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
          <p className="text-sm text-[var(--text-secondary)]">
            Pick a flavour to compare sizes and packs across retailers.
          </p>
          {groups.map((family) => {
            const flavors = groupVariantsByFlavor(family.label, family.variants);
            return (
              <article key={family.id} className="surface-card overflow-hidden">
                <div className="flex items-start gap-4 p-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)]">
                    <ProductImage
                      src={family.imageUrl}
                      alt={family.label}
                      variant="card"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        {family.label}
                      </h2>
                      <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
                        {flavors.length} flavour{flavors.length === 1 ? "" : "s"} ·{" "}
                        {family.retailerCount} supplier
                        {family.retailerCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {flavors.map((flavor) => (
                        <button
                          key={flavor.key}
                          type="button"
                          onClick={() => navigateToFlavor(family, flavor)}
                          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${FLAVOR_CHIP_CLASS}`}
                        >
                          {flavor.label}
                          {flavor.variantCount > 1 && (
                            <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">
                              {flavor.variantCount} sizes
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
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
                  className="surface-card flex w-full items-center gap-3 p-3 text-left transition hover:ring-2 hover:ring-[var(--accent)]/40"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-elevated)]">
                    <ProductImage
                      src={variant.imageUrl}
                      alt={variant.label}
                      variant="card"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">
                      {variant.label}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {variant.retailerCount} supplier
                      {variant.retailerCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
