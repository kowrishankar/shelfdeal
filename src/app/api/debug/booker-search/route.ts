import { NextRequest, NextResponse } from "next/server";
import { searchBooker } from "@/lib/retailers/search/booker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify Booker HTML search (may need SCRAPER_API_KEY on Vercel). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "red bull";
  const hasProxy = Boolean(process.env.SCRAPER_API_KEY?.trim());

  try {
    const hits = await searchBooker(q);
    return NextResponse.json({
      ok: hits.length > 0,
      engine: hasProxy ? "html+scraperapi" : "html",
      query: q,
      count: hits.length,
      sample: hits.slice(0, 5).map((h) => ({ name: h.name, url: h.url })),
      hint:
        hits.length === 0 && !hasProxy
          ? "Set SCRAPER_API_KEY on Vercel if Booker returns 0 hits (datacenter block)."
          : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "search failed";
    return NextResponse.json(
      { ok: false, query: q, engine: hasProxy ? "html+scraperapi" : "html", error: message },
      { status: 502 },
    );
  }
}
