import { NextRequest, NextResponse } from "next/server";
import { fetchRetailerPrice } from "@/lib/price-fetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify Tesco product price fetch path used by compare flow. */
export async function GET(request: NextRequest) {
  const url =
    request.nextUrl.searchParams.get("url") ??
    "https://www.tesco.com/shop/en-GB/products/259153617";

  try {
    const listing = await fetchRetailerPrice("tesco", url);
    return NextResponse.json({
      ok: listing.prices.length > 0,
      inputUrl: url,
      resolvedUrl: listing.url,
      error: listing.error,
      productName: listing.productName,
      prices: listing.prices,
      sortPrice: listing.sortPrice,
      note: listing.note,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ ok: false, inputUrl: url, error: message }, { status: 502 });
  }
}
