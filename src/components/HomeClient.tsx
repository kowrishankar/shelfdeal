"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SearchSuggestion } from "@/lib/search-types";
import { VariantSearchBar } from "./VariantSearchBar";

export function HomeClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToSavedProduct = (product: SearchSuggestion) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ q: product.name });
    router.push(`/product/${product.id}?${params}`);
  };

  const handleSearch = (searchText: string) => {
    setLoading(true);
    setError(null);
    router.push(`/search?q=${encodeURIComponent(searchText)}`);
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-4">
      <VariantSearchBar
        onSearch={handleSearch}
        onSelectDbProduct={goToSavedProduct}
        loading={loading}
      />

      {error && (
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[#f0a8a8]">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="surface-card mt-8 p-5">
          <p className="text-base font-semibold text-[var(--text-primary)]">
            Built for independent retailers
          </p>
          <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                1
              </span>
              <span>
                Pick a suggestion from the dropdown, or search all retailers to
                find and group similar items
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                2
              </span>
              <span>Compare Tesco, ASDA, Morrisons, Booker, Amazon & more</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--positive)]/15 text-[var(--positive-text)]">
                3
              </span>
              <span>AI margin, POR & score rating (Excellent → Avoid)</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
