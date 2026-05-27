import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";
import type { AuthUser } from "./types";
import { getUserBySessionToken } from "../db/sessions";

export async function getSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserBySessionToken(token);
}

export function sessionCookieOptions(token: string, maxAgeSeconds: number) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
