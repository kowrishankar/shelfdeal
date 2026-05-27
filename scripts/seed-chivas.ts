/**
 * Seed the Chivas example product. Run: npx tsx scripts/seed-chivas.ts
 * Requires DATABASE_URL in .env.local
 */
import { upsertProductWithListings } from "../src/lib/db/products";

async function main() {
  const { product } = await upsertProductWithListings(
    "Chivas Regal 12 Year Old Blended Scotch Whisky 70cl",
    "Chivas Regal 12 Year Old Blended Scotch Whisky 70cl",
    [
      {
        retailerId: "asda",
        url: "https://www.asda.com/groceries/product/scotch-malt-whisky/chivas-blended-scotch-whisky-70cl/482988",
        name: "Chivas Blended Scotch Whisky 70cl",
      },
      {
        retailerId: "tesco",
        url: "https://www.tesco.com/shop/en-GB/products/256565653",
        name: "Chivas Regal Aged 12 Years Blended Scotch Whisky 70cl",
      },
      {
        retailerId: "sainsburys",
        url: "https://www.sainsburys.co.uk/gol-ui/product/chivas-regal-12-year-old-blended-scotch-whisky-70cl",
        name: "Chivas Regal 12 Year Old Blended Scotch Whisky 70cl",
      },
      {
        retailerId: "amazon",
        url: "https://www.amazon.co.uk/dp/B00439UD6K",
        name: "Chivas Regal 12 Year Old Blended Scotch Whisky 70cl",
      },
      {
        retailerId: "costco",
        url: "https://www.costco.co.uk/Grocery-Household/Grocery-Delivery/Chivas-Regal-12-Year-Old-70cl/p/3556",
        name: "Chivas Regal 12 Year Old, 70cl",
      },
      {
        retailerId: "booker",
        url: "https://www.booker.co.uk/products/product?Code=176362",
        name: "Chivas Regal Blended Scotch Whisky 70cl",
      },
    ],
    "5000299212936",
  );
  console.log("Seeded product:", product.id, product.canonicalName);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
