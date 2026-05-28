"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ProductIntelligenceCard } from "@/lib/intelligence/types";
import {
  getScoreRating,
  type ScoreRating,
  type ScoreTier,
} from "@/lib/intelligence/retail-insights";
import { HELP_TOPICS } from "@/lib/intelligence/help-text";
import { ProductImage } from "@/components/ProductImage";
import { InfoTip } from "./InfoTip";
import type { TrendDirection } from "@/lib/intelligence/types";
import type { RetailerListing } from "@/lib/types";

interface Bundle extends ProductIntelligenceCard {
  similarProducts?: { productId: string; name: string; similarity: number }[];
  buyingAdvice?: string[];
  scoreRating?: ScoreRating;
}

interface ProductInsightsPanelProps {
  productId: string;
  refreshKey?: string | number;
  liveListings?: RetailerListing[];
  productImage?: string | null;
  productName?: string;
  /** When false, skip API fetch until user opens the section */
  active?: boolean;
}

function tierBadgeClass(tier: ScoreTier): string {
  return `inline-flex items-center rounded-full px-3 py-1 text-sm font-bold badge-tier-${tier}`;
}

function TrendBars({ trend }: { trend: TrendDirection }) {
  const heights =
    trend === "Rising"
      ? [35, 50, 65, 80, 100]
      : trend === "Declining"
        ? [100, 75, 55, 40, 28]
        : [60, 65, 58, 62, 60];
  const active = trend === "Rising" ? 4 : trend === "Declining" ? 0 : 2;

  return (
    <div className="flex h-16 items-end justify-between gap-1.5 px-1" aria-hidden>
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-full max-w-[2rem] rounded-full transition-all"
          style={{
            height: `${h}%`,
            background:
              i === active
                ? "var(--accent)"
                : "rgba(209, 108, 70, 0.25)",
            boxShadow: i === active ? "0 0 12px var(--accent-glow)" : undefined,
          }}
        />
      ))}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  topic,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  topic: (typeof HELP_TOPICS)[keyof typeof HELP_TOPICS];
  highlight?: boolean;
}) {
  return (
    <div className={`stat-tile ${highlight ? "ring-1 ring-[var(--positive)]/30" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card)] text-[var(--accent)] ring-1 ring-[var(--border)]">
          {icon}
        </span>
        <InfoTip topic={topic} label={label} />
      </div>
      <p className="section-label">{label}</p>
      <p className="stat-value mt-0.5">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</p>}
    </div>
  );
}

export function ProductInsightsPanel({
  productId,
  refreshKey = 0,
  liveListings = [],
  productImage,
  productName = "Product",
  active = true,
}: ProductInsightsPanelProps) {
  const [data, setData] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/intelligence/${productId}?detailed=1${refresh ? "&refresh=1" : ""}`,
        );
        const json = await res.json();
        if (res.ok) setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [productId],
  );

  useEffect(() => {
    if (!active) return;
    load(Boolean(refreshKey));
  }, [productId, refreshKey, load, active]);

  const scoreRating = useMemo(() => {
    if (data?.intelligence) return getScoreRating(data.intelligence.opportunity_score);
    return data?.scoreRating ?? null;
  }, [data]);

  if (!active) return null;

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="hero-card flex gap-4 p-5">
          <div className="skeleton h-20 w-20 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="skeleton mb-3 h-16 w-full rounded-xl" />
            <div className="skeleton h-8 w-2/3 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const i = data.intelligence;

  return (
    <section className="space-y-4">
      {/* Hero score */}
      {scoreRating && (
        <div className="hero-card p-5">
          <div className="flex gap-4">
            <ProductImage
              src={productImage}
              alt={productName}
              variant="compact"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="section-label">Opportunity score</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="hero-value">{scoreRating.score}</span>
                    <span className="text-lg text-[var(--text-muted)]">/ 100</span>
                  </div>
                </div>
                <button type="button" onClick={() => load(true)} className="link-accent shrink-0">
                  Refresh
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={tierBadgeClass(scoreRating.tier)}>{scoreRating.label}</span>
                <InfoTip topic={HELP_TOPICS.score_rating} label="Rating guide">
                  <span className="link-accent">Guide</span>
                </InfoTip>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                {scoreRating.summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confidence + turnover */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Confidence"
          value={`${(i.confidence_score * 100).toFixed(0)}%`}
          topic={HELP_TOPICS.confidence}
        />
        <StatTile
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Turnover"
          value={i.estimated_turnover}
          sub="sell-through"
          topic={HELP_TOPICS.turnover}
        />
      </div>

      {/* Trend + season */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="surface-card p-4">
          <div className="flex items-center justify-between">
            <InfoTip topic={HELP_TOPICS.trend} label="Demand trend" />
            <span
              className={`text-xs font-bold ${
                i.trend_direction === "Rising"
                  ? "text-[var(--positive-text)]"
                  : i.trend_direction === "Declining"
                    ? "text-[#f0a0a0]"
                    : "text-[var(--text-secondary)]"
              }`}
            >
              {i.trend_direction}
            </span>
          </div>
          <TrendBars trend={i.trend_direction} />
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Sell speed: <strong className="text-[var(--text-primary)]">{i.sell_speed}</strong>
          </p>
        </div>

        <div className="surface-card p-4">
          <InfoTip topic={HELP_TOPICS.seasonality} label="Season & holidays" />
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            {i.seasonality}
          </p>
        </div>
      </div>

      {i.summary && (
        <p className="px-1 text-sm leading-relaxed text-[var(--text-secondary)]">{i.summary}</p>
      )}

      {data.buyingAdvice && data.buyingAdvice.length > 0 && (
        <div className="surface-card p-4">
          <InfoTip topic={HELP_TOPICS.tips} label="Buying tips" className="mb-3" />
          <ul className="space-y-2">
            {data.buyingAdvice.map((tip) => (
              <li
                key={tip}
                className="flex gap-2 rounded-xl bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-secondary)]"
              >
                <span className="text-[var(--accent)]">→</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.similarProducts && data.similarProducts.length > 0 && (
        <div className="px-1">
          <p className="section-label mb-2">Similar products</p>
          <ul className="space-y-1">
            {data.similarProducts.slice(0, 3).map((s) => (
              <li key={s.productId}>
                <Link href={`/product/${s.productId}`} className="link-accent text-sm">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
