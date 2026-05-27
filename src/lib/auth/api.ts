import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE_DAYS } from "./constants";
import type { AuthUser } from "./types";
import { getUserBySessionToken } from "../db/sessions";

export async function getApiUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserBySessionToken(token);
}

export function sessionMaxAgeSeconds(): number {
  return SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
}
