import { describe, it, expect } from "vitest";
import { countWords, periodExpired, PLAN_LIMITS } from "../../app/lib/plans";

describe("countWords", () => {
  it("counts space-separated words", () => {
    expect(countWords("hello world")).toBe(2);
  });

  it("collapses extra whitespace", () => {
    expect(countWords("  hello   world  \n foo ")).toBe(3);
  });

  it("returns 0 for empty/whitespace-only input", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("periodExpired", () => {
  it("is false for a period that started just now", () => {
    expect(periodExpired(new Date())).toBe(false);
  });

  it("is false for a period 29 days old", () => {
    const start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    expect(periodExpired(start)).toBe(false);
  });

  it("is true for a period 31 days old", () => {
    const start = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    expect(periodExpired(start)).toBe(true);
  });
});

describe("PLAN_LIMITS", () => {
  it("matches the pricing page promise: Free 2k, Pro 100k, Enterprise unlimited", () => {
    expect(PLAN_LIMITS.FREE).toBe(2_000);
    expect(PLAN_LIMITS.PRO).toBe(100_000);
    expect(PLAN_LIMITS.ENTERPRISE).toBeNull();
  });
});
