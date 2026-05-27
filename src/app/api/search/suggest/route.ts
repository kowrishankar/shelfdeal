import { NextRequest, NextResponse } from "next/server";
import { suggestProductsFromDb } from "@/lib/db/product-search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ suggestions: [], hint: "Database not configured" });
  }

  try {
    const suggestions = await suggestProductsFromDb(q);
    return NextResponse.json({
      query: q,
      suggestions: suggestions.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        barcode: p.barcode,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Suggest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
