"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProductIntelligenceCard } from "@/lib/intelligence/types";
import {
  OpportunityRing,
  PopularityBadge,
  ProfitBadge,
  RiskBadge,
  SellSpeedBadge,
  TrendIndicator,
} from "./Badges";

interface Bundle extends ProductIntelligenceCard {
  similarProducts: { productId: string; name: string; similarity: number }[];
  buyingAdvice: string[];
  productsToAvoid?: ProductIntelligenceCard[];
}

export function ProductDetail({ productId }: { productId: string }) {
  const [data, setData] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (refresh = false) => {
    setLoading(true);
    const res = await fetch(
      `/api/intelligence/${productId}?detailed=1${refresh ? "&refresh=1" : ""}`,
    );
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load");
      setLoading(false);
      return;
    }
    setData(json);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [productId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center text-red-700">
        {error ?? "Not found"}
      </div>
    );
  }

  const i = data.intelligence;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/intelligence" className="text-sm font-medium text-emerald-700">
        ← Back to dashboard
      </Link>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <OpportunityRing score={i.opportunity_score} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900">{data.name}</h1>
            {data.category && (
              <p className="text-sm text-slate-500">{data.category}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <PopularityBadge score={i.popularity_score} />
              <SellSpeedBadge speed={i.sell_speed} />
              <RiskBadge level={i.risk_level} />
              <ProfitBadge level={i.profit_potential} />
              <TrendIndicator trend={i.trend_direction} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            Refresh scores
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Wholesale" value={formatGbp(i.wholesale_cost)} />
          <Metric label="Est. resale" value={formatGbp(i.estimated_resale)} />
          <Metric
            label="Margin"
            value={i.margin_percent != null ? `${i.margin_percent.toFixed(1)}%` : "—"}
          />
          <Metric label="Turnover" value={i.estimated_turnover} />
          <Metric label="Confidence" value={`${(i.confidence_score * 100).toFixed(0)}%`} />
          <Metric label="Seasonality" value={i.seasonality} small />
        </div>

        <div className="mt-6 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
          <h2 className="text-sm font-semibold uppercase text-emerald-800">AI insight</h2>
          <p className="mt-2 text-slate-800">{i.summary}</p>
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-semibold text-slate-700">Suggested buyer types</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {i.buyer_type.map((b) => (
              <span
                key={b}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        {data.buyingAdvice?.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-700">Buying advice</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
              {data.buyingAdvice.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {data.similarProducts?.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-700">Similar winning products</h2>
            <ul className="mt-2 space-y-2">
              {data.similarProducts.map((s) => (
                <li key={s.productId}>
                  <Link
                    href={`/intelligence/${s.productId}`}
                    className="text-sm font-medium text-emerald-700 hover:underline"
                  >
                    {s.name}
                  </Link>
                  <span className="ml-2 text-xs text-slate-400">
                    {(s.similarity * 100).toFixed(0)}% match
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Link
            href={`/?compare=${data.productId}`}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Compare live prices
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-0.5 font-semibold text-slate-900 ${small ? "text-xs leading-snug" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function formatGbp(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
