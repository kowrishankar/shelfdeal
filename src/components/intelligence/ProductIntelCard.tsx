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

function formatGbp(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

export function ProductIntelCard({ card }: { card: ProductIntelligenceCard }) {
  const i = card.intelligence;

  return (
    <Link
      href={`/intelligence/${card.productId}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
    >
      <div className="flex gap-3">
        <OpportunityRing score={i.opportunity_score} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-semibold text-slate-900">{card.name}</h3>
          {card.category && (
            <p className="mt-0.5 text-xs text-slate-500">{card.category}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <PopularityBadge score={i.popularity_score} />
            <SellSpeedBadge speed={i.sell_speed} />
            <RiskBadge level={i.risk_level} />
            <ProfitBadge level={i.profit_potential} />
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 text-center text-xs">
        <div>
          <p className="text-slate-500">Wholesale</p>
          <p className="font-semibold text-slate-900">{formatGbp(i.wholesale_cost)}</p>
        </div>
        <div>
          <p className="text-slate-500">Resale</p>
          <p className="font-semibold text-slate-900">{formatGbp(i.estimated_resale)}</p>
        </div>
        <div>
          <p className="text-slate-500">Margin</p>
          <p className="font-semibold text-emerald-700">
            {i.margin_percent != null ? `${i.margin_percent.toFixed(0)}%` : "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <TrendIndicator trend={i.trend_direction} />
        <span className="text-xs text-slate-500">{i.estimated_turnover}</span>
      </div>

      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{i.summary}</p>

      <p className="mt-2 text-[10px] text-slate-400">
        Confidence {(i.confidence_score * 100).toFixed(0)}% · {i.seasonality}
      </p>
    </Link>
  );
}
