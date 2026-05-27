export interface HelpTopic {
  title: string;
  description: string;
  forYou: string;
}

export const HELP_TOPICS: Record<string, HelpTopic> = {
  lowest_price: {
    title: "Lowest price",
    description:
      "The cheapest live trade or shelf price we found across supermarkets and wholesalers for this exact product.",
    forYou:
      "Use this as your buying benchmark — if you can sell above your cost with room for margin, this retailer is worth ordering from.",
  },
  unit_cost: {
    title: "Your cost (per unit)",
    description:
      "What you pay for one item — from Booker trade price per can/bottle, or case price divided by pack size.",
    forYou:
      "This is the number to compare against your shelf price. Always work in single units when stocking convenience lines.",
  },
  margin: {
    title: "Margin (per unit)",
    description:
      "Estimated profit margin on one unit: (recommended shelf price − your unit cost) ÷ shelf price × 100.",
    forYou:
      "Aim for 20%+ on impulse lines. Below 15% may not cover wastage, card fees, and shrinkage.",
  },
  rrp: {
    title: "Recommended retail price (RRP)",
    description:
      "The price Booker or the brand suggests you charge customers (price mark / RRP).",
    forYou:
      "You can price at or below RRP depending on competition on your high street — don't go so low that margin disappears.",
  },
  por: {
    title: "POR (profit on return)",
    description:
      "Booker's wholesale metric: how much profit you could make versus their suggested RRP, expressed as a percentage.",
    forYou:
      "Higher POR (e.g. 30%+) usually means better room to make money. Compare with your actual selling price in your area.",
  },
  opportunity_score: {
    title: "Opportunity score",
    description:
      "A 0–100 score combining demand, sell speed, margin potential, risk, and market trend for independent retailers.",
    forYou:
      "90+ Excellent, 75–89 Strong Buy, 60–74 Moderate, 40–59 Caution, below 40 Avoid.",
  },
  confidence: {
    title: "Confidence",
    description:
      "How reliable this analysis is, based on how many retailers returned prices and how much data we have.",
    forYou:
      "Below 60% — treat tips as guidance only and verify prices yourself before a big order.",
  },
  turnover: {
    title: "Turnover (sell-through)",
    description:
      "How long stock typically sits before selling through, based on category norms and demand signals.",
    forYou:
      "Fast turnover (1–2 weeks) suits cash flow. Slow turnover ties up money — order smaller quantities first.",
  },
  seasonality: {
    title: "Season & holidays",
    description:
      "When this product type sells best — summer peaks, Christmas, Easter, bank holidays, etc.",
    forYou:
      "Stock up 2–4 weeks before peaks shown here. Reduce orders after the season to avoid dead stock.",
  },
  trend: {
    title: "Market trend",
    description:
      "Whether demand for this type of product is rising, stable, or declining from search and price signals.",
    forYou:
      "Rising = good time to stock up. Declining = buy lightly until trend improves.",
  },
  score_rating: {
    title: "Opportunity rating",
    description:
      "Your overall opportunity score (0–100) mapped to a simple label: Excellent, Strong Buy, Moderate, Caution, or Avoid.",
    forYou:
      "90+ Excellent — top pick. 75–89 Strong Buy — stock with confidence. 60–74 Moderate — okay in moderation. 40–59 Caution — small trial only. Below 40 Avoid — skip unless you know your customers want it.",
  },
  tips: {
    title: "Buying tips",
    description: "Practical suggestions tailored to this product's scores and prices.",
    forYou: "Read these before placing a wholesale order — they highlight risks and opportunities.",
  },
};
