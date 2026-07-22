import "server-only";
import type { Prisma, User } from "@prisma/client";
import { prisma } from "./db";
import { PLAN_LIMITS, periodExpired } from "./plans";

export type QuotaOk = {
  ok: true;
  wordsUsed: number;
  periodStart: Date;
  limit: number | null;
  /** True when the 30-day window had lapsed and was rolled over by this check. */
  rolledOver: boolean;
};
export type QuotaCheck =
  | QuotaOk
  | { ok: false; error: string; wordsUsed: number; limit: number | null };

/** Rolls the 30-day window if lapsed and checks the requested word count fits. */
export function checkQuota(user: User, words: number): QuotaCheck {
  const rolledOver = periodExpired(user.periodStart);
  let { wordsUsed, periodStart } = user;
  if (rolledOver) {
    wordsUsed = 0;
    periodStart = new Date();
  }

  const limit = PLAN_LIMITS[user.plan];
  if (limit !== null && wordsUsed + words > limit) {
    return {
      ok: false,
      error: `This would exceed your monthly limit (${(limit - wordsUsed).toLocaleString()} of ${limit.toLocaleString()} words left). Upgrade to keep writing.`,
      wordsUsed,
      limit,
    };
  }
  return { ok: true, wordsUsed, periodStart, limit, rolledOver };
}

/**
 * Prisma update payload that charges `words` to a user's monthly quota.
 *
 * In the normal case this is an atomic `{ increment }`, so two requests that
 * ran `checkQuota` against the same starting count can't clobber each other's
 * usage on write — the read-modify-write we used before let a user exceed
 * their limit by firing calls in parallel (each wrote an absolute value from a
 * stale read, last write wins). Only when the window has just rolled over do we
 * set an absolute value, which necessarily resets the counter and re-anchors
 * the period; a race at that once-per-30-days boundary is harmless.
 *
 * Compose it into the same $transaction as the document write so the charge and
 * the work commit together.
 */
export function chargeWords(quota: QuotaOk, words: number): Prisma.UserUpdateInput {
  if (quota.rolledOver) {
    return { wordsUsed: words, periodStart: quota.periodStart };
  }
  return { wordsUsed: { increment: words } };
}

export function logActivity(userId: string, type: string, detail: string): void {
  // Fire-and-forget — activity logging must never fail a request
  prisma.activity
    .create({ data: { userId, type, detail } })
    .catch((err) => console.error("Activity log failed:", err));
}
