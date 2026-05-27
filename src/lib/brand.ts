export const BRAND_NAME = "Shelf Deal";
export const BRAND_TAGLINE =
  "Prices, margins & AI insights for UK shop owners";
export const BRAND_DESCRIPTION =
  "Compare product prices across ASDA, Tesco, Sainsbury's, Amazon, Costco, Booker and more. Built for corner shops and convenience retailers.";

export function pageTitle(segment?: string): string {
  return segment ? `${segment} | ${BRAND_NAME}` : `${BRAND_NAME} — UK retailer price comparison`;
}
