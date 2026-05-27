"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

interface TrackPriceButtonProps {
  productId: string;
}

export function TrackPriceButton({ productId }: TrackPriceButtonProps) {
  const { user, loading: authLoading } = useAuth();
  const [tracked, setTracked] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/track?productId=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setTracked(Boolean(data.tracked));
      }
    } catch {
      // ignore
    }
  }, [user, productId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function toggle() {
    if (!user) return;
    setLoading(true);
    try {
      if (tracked) {
        await fetch(`/api/track?productId=${productId}`, { method: "DELETE" });
        setTracked(false);
      } else {
        await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        setTracked(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) return null;

  if (!user) {
    return (
      <Link href="/login" className="badge-accent">
        Sign in to track price
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
        tracked
          ? "bg-[var(--positive-bg)] text-[var(--positive-text)] ring-1 ring-[var(--positive)]/30"
          : "bg-[var(--accent-subtle)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
      }`}
    >
      {loading ? "…" : tracked ? "Tracking price ✓" : "Track price"}
    </button>
  );
}
