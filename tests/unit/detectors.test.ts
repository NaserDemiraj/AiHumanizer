import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectorsConfigured, checkDetectors } from "../../app/lib/detectors";

describe("detectors env-gating", () => {
  const original = process.env.GPTZERO_API_KEY;
  beforeEach(() => {
    delete process.env.GPTZERO_API_KEY;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.GPTZERO_API_KEY;
    else process.env.GPTZERO_API_KEY = original;
  });

  it("reports unconfigured when no key is set", () => {
    expect(detectorsConfigured()).toBe(false);
  });

  it("checkDetectors returns null (not [], not throw) when unconfigured", async () => {
    // Contract: callers use null to mean 'fall back to the built-in score'
    // and never make a network call.
    await expect(checkDetectors("some text")).resolves.toBeNull();
  });

  it("reports configured once a key is present", () => {
    process.env.GPTZERO_API_KEY = "test-key";
    expect(detectorsConfigured()).toBe(true);
  });
});
