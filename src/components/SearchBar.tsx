"use client";

import { FormEvent, useState } from "react";

interface SearchBarProps {
  initialQuery?: string;
  onSearch: (query: string) => void;
  loading?: boolean;
}

export function SearchBar({ initialQuery = "", onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearch(query.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <label htmlFor="product-search" className="sr-only">
        Search products
      </label>
      <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-lg shadow-emerald-950/10 ring-1 ring-emerald-900/10">
        <input
          id="product-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Chivas Regal 70cl"
          className="min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          autoComplete="off"
          enterKeyHint="search"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="shrink-0 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Searching…" : "Compare"}
        </button>
      </div>
    </form>
  );
}
