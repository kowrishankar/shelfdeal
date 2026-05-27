import { getSql } from "../db";

export interface HistoryEntry {
  id: string;
  productId: string | null;
  queryText: string;
  productName: string | null;
  searchedAt: string;
  lowestPrice: number | null;
  opportunityScore: number | null;
}

export async function addSearchHistory(input: {
  userId: string;
  productId: string;
  queryText: string;
  productName: string;
}): Promise<void> {
  const sql = getSql();

  await sql`
    DELETE FROM user_search_history
    WHERE user_id = ${input.userId}::uuid
      AND product_id = ${input.productId}::uuid
      AND searched_at > now() - interval '1 hour'
  `;

  await sql`
    INSERT INTO user_search_history (user_id, product_id, query_text, product_name)
    VALUES (
      ${input.userId}::uuid,
      ${input.productId}::uuid,
      ${input.queryText.trim()},
      ${input.productName}
    )
  `;
}

export async function getUserSearchHistory(
  userId: string,
  limit = 50,
): Promise<HistoryEntry[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      h.id,
      h.product_id,
      h.query_text,
      h.product_name,
      h.searched_at,
      (
        SELECT MIN(rl.last_sort_price)
        FROM retailer_listings rl
        WHERE rl.product_id = h.product_id AND rl.last_sort_price IS NOT NULL
      ) AS lowest_price,
      pi.opportunity_score
    FROM user_search_history h
    LEFT JOIN product_intelligence pi ON pi.product_id = h.product_id
    WHERE h.user_id = ${userId}::uuid
    ORDER BY h.searched_at DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id as string,
    productId: (r.product_id as string) ?? null,
    queryText: r.query_text as string,
    productName: (r.product_name as string) ?? null,
    searchedAt: r.searched_at as string,
    lowestPrice: r.lowest_price != null ? Number(r.lowest_price) : null,
    opportunityScore:
      r.opportunity_score != null ? Number(r.opportunity_score) : null,
  }));
}
