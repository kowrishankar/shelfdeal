"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchSuggestion } from "@/lib/search-types";
import { ProductImage } from "@/components/ProductImage";

interface VariantSearchBarProps {
  /** Fired when user searches with typed text (Enter or Search button). */
  onSearch: (query: string) => void;
  /** Fired when user picks a product from suggestions. */
  onSelectDbProduct?: (product: SearchSuggestion) => void;
  loading?: boolean;
  initialQuery?: string;
}

const MIN_QUERY_LENGTH = 2;

export function VariantSearchBar({
  onSearch,
  onSelectDbProduct,
  loading,
  initialQuery = "",
}: VariantSearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [fetching, setFetching] = useState(false);
  const [open, setOpen] = useState(false);
  /** 0 = typed search; 1+ = suggestion at index - 1 */
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigatedWithKeyboard = useRef(false);

  const trimmed = query.trim();
  const canSubmit = trimmed.length >= MIN_QUERY_LENGTH;
  const optionCount = canSubmit ? 1 + suggestions.length : 0;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }
    setFetching(true);
    try {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setOpen(true);
      setHighlight(0);
      navigatedWithKeyboard.current = false;
    } catch {
      setSuggestions([]);
      setOpen(true);
      setHighlight(0);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (trimmed.length >= MIN_QUERY_LENGTH) {
        setOpen(true);
        fetchSuggestions(trimmed);
      } else {
        setSuggestions([]);
        setOpen(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, trimmed, fetchSuggestions]);

  useEffect(() => {
    if (!open) return;
    function onPointerDownOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDownOutside);
    return () => document.removeEventListener("pointerdown", onPointerDownOutside);
  }, [open]);

  function submitTypedSearch() {
    if (!canSubmit) return;
    setOpen(false);
    setSuggestions([]);
    onSearch(trimmed);
  }

  function selectDbProduct(product: SearchSuggestion) {
    onSelectDbProduct?.(product);
    setOpen(false);
    setSuggestions([]);
    setQuery(product.name);
  }

  function selectHighlighted() {
    if (highlight === 0) {
      submitTypedSearch();
    } else {
      const item = suggestions[highlight - 1];
      if (item) selectDbProduct(item);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && optionCount > 0 && navigatedWithKeyboard.current) {
        selectHighlighted();
      } else {
        submitTypedSearch();
      }
      return;
    }

    if (!open || optionCount === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      navigatedWithKeyboard.current = true;
      setHighlight((h) => Math.min(h + 1, optionCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigatedWithKeyboard.current = true;
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative w-full ${open ? "z-[100]" : ""}`}>
      <label htmlFor="variant-search" className="sr-only">
        Search products
      </label>
      <div className="glass-card flex gap-2 p-2">
        <input
          id="variant-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            navigatedWithKeyboard.current = false;
            setHighlight(0);
          }}
          onFocus={() => canSubmit && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search e.g. Red Label 70cl"
          className="min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3 py-3.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="variant-listbox"
        />
        <button
          type="button"
          onClick={submitTypedSearch}
          disabled={!canSubmit || loading}
          className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg-base)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "…" : "Search"}
        </button>
      </div>

      {open && canSubmit && (
        <ul
          id="variant-listbox"
          role="listbox"
          className="surface-card absolute z-[100] mt-2 max-h-80 w-full overflow-auto py-1"
        >
          <li role="option" aria-selected={highlight === 0}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                submitTypedSearch();
              }}
              onMouseEnter={() => {
                setHighlight(0);
                navigatedWithKeyboard.current = false;
              }}
              className={`w-full cursor-pointer border-b border-[var(--border)] px-4 py-3 text-left transition touch-manipulation ${
                highlight === 0
                  ? "bg-[var(--accent)]/15"
                  : "hover:bg-[var(--bg-card-hover)]"
              }`}
            >
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 shrink-0 text-[var(--accent)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.2-5.2M11 18a7 7 0 100-14 7 7 0 000 14z"
                  />
                </svg>
                <span className="block min-w-0 text-sm font-semibold text-[var(--accent)]">
                  Search all retailers for &ldquo;{trimmed}&rdquo;
                </span>
              </span>
            </button>
          </li>

          {fetching && suggestions.length === 0 && (
            <li className="px-4 py-3 text-xs text-[var(--text-muted)]">
              Loading suggestions…
            </li>
          )}

          {!fetching && suggestions.length > 0 && (
            <li className="section-label px-4 py-2">Suggestions</li>
          )}

          {suggestions.map((item, i) => {
            const index = i + 1;
            return (
              <li key={item.id} role="option" aria-selected={highlight === index}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectDbProduct(item);
                  }}
                  onMouseEnter={() => {
                    setHighlight(index);
                    navigatedWithKeyboard.current = false;
                  }}
                  className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition touch-manipulation ${
                    highlight === index
                      ? "bg-[var(--accent)]/10"
                      : "hover:bg-[var(--bg-card-hover)]"
                  }`}
                >
                  <ProductImage
                    src={item.imageUrl}
                    alt=""
                    variant="compact"
                    className="h-10 w-10 shrink-0"
                  />
                  <span className="block min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary)]">
                    {item.name}
                  </span>
                </button>
              </li>
            );
          })}

          {!fetching && suggestions.length === 0 && (
            <li className="px-4 py-2 text-xs text-[var(--text-muted)]">
              No suggestions — search all retailers to compare prices
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
