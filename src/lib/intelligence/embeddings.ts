import OpenAI from "openai";
import { getSql } from "../db";

export async function upsertProductEmbedding(
  productId: string,
  text: string,
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return;

  const client = new OpenAI({ apiKey });
  const model = "text-embedding-3-small";

  const res = await client.embeddings.create({
    model,
    input: text.slice(0, 8000),
  });

  const vector = res.data[0]?.embedding;
  if (!vector) return;

  const sql = getSql();
  const vectorLiteral = `[${vector.join(",")}]`;

  await sql`
    INSERT INTO product_embeddings (product_id, embedding, model, updated_at)
    VALUES (${productId}::uuid, ${vectorLiteral}::vector, ${model}, now())
    ON CONFLICT (product_id) DO UPDATE SET
      embedding = EXCLUDED.embedding,
      model = EXCLUDED.model,
      updated_at = now()
  `;
}

export async function findSimilarProducts(
  productId: string,
  limit = 5,
): Promise<{ productId: string; name: string; similarity: number }[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT p.id, p.canonical_name,
           1 - (pe.embedding <=> (
             SELECT embedding FROM product_embeddings WHERE product_id = ${productId}::uuid
           )) AS similarity
    FROM product_embeddings pe
    JOIN products p ON p.id = pe.product_id
    WHERE pe.product_id != ${productId}::uuid
    ORDER BY pe.embedding <=> (
      SELECT embedding FROM product_embeddings WHERE product_id = ${productId}::uuid
    )
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    productId: r.id as string,
    name: r.canonical_name as string,
    similarity: Number(r.similarity),
  }));
}
