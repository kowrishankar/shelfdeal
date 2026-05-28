"use client";

import { useMemo } from "react";
import { buildRetailPricingInsights } from "@/lib/intelligence/retail-insights";
import { HELP_TOPICS } from "@/lib/intelligence/help-text";
import { InfoTip } from "@/components/intelligence/InfoTip";
import { ShelfPricingPanel } from "@/components/ShelfPricingPanel";
import type { RetailerListing } from "@/lib/types";

interface UnitEconomicsSectionProps {
  listings: RetailerListing[];
  productKey?: string;
}

function formatPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

export function UnitEconomicsSection({
  listings,
  productKey,
}: UnitEconomicsSectionProps) {
  const retail = useMemo(
    () => buildRetailPricingInsights(listings),
    [listings],
  );

  const economicsHint =
    retail.unitCost == null
      ? "Needs Booker wholesale price"
      : retail.rrp == null && retail.lowestPrice == null
        ? "Needs RRP or retail price"
        : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="stat-tile">
          <div className="mb-1 flex items-center justify-between gap-1">
            <p className="section-label">Margin</p>
            <InfoTip topic={HELP_TOPICS.margin} label="Margin" />
          </div>
          <p className="stat-value">{formatPct(retail.marginPercent)}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {retail.marginPercent != null
              ? retail.marginLabel
              : economicsHint}
          </p>
        </div>
        <div className="stat-tile">
          <div className="mb-1 flex items-center justify-between gap-1">
            <p className="section-label">POR</p>
            <InfoTip topic={HELP_TOPICS.por} label="POR" />
          </div>
          <p className="stat-value">{formatPct(retail.porPercent)}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {retail.porPercent != null ? "vs RRP" : economicsHint ?? "vs wholesale"}
          </p>
        </div>
      </div>

      <ShelfPricingPanel listings={listings} productKey={productKey} embedded />
    </div>
  );
}
