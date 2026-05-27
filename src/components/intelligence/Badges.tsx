import type {
  ProfitPotential,
  RiskLevel,
  SellSpeed,
  TrendDirection,
} from "@/lib/intelligence/types";

export function PopularityBadge({ score }: { score: number }) {
  const isHigh = score >= 75;
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold ${
        isHigh
          ? "bg-[var(--accent)]/20 text-[var(--accent)]"
          : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
      }`}
    >
      {score}
      <span className="ml-1 font-normal opacity-80">score</span>
    </span>
  );
}

export function SellSpeedBadge({ speed }: { speed: SellSpeed }) {
  const styles: Record<SellSpeed, string> = {
    "Very Fast": "bg-[var(--positive-bg)] text-[var(--positive-text)]",
    Fast: "bg-[var(--positive-bg)] text-[var(--positive-text)]",
    Medium: "bg-[var(--accent)]/15 text-[var(--accent)]",
    Slow: "bg-[var(--bg-elevated)] text-[var(--text-muted)]",
  };
  return (
    <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${styles[speed]}`}>
      {speed}
    </span>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    Low: "bg-[var(--positive-bg)] text-[var(--positive-text)]",
    Medium: "bg-[var(--warning)]/15 text-[var(--warning)]",
    High: "bg-[var(--danger)]/15 text-[#f0a8a8]",
  };
  return (
    <span className={`rounded-lg px-2 py-1 text-xs font-semibold ring-1 ring-[var(--border)] ${styles[level]}`}>
      {level} risk
    </span>
  );
}

export function ProfitBadge({ level }: { level: ProfitPotential }) {
  const styles: Record<ProfitPotential, string> = {
    High: "bg-[var(--positive-bg)] text-[var(--positive-text)]",
    Medium: "bg-[var(--accent)]/15 text-[var(--accent)]",
    Low: "bg-[var(--bg-elevated)] text-[var(--text-muted)]",
  };
  return (
    <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${styles[level]}`}>
      {level} margin
    </span>
  );
}

export function TrendIndicator({ trend }: { trend: TrendDirection }) {
  const styles: Record<TrendDirection, string> = {
    Rising: "text-[var(--positive-text)]",
    Stable: "text-[var(--text-secondary)]",
    Declining: "text-[#f0a8a8]",
  };
  const icon: Record<TrendDirection, string> = {
    Rising: "↑",
    Stable: "→",
    Declining: "↓",
  };
  return (
    <span className={`text-sm font-semibold ${styles[trend]}`}>
      {icon[trend]} {trend}
    </span>
  );
}

export function OpportunityRing({ score }: { score: number }) {
  const color =
    score >= 75 ? "var(--accent)" : score >= 50 ? "var(--warning)" : "var(--text-muted)";
  return (
    <div
      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${color} ${score * 3.6}deg, var(--bg-elevated) 0deg)`,
      }}
    >
      <div className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-[var(--bg-card)] text-center ring-1 ring-[var(--border)]">
        <span className="text-lg font-bold leading-none text-[var(--text-primary)]">
          {score}
        </span>
        <span className="text-[9px] uppercase text-[var(--text-muted)]">score</span>
      </div>
    </div>
  );
}
