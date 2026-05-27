import type { RetailerId } from "../../types";

export interface RetailerSearchHit {
  retailerId: RetailerId;
  url: string;
  name: string;
  imageUrl?: string;
  /** e.g. "Case of 12 x 250ml", "Single unit" */
  packLabel?: string;
}

export type RetailerSearchFn = (
  query: string,
) => Promise<RetailerSearchHit[]>;
