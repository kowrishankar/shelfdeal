import { NextRequest, NextResponse } from "next/server";
import { searchCostcoViaApi } from "@/lib/retailers/costco";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "red bull";
  try {
    const products = await searchCostcoViaApi(q, 5);
    return NextResponse.json({
      query: q,
      count: products.length,
      products: products.map((p) => ({
        name: p.name,
        code: p.code,
        url: p.url,
        price: p.price?.value,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Costco search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
