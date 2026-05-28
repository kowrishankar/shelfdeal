export interface SearchSuggestion {
  id: string;
  name: string;
  imageUrl?: string;
  barcode?: string;
}

export interface DiscoverVariantSummary {
  id: string;
  label: string;
  searchQuery: string;
  packLabel: string;
  imageUrl?: string;
  retailerCount: number;
  score: number;
}

export interface ProductFamilySummary {
  id: string;
  label: string;
  imageUrl?: string;
  retailerCount: number;
  variants: DiscoverVariantSummary[];
}

export interface DiscoverSearchResponse {
  query: string;
  dbProducts: SearchSuggestion[];
  groups: ProductFamilySummary[];
  other: DiscoverVariantSummary[];
  retailerHits?: Partial<Record<string, number>>;
}
