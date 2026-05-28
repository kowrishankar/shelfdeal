type LogoVariant = "mark" | "wordmark" | "full";
type LogoSize = "sm" | "md" | "lg";

const markSizes: Record<LogoSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

const wordmarkClasses: Record<LogoSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
};

interface ShelfDealLogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}

export function ShelfDealMark({
  size = "md",
  className = "",
}: {
  size?: LogoSize;
  className?: string;
}) {
  const px = markSizes[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="11"
        fill="url(#sd-bg)"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
      />
      <rect x="8" y="11" width="24" height="2.5" rx="1.25" fill="white" fillOpacity="0.92" />
      <rect x="8" y="18" width="24" height="2.5" rx="1.25" fill="white" fillOpacity="0.72" />
      <rect x="8" y="25" width="17" height="2.5" rx="1.25" fill="white" fillOpacity="0.52" />
      <path
        d="M27 22.5h6.5a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H27a1.5 1.5 0 0 1-1.5-1.5v-8.5a1.5 1.5 0 0 1 1.5-1.5Z"
        fill="#d16c46"
      />
      <path
        d="M27.75 22.5V21a2.25 2.25 0 0 1 4.5 0v1.5"
        stroke="#d16c46"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        fill="#12181f"
        d="M28.2 26.8h1.4c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1h-1.4v1.1h1.4c1.2 0 2.2-1 2.2-2.2s-1-2.2-2.2-2.2h-1.4v-1.1zm0 3.4h1.5c.8 0 1.4-.6 1.4-1.4v-.2c0-.8-.6-1.4-1.4-1.4h-1.5v3z"
      />
      <defs>
        <linearGradient id="sd-bg" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#243040" />
          <stop offset="1" stopColor="#1a222c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ShelfDealWordmark({
  size = "md",
  className = "",
}: {
  size?: LogoSize;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 font-bold tracking-tight ${wordmarkClasses[size]} ${className}`}
    >
      <span className="text-[var(--text-primary)]">Shelf</span>
      <span className="text-[var(--accent)]">Deal</span>
    </span>
  );
}

export function ShelfDealLogo({
  variant = "full",
  size = "md",
  className = "",
}: ShelfDealLogoProps) {
  if (variant === "mark") {
    return <ShelfDealMark size={size} className={className} />;
  }

  if (variant === "wordmark") {
    return <ShelfDealWordmark size={size} className={className} />;
  }

  const gap = size === "sm" ? "gap-2" : size === "lg" ? "gap-3" : "gap-2.5";

  return (
    <span className={`inline-flex items-center ${gap} ${className}`}>
      <ShelfDealMark size={size} />
      <ShelfDealWordmark size={size} />
    </span>
  );
}
