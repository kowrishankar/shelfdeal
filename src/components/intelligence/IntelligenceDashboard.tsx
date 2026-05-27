"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductIntelligenceCard } from "@/lib/intelligence/types";
import { ProductIntelCard } from "./ProductIntelCard";

type SectionKey = "all" | "trending" | "low_risk" | "high_margin";

export function IntelligenceDashboard() {
  const [products, setProducts] = useState<ProductIntelligenceCard[]>([]);
  const [sections, setSections] = useState<{
    trending: ProductIntelligenceCard[];
    lowRisk: ProductIntelligenceCard[];
    highMargin: ProductIntelligenceCard[];
  }>({ trending: [], lowRisk: [], highMargin: [] });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("opportunity");
  const [section, setSection] = useState<SectionKey>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort, section });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/intelligence?${params}`);
    const data = await res.json();
    if (res.ok) {
      setProducts(data.products ?? []);
      setSections(data.sections ?? { trending: [], lowRisk: [], highMargin: [] });
    }
    setLoading(false);
  }, [q, sort, section]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Intelligence</h1>
          <p className="mt-1 text-sm text-slate-600">
            AI-powered scouting — popularity, sell speed, margin & risk for UK resellers
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:w-56"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="opportunity">Opportunity score</option>
            <option value="popularity">Popularity</option>
            <option value="margin">Margin</option>
            <option value="sell_speed">Sell speed</option>
            <option value="risk">Lowest risk</option>
          </select>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["all", "All products"],
            ["trending", "Trending ↑"],
            ["low_risk", "Low risk"],
            ["high_margin", "High margin"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              section === key
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "all" && !loading && (
        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          <SectionStrip title="Trending" items={sections.trending} />
          <SectionStrip title="Low risk picks" items={sections.lowRisk} />
          <SectionStrip title="High margin" items={sections.highMargin} />
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-800">No intelligence data yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Compare prices on the home page first — intelligence is generated after we
            have pricing signals.
          </p>
          <a
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-emerald-700 hover:underline"
          >
            Search & compare prices →
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((card) => (
            <ProductIntelCard key={card.productId} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionStrip({
  title,
  items,
}: {
  title: string;
  items: ProductIntelligenceCard[];
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <ul className="space-y-2">
        {items.slice(0, 3).map((c) => (
          <li key={c.productId}>
            <a
              href={`/intelligence/${c.productId}`}
              className="flex items-center justify-between text-sm hover:text-emerald-700"
            >
              <span className="line-clamp-1 font-medium text-slate-800">{c.name}</span>
              <span className="ml-2 shrink-0 font-bold text-emerald-600">
                {c.intelligence.opportunity_score}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
