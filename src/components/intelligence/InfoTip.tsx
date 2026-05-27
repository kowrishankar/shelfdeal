"use client";

import { useEffect, useId, useState } from "react";
import type { HelpTopic } from "@/lib/intelligence/help-text";

interface InfoTipProps {
  topic: HelpTopic;
  label: string;
  className?: string;
  children?: React.ReactNode;
}

export function InfoTip({ topic, label, className = "", children }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group inline-flex items-center gap-1 text-left ${className}`}
        aria-label={`More about ${label}`}
      >
        {children ?? (
          <span className="text-xs font-medium text-[var(--text-muted)] group-hover:text-[var(--accent)]">
            {label}
          </span>
        )}
        <span
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[10px] font-bold text-[var(--accent)] ring-1 ring-[var(--accent)]/30 group-hover:bg-[var(--accent)]/25"
          aria-hidden
        >
          ?
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-labelledby={titleId}
            aria-modal="true"
            className="surface-card max-h-[85vh] w-full max-w-md overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={titleId} className="text-lg font-semibold text-[var(--text-primary)]">
              {topic.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              {topic.description}
            </p>
            <div className="mt-4 rounded-xl bg-[var(--positive-bg)] p-3 ring-1 ring-[var(--positive)]/25">
              <p className="section-label text-[var(--positive-text)]">
                What it means for you
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-primary)]">
                {topic.forYou}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--bg-base)] hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  topic: HelpTopic;
  accent?: string;
}

export function MetricCard({
  label,
  value,
  topic,
  accent = "bg-[var(--bg-elevated)]",
}: MetricCardProps) {
  return (
    <div className={`rounded-xl p-3 ring-1 ring-[var(--border)] ${accent}`}>
      <InfoTip topic={topic} label={label} className="w-full" />
      <div className="metric-value mt-1.5 text-lg">{value}</div>
    </div>
  );
}
