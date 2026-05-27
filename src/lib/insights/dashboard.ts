import { getSql } from "../db";
import { CATEGORY_PROFILES, inferCategory } from "../intelligence/category";
import { getUserSearchHistory } from "../db/history";
import { getTrackedProducts } from "../db/tracking";

export interface CategoryTrend {
  id: string;
  label: string;
  demand: number;
  trend: "Rising" | "Stable" | "Declining";
  seasonality: string;
  searchCount: number;
}

export interface PromotionDeal {
  productId: string;
  name: string;
  opportunityScore: number;
  marginPercent: number | null;
  summary: string;
}

export interface PersonalizedInsight {
  title: string;
  body: string;
}

export interface InsightsDashboardData {
  categoryTrends: CategoryTrend[];
  promotions: PromotionDeal[];
  personalized: PersonalizedInsight[];
  trackedProducts: Awaited<ReturnType<typeof getTrackedProducts>>;
}

export async function buildInsightsDashboard(
  userId?: string,
): Promise<InsightsDashboardData> {
  const sql = getSql();

  const [promoRows, history, trackedProducts] = await Promise.all([
    sql`
      SELECT
        p.id,
        p.canonical_name,
        pi.opportunity_score,
        pi.margin_percent,
        pi.summary
      FROM product_intelligence pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.opportunity_score >= 70
        AND pi.expires_at > now()
      ORDER BY pi.opportunity_score DESC, p.search_count DESC
      LIMIT 8
    `,
    userId ? getUserSearchHistory(userId, 30) : Promise.resolve([]),
    userId ? getTrackedProducts(userId) : Promise.resolve([]),
  ]);

  const promotions: PromotionDeal[] = promoRows.map((r) => ({
    productId: r.id as string,
    name: r.canonical_name as string,
    opportunityScore: Number(r.opportunity_score),
    marginPercent: r.margin_percent != null ? Number(r.margin_percent) : null,
    summary: (r.summary as string) ?? "",
  }));

  const categoryCounts = new Map<string, number>();
  for (const entry of history) {
    const name = entry.productName ?? entry.queryText;
    const cat = inferCategory(name);
    categoryCounts.set(cat.id, (categoryCounts.get(cat.id) ?? 0) + 1);
  }

  const categoryTrends: CategoryTrend[] = CATEGORY_PROFILES.map((profile) => {
    const searchCount = categoryCounts.get(profile.id) ?? 0;
    const trend: CategoryTrend["trend"] =
      profile.seasonalityIndex >= 0.85
        ? "Rising"
        : profile.seasonalityIndex <= 0.5
          ? "Declining"
          : "Stable";
    return {
      id: profile.id,
      label: profile.label,
      demand: profile.demand + Math.min(searchCount * 3, 15),
      trend,
      seasonality: profile.seasonality,
      searchCount,
    };
  }).sort((a, b) => b.demand - a.demand);

  const personalized = buildPersonalizedInsights(history, categoryCounts);

  return {
    categoryTrends,
    promotions,
    personalized,
    trackedProducts,
  };
}

function buildPersonalizedInsights(
  history: Awaited<ReturnType<typeof getUserSearchHistory>>,
  categoryCounts: Map<string, number>,
): PersonalizedInsight[] {
  const insights: PersonalizedInsight[] = [];

  if (!history.length) {
    insights.push({
      title: "Start searching to unlock tips",
      body: "Your insights will reflect categories and products you compare. Search from the home tab, then return here for tailored guidance.",
    });
    return insights;
  }

  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  if (topCategories.length) {
    const labels = topCategories
      .map(([id]) => CATEGORY_PROFILES.find((c) => c.id === id)?.label ?? id)
      .join(" and ");
    insights.push({
      title: `You often compare ${labels}`,
      body: `Based on your recent searches, focus on margin and turnover in these aisles. Track standout SKUs to catch price drops before reordering.`,
    });
  }

  const highScore = history.filter(
    (h) => h.opportunityScore != null && h.opportunityScore >= 75,
  );
  if (highScore.length) {
    insights.push({
      title: `${highScore.length} strong opportunities in your history`,
      body: "Revisit products scored 75+ for reorder ideas. Booker POR and shelf RRP often move weekly — compare again before placing cases.",
    });
  }

  const energy = categoryCounts.get("soft_drinks") ?? 0;
  if (energy >= 2) {
    insights.push({
      title: "Energy drinks: summer uplift ahead",
      body: "Soft drinks & energy categories typically spike in warmer months. Stock multipacks early and watch Tesco Clubcard vs Booker case costs.",
    });
  }

  const spirits = categoryCounts.get("spirits") ?? 0;
  if (spirits >= 1) {
    insights.push({
      title: "Spirits: plan for seasonal peaks",
      body: "Gift packs and 70cl lines sell strongly Nov–Dec. Keep an eye on Costco multipacks vs Booker singles for margin.",
    });
  }

  if (insights.length === 1 && history.length >= 3) {
    insights.push({
      title: "Keep your history fresh",
      body: "You have a solid search trail. Use price tracking on key lines so this page shows live changes across retailers.",
    });
  }

  return insights;
}
