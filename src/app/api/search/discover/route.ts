import { NextRequest, NextResponse } from "next/server";
import { discoverGroupedSearch } from "@/lib/search-groups";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({
      query: q,
      dbProducts: [],
      groups: [],
      other: [],
    });
  }

  try {
    const result = await discoverGroupedSearch(q);
    return NextResponse.json({
      query: result.query,
      dbProducts: result.dbProducts.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        barcode: p.barcode,
      })),
      groups: result.groups.map((g) => ({
        id: g.id,
        label: g.label,
        imageUrl: g.imageUrl,
        retailerCount: g.retailerCount,
        variants: g.variants.map((v) => ({
          id: v.id,
          label: v.label,
          searchQuery: v.searchQuery,
          packLabel: v.packLabel,
          imageUrl: v.imageUrl,
          retailerCount: v.retailerCount,
          score: v.score,
          confidence: v.confidence,
        })),
      })),
      other: result.other.map((v) => ({
        id: v.id,
        label: v.label,
        searchQuery: v.searchQuery,
        packLabel: v.packLabel,
        imageUrl: v.imageUrl,
        retailerCount: v.retailerCount,
        score: v.score,
        confidence: v.confidence,
      })),
      retailerHits: result.retailerHits,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discover failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
