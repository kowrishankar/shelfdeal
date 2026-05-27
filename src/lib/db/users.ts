import { getSql } from "../db";
import type { AuthUser } from "../auth/types";

export interface DbUserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
}

function toAuthUser(row: DbUserRow): AuthUser {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
  };
}

export async function findUserByEmail(
  email: string,
): Promise<(AuthUser & { passwordHash: string }) | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, first_name, last_name, email, password_hash
    FROM users WHERE lower(email) = ${email.trim().toLowerCase()} LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0] as DbUserRow;
  return { ...toAuthUser(row), passwordHash: row.password_hash };
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, first_name, last_name, email
    FROM users WHERE id = ${id}::uuid LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0] as DbUserRow;
  return toAuthUser(row);
}

export async function createUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
}): Promise<AuthUser> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO users (first_name, last_name, email, password_hash)
    VALUES (
      ${input.firstName.trim()},
      ${input.lastName.trim()},
      ${input.email.trim().toLowerCase()},
      ${input.passwordHash}
    )
    RETURNING id, first_name, last_name, email
  `;
  return toAuthUser(rows[0] as DbUserRow);
}
