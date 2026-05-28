"use client";

import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { encodeVariantSelection } from "@/lib/variant-selection";
import {
  readDiscoverCache,
  writeDiscoverCache,
} from "@/lib/search-discovery-cache";
import { normalizeForMatch } from "@/lib/text-normalize";
import { RETAILER_NAMES } from "@/lib/retailers/shared";
import type {
  DiscoverVariantSummary,
  DiscoverSearchResponse,
  ProductFamilySummary,
  SearchSuggestion,
} from "@/lib/search-types";

interface DiscoveryGridItem {
  key: string;
  title: string;
  imageUrl?: string;
  searchText: string;
  confidence?: "high" | "medium" | "low";
}

interface SearchResultsClientProps {
  query: string;
}

const PRODUCT_GRID =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4";

function goToProductParams(
  discoveryQuery: string,
  searchText: string,
  imageUrl?: string,
) {
  const sel = encodeVariantSelection({
    name: searchText,
    listings: [],
    displayName: searchText,
    imageUrl,
  });
  const returnTo = `/search?q=${encodeURIComponent(discoveryQuery)}`;
  return new URLSearchParams({
    q: searchText,
    sel,
    returnTo,
  });
}

function DiscoveryGridCard({
  title,
  imageUrl,
  confidence,
  onSelect,
}: {
  title: string;
  imageUrl?: string;
  confidence?: "high" | "medium" | "low";
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="surface-card flex h-full flex-col overflow-hidden text-left transition hover:ring-2 hover:ring-[var(--accent)]/40"
    >
      <ProductImage src={imageUrl} alt={title} />
      <div className="flex flex-1 flex-col p-3">
        {confidence === "low" && (
          <span className="mb-2 inline-flex w-fit rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-200">
            Low confidence match
          </span>
        )}
        <p className="line-clamp-3 text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {title}
        </p>
      </div>
    </button>
  );
}

function buildCombinedProductItems(
  dbProducts: SearchSuggestion[],
  groups: ProductFamilySummary[],
): DiscoveryGridItem[] {
  const seen = new Set<string>();
  const items: DiscoveryGridItem[] = [];

  const add = (
    key: string,
    title: string,
    imageUrl?: string,
    searchText = title,
    confidence?: "high" | "medium" | "low",
  ) => {
    const norm = normalizeForMatch(title);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    items.push({ key, title, imageUrl, searchText, confidence });
  };

  for (const p of dbProducts) {
    add(`db-${p.id}`, p.name, p.imageUrl, p.name);
  }

  for (const family of groups) {
    for (const v of family.variants) {
      add(
        `${family.id}-${v.id}`,
        v.label,
        v.imageUrl ?? family.imageUrl,
        v.searchQuery || v.label,
        v.confidence,
      );
    }
  }

  return items;
}

interface FamilyVariantBucket {
  key: string;
  label: string;
  imageUrl?: string;
  options: DiscoverVariantSummary[];
}

function variantBaseLabel(variant: DiscoverVariantSummary): string {
  return variant.label
    .replace(/\s*\((?:single|single unit|\d+\s*(?:x\s*)?(?:pack|pk|can|bottle).*)\)\s*$/i, "")
    .replace(/\s+\d+\s*(?:pack|pk)\b/i, "")
    .trim();
}

function buildFamilyVariantBuckets(
  family: ProductFamilySummary,
): FamilyVariantBucket[] {
  const byBase = new Map<string, FamilyVariantBucket>();
  for (const variant of family.variants) {
    const base = variantBaseLabel(variant) || family.label;
    const key = normalizeForMatch(base);
    const existing = byBase.get(key);
    if (!existing) {
      byBase.set(key, {
        key: `${family.id}-${variant.id}`,
        label: base,
        imageUrl: variant.imageUrl ?? family.imageUrl,
        options: [variant],
      });
      continue;
    }
    if (!existing.imageUrl && variant.imageUrl) existing.imageUrl = variant.imageUrl;
    existing.options.push(variant);
  }
  return [...byBase.values()].map((bucket) => ({
    ...bucket,
    options: [...bucket.options].sort((a, b) => b.score - a.score),
  }));
}

function confidenceTone(confidence?: "high" | "medium" | "low"): string {
  if (confidence === "high") return "text-emerald-200 bg-emerald-500/15";
  if (confidence === "medium") return "text-sky-200 bg-sky-500/15";
  return "text-amber-200 bg-amber-500/15";
}

function shouldAutoRedirect(body: DiscoverSearchResponse): boolean {
  const main = buildCombinedProductItems(
    body.dbProducts ?? [],
    body.groups ?? [],
  );
  return main.length === 1 && (body.other?.length ?? 0) === 0;
}

export function SearchResultsClient({ query }: SearchResultsClientProps) {
  const router = useRouter();
  const [data, setData] = useState<DiscoverSearchResponse | null>(() =>
    readDiscoverCache(query),
  );
  const [loading, setLoading] = useState(() => !readDiscoverCache(query));
  const [error, setError] = useState<string | null>(null);

  const navigateToProduct = (searchText: string, imageUrl?: string) => {
    const params = goToProductParams(query, searchText, imageUrl);
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
          const [item] = buildCombinedProductItems(
            body.dbProducts ?? [],
            body.groups ?? [],
          );
          const params = goToProductParams(
            query,
            item.searchText || item.title,
            item.imageUrl,
          );
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
        <div className={PRODUCT_GRID}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="skeleton aspect-[3/4] rounded-[var(--radius-card)]"
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
  const dbProducts = data?.dbProducts ?? [];
  const mainProducts = buildCombinedProductItems(dbProducts, groups);
  const dbQuickPicks = dbProducts.map((p) => ({
    key: `db-${p.id}`,
    title: p.name,
    imageUrl: p.imageUrl,
    searchText: p.name,
  }));
  const hasResults = mainProducts.length > 0 || other.length > 0;

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
          {groups.map((family) => {
            const buckets = buildFamilyVariantBuckets(family);
            return (
              <div key={family.id} className="surface-card p-4">
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-xl bg-[var(--bg-elevated)]">
                    <ProductImage
                      src={family.imageUrl}
                      alt={family.label}
                      variant="card"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-[var(--text-primary)]">
                        {family.label}
                      </h2>
                      <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                        {family.retailerCount} supplier{family.retailerCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {buckets.map((bucket) => (
                        <div key={bucket.key}>
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            {bucket.label}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {bucket.options.map((variant) => (
                              <button
                                key={variant.id}
                                type="button"
                                onClick={() =>
                                  navigateToProduct(
                                    variant.searchQuery || variant.label,
                                    variant.imageUrl ?? bucket.imageUrl ?? family.imageUrl,
                                  )
                                }
                                className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]"
                              >
                                {variant.packLabel || "Single"} · {variant.retailerCount} seller
                                {variant.retailerCount === 1 ? "" : "s"}
                              </button>
                            ))}
                          </div>
                          {bucket.options.some((o) => o.confidence === "low") && (
                            <span
                              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${confidenceTone("low")}`}
                            >
                              Includes low-confidence matches
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {dbQuickPicks.length > 0 && (
        <section>
          <h2 className="section-label mb-3">Saved products</h2>
          <div className={PRODUCT_GRID}>
            {dbQuickPicks.map((item) => (
              <DiscoveryGridCard
                key={item.key}
                title={item.title}
                imageUrl={item.imageUrl}
                onSelect={() => navigateToProduct(item.searchText, item.imageUrl)}
              />
            ))}
          </div>
        </section>
      )}

      {other.length > 0 && (
        <section>
          <h2 className="section-label mb-3">Other results</h2>
          <div className={PRODUCT_GRID}>
            {other.map((variant) => (
              <DiscoveryGridCard
                key={variant.id}
                title={variant.label}
                imageUrl={variant.imageUrl}
                confidence={variant.confidence}
                onSelect={() => navigateToProduct(variant.label, variant.imageUrl)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
