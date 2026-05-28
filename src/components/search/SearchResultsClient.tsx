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
  DiscoverSearchResponse,
  ProductFamilySummary,
  SearchSuggestion,
} from "@/lib/search-types";

interface DiscoveryGridItem {
  key: string;
  title: string;
  imageUrl?: string;
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
  onSelect,
}: {
  title: string;
  imageUrl?: string;
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

  const add = (key: string, title: string, imageUrl?: string) => {
    const norm = normalizeForMatch(title);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    items.push({ key, title, imageUrl });
  };

  for (const p of dbProducts) {
    add(`db-${p.id}`, p.name, p.imageUrl);
  }

  for (const family of groups) {
    for (const v of family.variants) {
      add(`${family.id}-${v.id}`, v.label, v.imageUrl ?? family.imageUrl);
    }
  }

  return items;
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
          const params = goToProductParams(query, item.title, item.imageUrl);
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
      {mainProducts.length > 0 && (
        <section>
          <div className={PRODUCT_GRID}>
            {mainProducts.map((item) => (
              <DiscoveryGridCard
                key={item.key}
                title={item.title}
                imageUrl={item.imageUrl}
                onSelect={() => navigateToProduct(item.title, item.imageUrl)}
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
                onSelect={() => navigateToProduct(variant.label, variant.imageUrl)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
