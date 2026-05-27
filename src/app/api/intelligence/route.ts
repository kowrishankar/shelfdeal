import { NextRequest, NextResponse } from "next/server";
import { listIntelligenceDashboard } from "@/lib/intelligence/service";
import type { DashboardFilters } from "@/lib/intelligence/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const filters: DashboardFilters = {
    q: p.get("q") ?? undefined,
    category: p.get("category") ?? undefined,
    sort: (p.get("sort") as DashboardFilters["sort"]) ?? "opportunity",
    risk: (p.get("risk") as DashboardFilters["risk"]) ?? undefined,
    profit: (p.get("profit") as DashboardFilters["profit"]) ?? undefined,
    trend: (p.get("trend") as DashboardFilters["trend"]) ?? undefined,
    section: (p.get("section") as DashboardFilters["section"]) ?? "all",
  };

  try {
    const data = await listIntelligenceDashboard(filters);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load intelligence";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
