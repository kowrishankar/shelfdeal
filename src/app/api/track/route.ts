import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/api";
import {
  getTrackedProducts,
  isProductTracked,
  trackProduct,
  untrackProduct,
} from "@/lib/db/tracking";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const productId = request.nextUrl.searchParams.get("productId");
  if (productId) {
    const tracked = await isProductTracked(user.id, productId);
    return NextResponse.json({ tracked });
  }

  const tracked = await getTrackedProducts(user.id);
  return NextResponse.json({ tracked });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json();
  const productId = String(body.productId ?? "");
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  await trackProduct(user.id, productId);
  return NextResponse.json({ tracked: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const productId = request.nextUrl.searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  await untrackProduct(user.id, productId);
  return NextResponse.json({ tracked: false });
}
