import { z } from "zod";

export const SellSpeedSchema = z.enum(["Very Fast", "Fast", "Medium", "Slow"]);
export const RiskLevelSchema = z.enum(["Low", "Medium", "High"]);
export const ProfitPotentialSchema = z.enum(["Low", "Medium", "High"]);
export const TrendDirectionSchema = z.enum(["Rising", "Stable", "Declining"]);

export type SellSpeed = z.infer<typeof SellSpeedSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type ProfitPotential = z.infer<typeof ProfitPotentialSchema>;
export type TrendDirection = z.infer<typeof TrendDirectionSchema>;

export const ProductIntelligenceSchema = z.object({
  popularity_score: z.number().int().min(0).max(100),
  sell_speed: SellSpeedSchema,
  estimated_turnover: z.string(),
  confidence_score: z.number().min(0).max(1),
  risk_level: RiskLevelSchema,
  profit_potential: ProfitPotentialSchema,
  trend_direction: TrendDirectionSchema,
  buyer_type: z.array(z.string()).min(1),
  seasonality: z.string(),
  summary: z.string(),
});

export type ProductIntelligenceOutput = z.infer<typeof ProductIntelligenceSchema>;

export interface MarketSignalSnapshot {
  /** Internal app signals */
  search_count: number;
  search_velocity: number;
  retailer_coverage: number;
  price_samples: number;
  wholesale_cost: number | null;
  retail_median: number | null;
  retail_spread: number | null;
  margin_percent: number | null;
  price_trend_30d: number | null;
  /** Category heuristics */
  category: string;
  category_demand: number;
  category_turnover_days: number;
  seasonality_index: number;
  impulse_score: number;
  /** Derived trend proxy */
  demand_momentum: number;
  competition_density: number;
}

export interface ScoringResult extends ProductIntelligenceOutput {
  opportunity_score: number;
  wholesale_cost: number | null;
  estimated_resale: number | null;
  margin_percent: number | null;
  signals: MarketSignalSnapshot;
}

export interface ProductIntelligenceCard {
  productId: string;
  name: string;
  imageUrl: string | null;
  barcode: string | null;
  category: string | null;
  intelligence: ScoringResult;
  computedAt: string;
}

export interface DashboardFilters {
  q?: string;
  category?: string;
  sort?: "opportunity" | "popularity" | "margin" | "sell_speed" | "risk";
  risk?: RiskLevel;
  profit?: ProfitPotential;
  trend?: TrendDirection;
  section?: "trending" | "low_risk" | "high_margin" | "all";
}
