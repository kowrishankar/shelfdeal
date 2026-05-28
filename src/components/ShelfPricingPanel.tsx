"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeShelfEconomics,
  detectMembershipOffers,
  suggestSellPrice,
} from "@/lib/shelf-pricing";
import { HELP_TOPICS } from "@/lib/intelligence/help-text";
import { InfoTip } from "@/components/intelligence/InfoTip";
import type { RetailerListing } from "@/lib/types";

interface ShelfPricingPanelProps {
  listings: RetailerListing[];
  productKey?: string;
  /** Render without outer card — for use inside collapsible sections */
  embedded?: boolean;
}

function formatGbp(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

function parseSellInput(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function ShelfPricingPanel({
  listings,
  productKey = "default",
  embedded = false,
}: ShelfPricingPanelProps) {
  const membershipOffers = useMemo(
    () => detectMembershipOffers(listings),
    [listings],
  );
  const hasMembership = membershipOffers.length > 0;

  const [sellInput, setSellInput] = useState("");
  const [useMembership, setUseMembership] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setTouched(false);
    setUseMembership(false);
    setSellInput("");
  }, [productKey]);

  useEffect(() => {
    if (touched || !listings.length) return;
    const suggested = suggestSellPrice(listings, useMembership);
    if (suggested != null) {
      setSellInput(suggested.toFixed(2));
    }
  }, [listings, useMembership, touched]);

  const sellPrice = parseSellInput(sellInput);
  const economics = useMemo(() => {
    if (sellPrice == null || !listings.length) return null;
    return computeShelfEconomics(sellPrice, listings, useMembership);
  }, [sellPrice, listings, useMembership]);

  if (!listings.some((l) => l.prices.length > 0)) {
    return null;
  }

  const content = (
    <>
      <div className={embedded ? "mb-3" : "mb-4 flex items-start justify-between gap-2"}>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Try a shelf price
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            See profit per unit at different selling prices.
          </p>
        </div>
        {!embedded && (
          <InfoTip topic={HELP_TOPICS.margin} label="Shelf pricing">
            <span className="link-accent shrink-0 text-sm">Help</span>
          </InfoTip>
        )}
      </div>

      <label className="block">
        <span className="section-label">Selling price (per unit)</span>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-lg font-medium text-[var(--text-muted)]">£</span>
          <input
            type="text"
            inputMode="decimal"
            value={sellInput}
            onChange={(e) => {
              setTouched(true);
              setSellInput(e.target.value);
            }}
            placeholder="0.00"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 text-lg font-semibold tabular-nums text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          />
        </div>
      </label>

      {hasMembership && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={useMembership}
              onChange={(e) => setUseMembership(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--text-primary)]">
                I have a membership card
              </span>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                Use Clubcard and other member prices when comparing against
                supermarkets.
              </span>
            </span>
          </label>
          {useMembership && (
            <ul className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3">
              {membershipOffers.map((offer) => (
                <li
                  key={offer.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-[var(--text-secondary)]">
                    {offer.label}
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatGbp(offer.price)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {economics && sellPrice != null ? (
        <>
          <div className="mt-4 stat-tile text-center">
            <p className="section-label">Profit per unit</p>
            <p className="stat-value mt-1 text-lg">
              {formatGbp(economics.profitPerUnit)}
            </p>
            {economics.marginPercent != null && economics.marginPercent < 15 && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Low margin — check card fees and wastage before bulk ordering.
              </p>
            )}
          </div>

          <div className="mt-4 space-y-0">
            <div className="breakdown-row">
              <span className="text-sm text-[var(--text-secondary)]">
                Your cost (per unit)
              </span>
              <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                {formatGbp(economics.unitCost)}
                {economics.unitCostRetailer ? (
                  <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
                    via {economics.unitCostRetailer}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="breakdown-row">
              <span className="text-sm text-[var(--text-secondary)]">
                Your sell price
              </span>
              <span className="text-sm font-semibold tabular-nums text-[var(--accent)]">
                {formatGbp(economics.sellPrice)}
              </span>
            </div>
            {economics.referenceRetail != null && (
              <div className="breakdown-row">
                <span className="text-sm text-[var(--text-secondary)]">
                  {economics.referenceRetailLabel}
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatGbp(economics.referenceRetail)}
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Enter a selling price to see profit per unit.
        </p>
      )}
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return <section className="surface-card p-5">{content}</section>;
}
