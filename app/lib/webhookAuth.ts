import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Per-scan HMAC tokens for the Copyleaks webhook. Copyleaks doesn't sign
 * its callbacks, so we embed our own signature in the webhook URL — an
 * attacker who guesses a Document cuid still can't produce a valid token
 * without WEBHOOK_SECRET.
 */
function secret(): string {
  const s = process.env.WEBHOOK_SECRET;
  if (!s) throw new Error("WEBHOOK_SECRET is not configured");
  return s;
}

export function signWebhookToken(scanId: string): string {
  return createHmac("sha256", secret()).update(scanId).digest("hex").slice(0, 32);
}

export function verifyWebhookToken(scanId: string, token: string | null): boolean {
  if (!token) return false;
  const expected = signWebhookToken(scanId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
