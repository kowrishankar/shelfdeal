import { NextResponse } from "next/server";
import {
  hashPassword,
  validateEmail,
  validatePassword,
} from "@/lib/auth/password";
import { sessionMaxAgeSeconds } from "@/lib/auth/api";
import { sessionCookieOptions } from "@/lib/auth/session-server";
import { createUser, findUserByEmail } from "@/lib/db/users";
import { createSession } from "@/lib/db/sessions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First and last name are required" },
        { status: 400 },
      );
    }

    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 },
      );
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({
      firstName,
      lastName,
      email,
      passwordHash,
    });

    const token = await createSession(user.id);
    const response = NextResponse.json({ user });
    response.cookies.set(
      sessionCookieOptions(token, sessionMaxAgeSeconds()),
    );
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed";
    if (message.includes("users") || message.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Database not ready. Run db/schema-auth.sql on your Neon database.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
