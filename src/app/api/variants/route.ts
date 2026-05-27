import { NextRequest, NextResponse } from "next/server";
import { discoverProductVariants } from "@/lib/variants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ variants: [] });
  }

  try {
    const variants = await discoverProductVariants(q);
    return NextResponse.json({ query: q, variants });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Variant search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
