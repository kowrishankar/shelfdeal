export type RetailerId =
  | "asda"
  | "tesco"
  | "sainsburys"
  | "amazon"
  | "costco"
  | "booker"
  | "morrisons"
  | "ocado";

export type PriceKind =
  | "standard"
  | "clubcard"
  | "promo"
  | "ex_vat"
  | "inc_vat"
  | "unit_ex_vat"
  | "unit_inc_vat"
  | "rrp"
  | "por";

export interface PriceLine {
  kind: PriceKind;
  label: string;
  amount: number;
  currency: "GBP";
  /** Profit on return % (wholesale) */
  percent?: number;
}

export interface RetailerListing {
  retailerId: RetailerId;
  retailerName: string;
  productName: string;
  url: string;
  imageUrl?: string;
  inStock: boolean;
  prices: PriceLine[];
  sortPrice: number;
  fetchedAt: string;
  /** Match confidence from canonical listing linking (when available). */
  matchConfidenceLabel?: "high" | "medium" | "low";
  matchConfidenceScore?: number;
  /** Units per case/pack when sold as multipack */
  packSize?: number;
  packLabel?: string;
  note?: string;
  error?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  barcode?: string;
  imageUrl?: string;
  cached?: boolean;
  query?: string;
  discoverOnSelect?: boolean;
}

export interface CompareProduct {
  id: string;
  name: string;
  barcode?: string;
  imageUrl?: string;
}

export interface PriceComparisonState {
  query: string;
  product: CompareProduct | null;
  listings: RetailerListing[];
  cheapest?: RetailerListing;
  statusMessage?: string;
  phase?: "cache" | "discover" | "prices";
  isComplete: boolean;
  fetchedAt: string;
}
