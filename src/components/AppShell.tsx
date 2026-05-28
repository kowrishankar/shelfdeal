"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShelfDealMark, ShelfDealWordmark } from "@/components/brand/ShelfDealLogo";
import { BRAND_TAGLINE } from "@/lib/brand";
import { useAuth } from "@/hooks/useAuth";

interface AppShellProps {
  children: React.ReactNode;
  minimal?: boolean;
  title?: string;
  subtitle?: string;
}

function NavIcon({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
        active
          ? "bg-[var(--accent)]/20 text-[var(--accent)] shadow-[0_0_20px_var(--accent-glow)]"
          : "text-[var(--text-muted)]"
      }`}
    >
      {children}
    </span>
  );
}

export function AppShell({
  children,
  minimal = false,
  title = "Smarter shelf pricing",
  subtitle = BRAND_TAGLINE,
}: AppShellProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isHome = pathname === "/";
  const isInsights = pathname === "/insights";
  const isHistory = pathname === "/history";

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-base)]/85 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            href="/"
            className="shrink-0 rounded-2xl ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]/40"
            aria-label="Shelf Deal home"
          >
            <ShelfDealMark size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            {minimal || isHome ? (
              <Link href="/" className="inline-block">
                <ShelfDealWordmark size={minimal ? "md" : "sm"} />
              </Link>
            ) : (
              <>
                <Link href="/" className="inline-block">
                  <ShelfDealWordmark size="sm" />
                </Link>
                <h1 className="truncate text-lg font-bold text-[var(--text-primary)]">
                  {title}
                </h1>
                <p className="truncate text-xs text-[var(--text-secondary)]">{subtitle}</p>
              </>
            )}
            {isHome && !minimal && (
              <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                {subtitle}
              </p>
            )}
          </div>
          {user ? (
            <button
              type="button"
              onClick={() => logout()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-muted)] text-sm font-bold text-white shadow-lg shadow-[var(--accent-glow)]"
              title={`${user.firstName} — sign out`}
              aria-label="Sign out"
            >
              {initials}
            </button>
          ) : (
            <Link
              href="/login"
              className="shrink-0 rounded-xl bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--border)]"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 pb-28">{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 px-6 py-3 backdrop-blur-xl"
        aria-label="Main"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          <Link href="/" className="flex flex-col items-center gap-1">
            <NavIcon active={isHome}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2M11 18a7 7 0 100-14 7 7 0 000 14z" />
              </svg>
            </NavIcon>
            <span className={`text-[10px] font-medium ${isHome ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
              Search
            </span>
          </Link>
          <Link href="/insights" className="flex flex-col items-center gap-1">
            <NavIcon active={isInsights}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-8 4 5 5-9" />
              </svg>
            </NavIcon>
            <span className={`text-[10px] font-medium ${isInsights ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
              Insights
            </span>
          </Link>
          <Link href="/history" className="flex flex-col items-center gap-1">
            <NavIcon active={isHistory}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </NavIcon>
            <span className={`text-[10px] font-medium ${isHistory ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
              History
            </span>
          </Link>
        </div>
      </nav>
    </>
  );
}
