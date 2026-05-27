import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/api";
import { buildInsightsDashboard } from "@/lib/insights/dashboard";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getApiUser();
    const data = await buildInsightsDashboard(user?.id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
