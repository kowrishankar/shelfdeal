import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/api";
import { addSearchHistory, getUserSearchHistory } from "@/lib/db/history";

export const runtime = "nodejs";

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const history = await getUserSearchHistory(user.id);
  return NextResponse.json({ history });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json();
  const productId = String(body.productId ?? "");
  const queryText = String(body.queryText ?? "").trim();
  const productName = String(body.productName ?? "").trim();

  if (!productId || !queryText) {
    return NextResponse.json(
      { error: "productId and queryText required" },
      { status: 400 },
    );
  }

  await addSearchHistory({
    userId: user.id,
    productId,
    queryText,
    productName: productName || queryText,
  });

  return NextResponse.json({ ok: true });
}
