"use client";

import Image from "next/image";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  /** card = grid tile, hero = large (deprecated), compact = thumbnail beside score */
  variant?: "card" | "hero" | "compact";
  className?: string;
}

function Placeholder({ variant }: { variant: "card" | "hero" | "compact" }) {
  return (
    <div
      className={`flex items-center justify-center bg-[var(--bg-elevated)] text-[var(--text-muted)] ${
        variant === "hero"
          ? "h-full min-h-[12rem] w-full rounded-[var(--radius-card)]"
          : variant === "compact"
            ? "h-20 w-20 shrink-0 rounded-xl ring-1 ring-[var(--border)]"
            : "h-full w-full"
      }`}
    >
      <svg
        className={
          variant === "hero"
            ? "h-16 w-16 opacity-35"
            : variant === "compact"
              ? "h-8 w-8 opacity-40"
              : "h-12 w-12 opacity-40"
        }
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.25}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    </div>
  );
}

export function ProductImage({
  src,
  alt,
  variant = "card",
  className = "",
}: ProductImageProps) {
  if (!src) {
    return <Placeholder variant={variant} />;
  }

  if (variant === "hero") {
    return (
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-card)] bg-[var(--bg-elevated)] ring-1 ring-[var(--border)] ${className}`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain p-4"
          sizes="(max-width: 512px) 100vw, 480px"
          unoptimized
          priority
        />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)] ring-1 ring-[var(--border)] ${className}`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain p-1.5"
          sizes="80px"
          unoptimized
          priority
        />
      </div>
    );
  }

  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-[var(--bg-elevated)] ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain p-3"
        sizes="(max-width: 512px) 50vw, 200px"
        unoptimized
      />
    </div>
  );
}
