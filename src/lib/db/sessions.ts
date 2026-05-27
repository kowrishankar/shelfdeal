import { randomBytes } from "crypto";
import { getSql } from "../db";
import { SESSION_MAX_AGE_DAYS } from "../auth/constants";
import type { AuthUser } from "../auth/types";
import { findUserById } from "./users";

function newToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string): Promise<string> {
  const sql = getSql();
  const token = newToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_MAX_AGE_DAYS);

  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${userId}::uuid, ${token}, ${expiresAt.toISOString()}::timestamptz)
  `;
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

export async function getUserBySessionToken(
  token: string,
): Promise<AuthUser | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT user_id FROM sessions
    WHERE token = ${token} AND expires_at > now()
    LIMIT 1
  `;
  if (!rows.length) return null;
  return findUserById(rows[0].user_id as string);
}
