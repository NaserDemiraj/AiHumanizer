import { describe, it, expect, beforeAll } from "vitest";

/**
 * Integration test against a LIVE dev server (npm run dev on :3000) and the
 * real Neon database — not mocked. It burns a small number of real Groq API
 * calls if GROQ_API_KEY is configured. Run manually with:
 *
 *   npm run dev &
 *   npx vitest run tests/integration
 *
 * Skips itself automatically if no server is reachable, so it never fails
 * `npm run build` or a typecheck-only CI step.
 *
 * Each run creates a fresh account, so the signup rate limit (5/hour/IP —
 * see app/api/auth/signup/route.ts) will kick in after repeated local runs.
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function serverReachable(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

function extractCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("Expected a Set-Cookie header, got none");
  return setCookie.split(";")[0];
}

describe("signup → humanize → quota", () => {
  let cookie: string;
  let available = false;

  beforeAll(async () => {
    available = await serverReachable();
    if (!available) {
      console.warn(
        `\n[skipped] No server reachable at ${BASE_URL}. Run "npm run dev" first to exercise this test.\n`,
      );
      return;
    }

    const email = `vitest-${Date.now()}@example.com`;
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Vitest User", email, password: "testpassword123" }),
    });
    expect(res.status).toBe(201);
    cookie = extractCookie(res);
  });

  it("creates a session cookie on signup", () => {
    if (!available) return;
    expect(cookie).toMatch(/^hf_session=/);
  });

  it("rejects humanize requests with no session", async () => {
    if (!available) return;
    const res = await fetch(`${BASE_URL}/api/humanize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello world", mode: "Humanize" }),
    });
    expect(res.status).toBe(401);
  });

  it("humanizes text, persists a document, and deducts the exact word count from the quota", async () => {
    if (!available) return;

    const text = "The quick brown fox jumps over the lazy dog near the old stone bridge today";
    const wordCount = text.split(/\s+/).length; // 15

    const res = await fetch(`${BASE_URL}/api/humanize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ text, mode: "Humanize" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.documentId).toBeTruthy();
    expect(typeof data.improvedText).toBe("string");
    expect(data.improvedText.length).toBeGreaterThan(0);

    // The exact regression class this project hit: metrics must be real
    // numbers in [0, 100], not undefined/NaN/hardcoded.
    for (const key of ["humanScore", "aiDetection", "plagiarism", "grammar", "readability", "seoScore"]) {
      expect(typeof data.metrics[key]).toBe("number");
      expect(data.metrics[key]).toBeGreaterThanOrEqual(0);
      expect(data.metrics[key]).toBeLessThanOrEqual(100);
    }

    expect(data.wordsUsed).toBe(wordCount);
    expect(data.limit).toBe(2_000); // fresh account defaults to Free
  });

  it("accumulates word usage across multiple requests", async () => {
    if (!available) return;

    const first = await fetch(`${BASE_URL}/api/humanize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ text: "one two three four five", mode: "Humanize" }),
    }).then((r) => r.json());

    const second = await fetch(`${BASE_URL}/api/humanize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ text: "six seven eight", mode: "Humanize" }),
    }).then((r) => r.json());

    expect(second.wordsUsed).toBe(first.wordsUsed + 3);
  });

  it("rejects a request that would exceed the Free plan's 2,000-word limit", async () => {
    if (!available) return;

    const overLimitText = Array(2_100).fill("word").join(" ");
    const res = await fetch(`${BASE_URL}/api/humanize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ text: overLimitText, mode: "Humanize" }),
    });

    // 400 (per-request 3,000-word cap) or 402 (monthly quota) are both
    // acceptable rejections here — either way, it must not succeed.
    expect([400, 402]).toContain(res.status);
  });
});
