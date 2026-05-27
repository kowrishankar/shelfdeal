import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/api";

export const runtime = "nodejs";

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
