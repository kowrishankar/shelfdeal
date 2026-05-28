import { NextRequest, NextResponse } from "next/server";
import { fetchCostcoPrice } from "@/lib/retailers/costco";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url =
    request.nextUrl.searchParams.get("url") ??
    "https://www.costco.co.uk/Grocery-Household/Grocery-Delivery/Chivas-Regal-12-Year-Old-70cl/p/3556";

  try {
    const listing = await fetchCostcoPrice(url);
    return NextResponse.json({
      ok: listing.prices.length > 0,
      sortPrice: listing.sortPrice,
      productName: listing.productName,
      prices: listing.prices,
      error: listing.error,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Costco price failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
