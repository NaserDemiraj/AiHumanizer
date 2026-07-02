import type { Plan } from "@prisma/client";

/** Monthly word quotas per plan. `null` = unlimited. */
export const PLAN_LIMITS: Record<Plan, number | null> = {
  FREE: 2_000,
  PRO: 100_000,
  ENTERPRISE: null,
};

export const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Free plan",
  PRO: "Pro plan",
  ENTERPRISE: "Enterprise plan",
};

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Billing periods roll over every 30 days from periodStart. */
export function periodExpired(periodStart: Date): boolean {
  return Date.now() - periodStart.getTime() > 30 * 24 * 60 * 60 * 1000;
}
