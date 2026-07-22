import { describe, it, expect } from "vitest";
import { trashCutoff, TRASH_RETENTION_DAYS } from "../../app/lib/cleanup";

describe("trashCutoff", () => {
  const now = new Date("2026-07-22T00:00:00.000Z");

  it("is the retention window before now by default", () => {
    const cutoff = trashCutoff(now);
    const expected = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    expect(cutoff.getTime()).toBe(expected.getTime());
  });

  it("honors a custom retention window", () => {
    const cutoff = trashCutoff(now, 7);
    expect(cutoff.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("a doc trashed just now is not yet eligible (trashedAt > cutoff)", () => {
    expect(now.getTime()).toBeGreaterThan(trashCutoff(now).getTime());
  });

  it("a doc trashed longer ago than the window is eligible (trashedAt < cutoff)", () => {
    const trashedAt = new Date(now.getTime() - (TRASH_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(trashedAt.getTime()).toBeLessThan(trashCutoff(now).getTime());
  });
});
