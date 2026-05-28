import { NextRequest, NextResponse } from "next/server";
import { searchTescoViaXapi } from "@/lib/retailers/tesco-xapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify Tesco discovery uses xAPI (works on Vercel without HTML scrape). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "red bull";

  try {
    const hits = await searchTescoViaXapi(q, 5);
    return NextResponse.json({
      ok: true,
      engine: "tesco-xapi",
      query: q,
      count: hits.length,
      sample: hits.map((h) => ({ name: h.name, url: h.url })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "search failed";
    return NextResponse.json({ ok: false, query: q, error: message }, { status: 502 });
  }
}
