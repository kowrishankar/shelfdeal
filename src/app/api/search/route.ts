import { NextRequest, NextResponse } from "next/server";
import {
  findProductsByBarcode,
  findProductsByQuery,
} from "@/lib/db/product-search";
import { normalizeQuery } from "@/lib/slug";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      results: [],
      hint: "Database not configured",
    });
  }

  try {
    const normalized = normalizeQuery(q);
    const isBarcode = /^\d{8,14}$/.test(q.replace(/\s/g, ""));

    const matches = isBarcode
      ? await findProductsByBarcode(q.replace(/\s/g, ""))
      : await findProductsByQuery(q);

    if (matches.length === 1) {
      const product = matches[0];
      return NextResponse.json({
        results: [
          {
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            imageUrl: product.imageUrl,
            cached: true,
          },
        ],
        query: normalized,
      });
    }

    if (matches.length > 1) {
      return NextResponse.json({
        results: matches.map((product) => ({
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          imageUrl: product.imageUrl,
          cached: true,
        })),
        query: normalized,
      });
    }

    return NextResponse.json({
      results: [
        {
          id: "new",
          name: q,
          query: normalized,
          cached: false,
          discoverOnSelect: true,
        },
      ],
      query: normalized,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
