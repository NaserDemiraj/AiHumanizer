import "server-only";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { PLAN_LIMITS, periodExpired } from "./plans";

export type QuotaCheck =
  | { ok: true; wordsUsed: number; periodStart: Date; limit: number | null }
  | { ok: false; error: string; wordsUsed: number; limit: number | null };

/** Rolls the 30-day window if lapsed and checks the requested word count fits. */
export function checkQuota(user: User, words: number): QuotaCheck {
  let { wordsUsed, periodStart } = user;
  if (periodExpired(periodStart)) {
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
  return { ok: true, wordsUsed, periodStart, limit };
}

export function logActivity(userId: string, type: string, detail: string): void {
  // Fire-and-forget — activity logging must never fail a request
  prisma.activity
    .create({ data: { userId, type, detail } })
    .catch((err) => console.error("Activity log failed:", err));
}
