import { NextRequest, NextResponse } from "next/server";
import {
  extractAsinFromAmazonUrl,
  fetchAmazonPrice,
} from "@/lib/retailers/amazon";
import { isAmazonCreatorsConfigured } from "@/lib/retailers/amazon-creators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify Amazon price engine (Creators API or HTML fallback). */
export async function GET(request: NextRequest) {
  const url =
    request.nextUrl.searchParams.get("url") ??
    "https://www.amazon.co.uk/dp/B00439UD6K";
  const asin =
    request.nextUrl.searchParams.get("asin") ??
    extractAsinFromAmazonUrl(url) ??
    undefined;

  if (!asin) {
    return NextResponse.json({ ok: false, error: "No ASIN in URL" }, { status: 400 });
  }

  const listing = await fetchAmazonPrice(url);
  return NextResponse.json({
    ok: listing.prices.length > 0,
    asin,
    creatorsApiConfigured: isAmazonCreatorsConfigured(),
    listing: {
      productName: listing.productName,
      sortPrice: listing.sortPrice,
      prices: listing.prices,
      error: listing.error,
      note: listing.note,
    },
  });
}
