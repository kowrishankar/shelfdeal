import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ProductIntelligenceSchema, type ScoringResult } from "./types";

function templateSummary(result: ScoringResult, productName: string): string {
  const parts: string[] = [];
  parts.push(
    `${productName} scores ${result.popularity_score}/100 for demand with ${result.sell_speed.toLowerCase()} sell-through (${result.estimated_turnover}).`,
  );
  parts.push(
    `Best suited for ${result.buyer_type.slice(0, 2).join(" and ")}.`,
  );
  if (result.margin_percent != null) {
    parts.push(
      `Estimated margin ~${result.margin_percent.toFixed(0)}% (${result.profit_potential.toLowerCase()} profit potential).`,
    );
  }
  if (result.trend_direction === "Rising") {
    parts.push("Demand signals are trending upward.");
  } else if (result.trend_direction === "Declining") {
    parts.push("Watch for slowing demand before over-ordering.");
  }
  if (result.risk_level === "High") {
    parts.push("Higher stock risk — order conservatively until sell-through is proven.");
  }
  return parts.join(" ");
}

export async function enrichWithAiSummary(
  productName: string,
  scored: ScoringResult,
): Promise<ScoringResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ...scored,
      summary: templateSummary(scored, productName),
    };
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const signalDigest = {
    popularity: scored.popularity_score,
    sell_speed: scored.sell_speed,
    turnover: scored.estimated_turnover,
    trend: scored.trend_direction,
    risk: scored.risk_level,
    profit: scored.profit_potential,
    margin_percent: scored.margin_percent,
    category: scored.signals.category,
    search_interest: scored.signals.search_velocity,
    retailer_coverage: scored.signals.retailer_coverage,
    seasonality: scored.seasonality,
    buyer_types: scored.buyer_type,
  };

  try {
    const completion = await client.chat.completions.parse({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are a UK wholesale buying advisor for independent shop owners, corner shops, and convenience retailers.
Interpret the provided DATA-DRIVEN scores only. Do not invent statistics.
Write a concise 1-3 sentence summary for the reseller: why it may sell, who buys it, trend, risks.
Keep under 280 characters total in the summary field.`,
        },
        {
          role: "user",
          content: `Product: ${productName}\nComputed signals:\n${JSON.stringify(signalDigest, null, 2)}`,
        },
      ],
      response_format: zodResponseFormat(ProductIntelligenceSchema, "product_intelligence"),
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (parsed?.summary) {
      return {
        ...scored,
        ...parsed,
        opportunity_score: scored.opportunity_score,
        wholesale_cost: scored.wholesale_cost,
        estimated_resale: scored.estimated_resale,
        margin_percent: scored.margin_percent,
        signals: scored.signals,
      };
    }
  } catch {
    // fall through to template
  }

  return {
    ...scored,
    summary: templateSummary(scored, productName),
  };
}
