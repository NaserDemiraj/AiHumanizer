import { describe, it, expect } from "vitest";
import type { User } from "@prisma/client";
import { checkQuota } from "../../app/lib/usage";

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user_1",
    email: "test@example.com",
    name: "Test User",
    passwordHash: "hash",
    emailVerified: false,
    plan: "FREE",
    wordsUsed: 0,
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
});
