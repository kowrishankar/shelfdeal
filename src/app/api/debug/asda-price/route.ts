import { NextRequest, NextResponse } from "next/server";
import {
  extractCinFromAsdaUrl,
  fetchAsdaProductByCin,
  listingFromAsdaAlgoliaProduct,
} from "@/lib/retailers/asda-algolia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quick check that production uses the ASDA catalogue API (not HTML scrape). */
export async function GET(request: NextRequest) {
  const url =
    request.nextUrl.searchParams.get("url") ??
    "https://www.asda.com/groceries/product/12-year-old-single-malt-scotch-whisky-35cl/7685171";
  const cin =
    request.nextUrl.searchParams.get("cin") ?? extractCinFromAsdaUrl(url);

  if (!cin) {
    return NextResponse.json({ ok: false, error: "No CIN in URL" }, { status: 400 });
  }

  try {
    const product = await fetchAsdaProductByCin(cin);
    if (!product) {
      return NextResponse.json({ ok: false, cin, error: "Not in catalogue" }, { status: 404 });
    }
    const listing = listingFromAsdaAlgoliaProduct(product, url);
    return NextResponse.json({
      ok: true,
      engine: "algolia",
      cin,
      name: product.NAME,
      price: product.PRICES?.EN?.PRICE,
      listing: listing
        ? { sortPrice: listing.sortPrice, prices: listing.prices }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ ok: false, cin, error: message }, { status: 502 });
  }
}
