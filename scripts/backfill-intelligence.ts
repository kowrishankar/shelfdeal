/**
 * Compute intelligence for all products with retailer listings.
 * Run: npm run db:intelligence
 */
import { getSql } from "../src/lib/db";
import { getOrComputeIntelligence } from "../src/lib/intelligence/service";

async function main() {
  const sql = getSql();
  const rows = await sql`
    SELECT DISTINCT p.id FROM products p
    JOIN retailer_listings rl ON rl.product_id = p.id
    WHERE rl.last_sort_price IS NOT NULL
  `;

  console.log(`Backfilling ${rows.length} products…`);
  for (const row of rows) {
    const id = row.id as string;
    try {
      const card = await getOrComputeIntelligence(id, { force: true });
      console.log(
        "✓",
        card?.name,
        "opportunity:",
        card?.intelligence.opportunity_score,
      );
    } catch (e) {
      console.error("✗", id, e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
