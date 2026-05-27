"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { HistoryEntry } from "@/lib/db/history";

function formatGbp(n: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function HistoryClient() {
  const { user, loading: authLoading } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    fetch("/api/history")
      .then((res) => res.json())
      .then((data) => setHistory(data.history ?? []))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="skeleton h-20 rounded-[var(--radius-card)]" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="surface-card p-6 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          Sign in to save your searches and revisit products anytime.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-base)]"
          >
            Sign in
          </Link>
          <Link href="/signup" className="link-accent py-2.5 text-sm">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="surface-card p-6 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          No searches yet. Compare a product from the home tab — it will appear here.
        </p>
        <Link href="/" className="link-accent mt-4 inline-block text-sm">
          Start searching →
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {history.map((entry) => {
        const href = entry.productId
          ? `/product/${entry.productId}?q=${encodeURIComponent(entry.queryText)}`
          : `/?q=${encodeURIComponent(entry.queryText)}`;
        const name = entry.productName ?? entry.queryText;

        return (
          <li key={entry.id}>
            <Link
              href={href}
              className="surface-card block p-4 transition hover:ring-1 hover:ring-[var(--accent)]/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)]">{name}</p>
                  {entry.productName && entry.queryText !== entry.productName && (
                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                      Searched: {entry.queryText}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatWhen(entry.searchedAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {entry.lowestPrice != null && (
                    <p className="stat-value text-base">
                      {formatGbp(entry.lowestPrice)}
                    </p>
                  )}
                  {entry.opportunityScore != null && (
                    <span className="badge-positive mt-1">
                      Score {entry.opportunityScore}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
