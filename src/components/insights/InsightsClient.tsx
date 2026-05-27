"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { InsightsDashboardData } from "@/lib/insights/dashboard";

function formatGbp(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

function TrendBars({ demand }: { demand: number }) {
  const heights = [40, 55, 70, 85, Math.min(100, demand)];
  return (
    <div className="flex h-12 items-end gap-1" aria-hidden>
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-full max-w-[0.5rem] rounded-full"
          style={{
            height: `${h}%`,
            background:
              i === heights.length - 1
                ? "var(--accent)"
                : "rgba(209, 108, 70, 0.25)",
          }}
        />
      ))}
    </div>
  );
}

export function InsightsClient() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<InsightsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/insights")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => setError("Failed to load insights"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-32 rounded-[var(--radius-card)]" />
        <div className="skeleton h-48 rounded-[var(--radius-card)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-[#f0a8a8]">{error ?? "Unable to load insights"}</p>
    );
  }

  return (
    <div className="space-y-5">
      {!authLoading && !user && (
        <div className="surface-card p-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Sign in for personalised tips and price tracking based on your searches.
          </p>
          <Link href="/signup" className="link-accent mt-2 inline-block text-sm">
            Create free account →
          </Link>
        </div>
      )}

      {/* Tracked prices */}
      <section>
        <h2 className="section-label mb-2">Tracked prices</h2>
        {!user ? (
          <p className="text-sm text-[var(--text-muted)]">
            Track products from any product page after signing in.
          </p>
        ) : data.trackedProducts.length === 0 ? (
          <div className="surface-card p-4 text-sm text-[var(--text-secondary)]">
            No tracked products yet. Open a product and tap{" "}
            <strong className="text-[var(--accent)]">Track price</strong>.
          </div>
        ) : (
          <ul className="space-y-2">
            {data.trackedProducts.map((t) => (
              <li key={t.productId}>
                <Link
                  href={`/product/${t.productId}`}
                  className="surface-card block p-4"
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold text-[var(--text-primary)]">
                      {t.productName}
                    </p>
                    <p className="stat-value text-base">
                      {formatGbp(t.currentLowest)}
                    </p>
                  </div>
                  {t.priceChange != null && t.priceChange !== 0 && (
                    <span
                      className={
                        t.priceChange < 0 ? "badge-positive" : "badge-accent"
                      }
                    >
                      {t.priceChange < 0 ? "↓" : "↑"}{" "}
                      {formatGbp(Math.abs(t.priceChange))} vs recent
                    </span>
                  )}
                  {t.trendDirection && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Trend: {t.trendDirection}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Category trends */}
      <section>
        <h2 className="section-label mb-2">Market trends by category</h2>
        <div className="space-y-2">
          {data.categoryTrends.slice(0, 6).map((cat) => (
            <div key={cat.id} className="surface-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {cat.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {cat.seasonality}
                  </p>
                </div>
                <span
                  className={
                    cat.trend === "Rising"
                      ? "badge-positive"
                      : cat.trend === "Declining"
                        ? "text-xs text-[#f0a0a0]"
                        : "badge-accent"
                  }
                >
                  {cat.trend}
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <TrendBars demand={cat.demand} />
                <p className="text-xs text-[var(--text-muted)]">
                  Demand {cat.demand}
                  {cat.searchCount > 0 && ` · ${cat.searchCount} in your history`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Deals */}
      <section>
        <h2 className="section-label mb-2">Top opportunities & deals</h2>
        <ul className="space-y-2">
          {data.promotions.map((deal) => (
            <li key={deal.productId}>
              <Link
                href={`/product/${deal.productId}`}
                className="surface-card block p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-[var(--text-primary)]">
                    {deal.name}
                  </p>
                  <span className="badge-positive">Score {deal.opportunityScore}</span>
                </div>
                {deal.marginPercent != null && (
                  <p className="mt-1 text-xs text-[var(--accent)]">
                    Est. margin {deal.marginPercent.toFixed(0)}%
                  </p>
                )}
                <p className="mt-2 line-clamp-2 text-sm text-[var(--text-secondary)]">
                  {deal.summary}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Personalised */}
      <section>
        <h2 className="section-label mb-2">
          {user ? "For you" : "Retail tips"}
        </h2>
        <ul className="space-y-2">
          {data.personalized.map((tip, i) => (
            <li
              key={i}
              className="rounded-xl bg-[var(--bg-elevated)] px-4 py-3 ring-1 ring-[var(--border)]"
            >
              <p className="font-medium text-[var(--text-primary)]">{tip.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                {tip.body}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
