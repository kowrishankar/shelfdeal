"use client";

import { useId, useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CollapsibleSection({
  title,
  subtitle,
  children,
  defaultOpen = false,
  onOpenChange,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  function toggle() {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <section className="surface-card overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--bg-elevated)]"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
              {subtitle}
            </span>
          )}
        </span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <div id={panelId} className="border-t border-[var(--border)] px-4 py-4">
          {children}
        </div>
      )}
    </section>
  );
}
