export interface CategoryProfile {
  id: string;
  label: string;
  demand: number;
  turnoverDays: number;
  impulse: number;
  seasonality: string;
  seasonalityIndex: number;
  buyerTypes: string[];
  keywords: RegExp;
}

export const CATEGORY_PROFILES: CategoryProfile[] = [
  {
    id: "impulse_sweets",
    label: "Impulse sweets & candy",
    demand: 82,
    turnoverDays: 7,
    impulse: 95,
    seasonality: "Year-round seller with Halloween & Easter spikes",
    seasonalityIndex: 0.7,
    buyerTypes: ["Convenience stores", "Discount stores", "Mini markets"],
    keywords: /candy|sweet|spray|sour|haribo|chocolate bar|gummy|lollipop/i,
  },
  {
    id: "soft_drinks",
    label: "Soft drinks & energy",
    demand: 78,
    turnoverDays: 5,
    impulse: 88,
    seasonality: "Strong summer demand",
    seasonalityIndex: 0.85,
    buyerTypes: ["Convenience stores", "Discount stores", "Online resellers"],
    keywords: /red bull|monster|energy drink|cola|fanta|pepsi|soft drink/i,
  },
  {
    id: "vape",
    label: "Vape & alternatives",
    demand: 72,
    turnoverDays: 10,
    impulse: 70,
    seasonality: "Regulatory-sensitive — monitor local rules",
    seasonalityIndex: 0.5,
    buyerTypes: ["Vape stores", "Convenience stores"],
    keywords: /vape|elf bar|disposable|e-cig|nicotine pouch/i,
  },
  {
    id: "spirits",
    label: "Spirits & whisky",
    demand: 68,
    turnoverDays: 21,
    impulse: 35,
    seasonality: "Holiday-driven sales (Nov–Dec peak)",
    seasonalityIndex: 0.9,
    buyerTypes: ["Convenience stores", "Gift shops", "Discount stores"],
    keywords: /whisky|whiskey|vodka|gin|rum|brandy|chivas|bacardi|spirit|70cl|75cl/i,
  },
  {
    id: "beer_cider",
    label: "Beer & cider",
    demand: 74,
    turnoverDays: 8,
    impulse: 60,
    seasonality: "Strong summer & bank-holiday demand",
    seasonalityIndex: 0.88,
    buyerTypes: ["Convenience stores", "Mini markets", "Discount stores"],
    keywords: /beer|lager|ale|cider|stella|carling|heineken/i,
  },
  {
    id: "snacking",
    label: "Snacks & crisps",
    demand: 80,
    turnoverDays: 6,
    impulse: 90,
    seasonality: "Year-round seller",
    seasonalityIndex: 0.65,
    buyerTypes: ["Convenience stores", "Discount stores", "Mini markets"],
    keywords: /crisp|walkers|pringles|snack|nuts|popcorn/i,
  },
  {
    id: "household",
    label: "Household essentials",
    demand: 70,
    turnoverDays: 14,
    impulse: 40,
    seasonality: "Year-round seller",
    seasonalityIndex: 0.4,
    buyerTypes: ["Convenience stores", "Discount stores", "Online resellers"],
    keywords: /tissue|toilet roll|washing|cleaner|detergent|kitchen roll/i,
  },
  {
    id: "gift_premium",
    label: "Premium & gift",
    demand: 55,
    turnoverDays: 35,
    impulse: 25,
    seasonality: "Holiday-driven sales",
    seasonalityIndex: 0.95,
    buyerTypes: ["Gift shops", "Convenience stores"],
    keywords: /gift set|hamper|limited edition|premium/i,
  },
];

const DEFAULT_PROFILE: CategoryProfile = {
  id: "general_grocery",
  label: "General grocery",
  demand: 62,
  turnoverDays: 14,
  impulse: 50,
  seasonality: "Year-round seller",
  seasonalityIndex: 0.5,
  buyerTypes: ["Convenience stores", "Mini markets", "Discount stores"],
  keywords: /.^/,
};

export function inferCategory(productName: string): CategoryProfile {
  for (const profile of CATEGORY_PROFILES) {
    if (profile.keywords.test(productName)) return profile;
  }
  return DEFAULT_PROFILE;
}
