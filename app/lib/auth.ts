import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { User } from "@prisma/client";

const SESSION_COOKIE = "hf_session";
const SESSION_DAYS = 30;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// The handful of passwords that dominate every breach corpus and every
// credential-stuffing list. This isn't a full strength meter — it just blocks
// the guesses an attacker tries first, which a bare length check lets through.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty", "qwertyuiop", "qwerty123", "111111", "123123", "abc123", "iloveyou",
  "admin", "welcome", "welcome1", "letmein", "monkey", "dragon", "sunshine",
  "princess", "football", "baseball", "trustno1", "passw0rd", "changeme",
  "starwars", "whatever", "superman", "michael", "computer",
]);

/**
 * Returns a human-readable reason a password is unacceptable, or null if it's
 * fine. Shared by signup and password-reset so both enforce the same rules.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 200) return "Password must be at most 200 characters";
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return "That password is too common — pick something harder to guess";
  }
  if (/^(.)\1+$/.test(password)) {
    return "Password can't be a single repeated character";
  }
  return null;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({ data: { token, userId, expiresAt } });
  // Opportunistic cleanup — piggybacks on login/signup traffic instead of
  // needing a separate cron job. Fire-and-forget so it never blocks login.
  prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch((err) => console.error("Session cleanup failed:", err));

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  return session.user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(SESSION_COOKIE);
}
