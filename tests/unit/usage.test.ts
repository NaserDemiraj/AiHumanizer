import { describe, it, expect } from "vitest";
import type { User } from "@prisma/client";
import { checkQuota, chargeWords, type QuotaOk } from "../../app/lib/usage";

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user_1",
    email: "test@example.com",
    name: "Test User",
    passwordHash: "hash",
    emailVerified: false,
    plan: "FREE",
    wordsUsed: 0,
    ocrPagesUsed: 0,
    conversionsUsed: 0,
    storageBytes: BigInt(0),
    periodStart: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe("checkQuota", () => {
  it("allows a request within the Free plan's remaining words", () => {
    const user = fakeUser({ wordsUsed: 1_000 });
    const result = checkQuota(user, 500);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.wordsUsed).toBe(1_000);
  });

  it("rejects a request that would exceed the Free plan's 2,000-word limit", () => {
    const user = fakeUser({ wordsUsed: 1_900 });
    const result = checkQuota(user, 200);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.limit).toBe(2_000);
  });

  it("rolls the usage window over once periodStart is more than 30 days old", () => {
    const staleStart = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const user = fakeUser({ wordsUsed: 1_999, periodStart: staleStart });
    // Would fail against the stale wordsUsed, but the period has expired
    // so usage should reset to 0 before the check runs.
    const result = checkQuota(user, 500);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.wordsUsed).toBe(0);
  });

  it("never rejects Enterprise (unlimited) requests regardless of usage", () => {
    const user = fakeUser({ plan: "ENTERPRISE", wordsUsed: 10_000_000 });
    const result = checkQuota(user, 1_000_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.limit).toBeNull();
  });

  it("respects the Pro plan's higher 100,000-word limit", () => {
    const user = fakeUser({ plan: "PRO", wordsUsed: 99_500 });
    expect(checkQuota(user, 400).ok).toBe(true);
    expect(checkQuota(user, 600).ok).toBe(false);
  });

  it("flags rolledOver only when the period had expired", () => {
    const fresh = checkQuota(fakeUser({ periodStart: new Date() }), 100);
    expect(fresh.ok && fresh.rolledOver).toBe(false);

    const staleStart = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const stale = checkQuota(fakeUser({ periodStart: staleStart }), 100);
    expect(stale.ok && stale.rolledOver).toBe(true);
  });
});

describe("chargeWords", () => {
  const okQuota = (over: Partial<QuotaOk> = {}): QuotaOk => ({
    ok: true,
    wordsUsed: 1_000,
    periodStart: new Date("2026-07-22T00:00:00.000Z"),
    limit: 2_000,
    rolledOver: false,
    ...over,
  });

  it("charges atomically (increment) in the normal case so concurrent writes can't clobber", () => {
    expect(chargeWords(okQuota(), 500)).toEqual({ wordsUsed: { increment: 500 } });
  });

  it("never emits an absolute wordsUsed value outside a rollover", () => {
    const data = chargeWords(okQuota({ wordsUsed: 1_900 }), 50);
    // Absolute writes are the race we're fixing — must not appear here.
    expect(typeof data.wordsUsed).toBe("object");
    expect(data.periodStart).toBeUndefined();
  });

  it("resets to an absolute count and re-anchors the period on rollover", () => {
    const periodStart = new Date("2026-07-22T00:00:00.000Z");
    expect(chargeWords(okQuota({ rolledOver: true, periodStart }), 500)).toEqual({
      wordsUsed: 500,
      periodStart,
    });
  });
});
