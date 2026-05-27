import { NextRequest, NextResponse } from "next/server";
import {
  getOrComputeIntelligence,
  getProductInsightsBundle,
} from "@/lib/intelligence/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const force = request.nextUrl.searchParams.get("refresh") === "1";
  const detailed = request.nextUrl.searchParams.get("detailed") === "1";

  try {
    if (detailed) {
      const bundle = await getProductInsightsBundle(productId, { force });
      if (!bundle) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      return NextResponse.json(bundle);
    }

    const card = await getOrComputeIntelligence(productId, { force });
    if (!card) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(card);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Intelligence failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
