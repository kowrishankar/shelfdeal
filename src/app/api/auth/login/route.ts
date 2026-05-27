import { NextResponse } from "next/server";
import { validateEmail, verifyPassword } from "@/lib/auth/password";
import { sessionMaxAgeSeconds } from "@/lib/auth/api";
import { sessionCookieOptions } from "@/lib/auth/session-server";
import { findUserByEmail } from "@/lib/db/users";
import { createSession } from "@/lib/db/sessions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");

    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 },
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const { passwordHash: _, ...safeUser } = user;
    const token = await createSession(safeUser.id);
    const response = NextResponse.json({ user: safeUser });
    response.cookies.set(
      sessionCookieOptions(token, sessionMaxAgeSeconds()),
    );
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
