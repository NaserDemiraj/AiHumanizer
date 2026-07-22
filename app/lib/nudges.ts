import "server-only";
import { prisma } from "./db";
import { PLAN_LIMITS, periodExpired } from "./plans";
import { sendQuotaNudgeEmail } from "./email";
import { captureError } from "./observability";

/**
 * Quota-nudge emails. The 30-day word limit is otherwise invisible until a
 * request is refused — by then the user has bounced. Emailing at ~80% turns
 * the limit into a return-visit and upgrade trigger while intent is high.
 *
 * Runs from the daily maintenance cron. Deduped through the Activity log
 * (a "QUOTA_NUDGE" row per billing window) so it never needs a schema change
 * and never emails the same user twice in one cycle.
 */

/** Fraction of the plan limit at which we send the heads-up. */
export const NUDGE_THRESHOLD = 0.8;

export type NudgeResult = { nudgesSent: number };

export async function runQuotaNudges(): Promise<NudgeResult> {
  // Only limited plans with real usage. Enterprise (null limit) is excluded.
  const candidates = await prisma.user.findMany({
    where: { plan: { in: ["FREE", "PRO"] }, wordsUsed: { gt: 0 } },
    select: { id: true, email: true, name: true, plan: true, wordsUsed: true, periodStart: true },
  });

  let nudgesSent = 0;
  for (const u of candidates) {
    const limit = PLAN_LIMITS[u.plan];
    if (limit === null) continue; // unlimited — nothing to nudge
    if (periodExpired(u.periodStart)) continue; // window has reset; full quota again
    if (u.wordsUsed < limit * NUDGE_THRESHOLD) continue;

    // One nudge per billing window — the activity log is the dedupe ledger.
    const already = await prisma.activity.findFirst({
      where: { userId: u.id, type: "QUOTA_NUDGE", createdAt: { gte: u.periodStart } },
      select: { id: true },
    });
    if (already) continue;

    try {
      await sendQuotaNudgeEmail(u.email, u.name, u.wordsUsed, limit);
      await prisma.activity.create({
        data: { userId: u.id, type: "QUOTA_NUDGE", detail: `${u.wordsUsed}/${limit} words` },
      });
      nudgesSent++;
    } catch (err) {
      captureError("quota nudge email failed", err, { userId: u.id });
    }
  }
  return { nudgesSent };
}
