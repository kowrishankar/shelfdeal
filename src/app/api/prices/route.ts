import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/db/products";

/** @deprecated Use /api/compare/stream for progressive results */
export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const product = await getProductById(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({
    redirect: `/api/compare/stream?productId=${productId}&q=${encodeURIComponent(product.canonicalName)}`,
  });
}
