import "server-only";
import { captureError } from "./observability";

/**
 * External AI-detector proof.
 *
 * The humanizer's whole value proposition is "this actually beats AI
 * detectors" — but self-judged scores from our own LLM don't earn a buyer's
 * trust. When a real detector API is configured we run the *humanized* text
 * through it and return an independent verdict to show alongside the result
 * ("Passed GPTZero ✓"). Without a key this returns null and callers keep using
 * the existing heuristic/LLM score — same env-gated fallback pattern as Groq,
 * Copyleaks, R2, and Upstash elsewhere in the app.
 *
 * Provider: GPTZero (https://gptzero.me — Dashboard → API). Set GPTZERO_API_KEY.
 * The adapter is deliberately isolated so a second provider can be added
 * without touching call sites.
 */

export type DetectorVerdict = {
  provider: string;
  /** Probability the text is AI-generated, 0–1. */
  aiProbability: number;
  /** True when the text reads as human to this detector (aiProbability < 0.5). */
  passed: boolean;
};

const PASS_THRESHOLD = 0.5;

export function detectorsConfigured(): boolean {
  return Boolean(process.env.GPTZERO_API_KEY);
}

/** Pull an AI probability (0–1) out of GPTZero's response, tolerant of shape. */
function readGptZeroProbability(data: unknown): number | null {
  const doc = (data as { documents?: unknown[] })?.documents?.[0] as
    | {
        completely_generated_prob?: number;
        class_probabilities?: { ai?: number };
        average_generated_prob?: number;
      }
    | undefined;
  if (!doc) return null;
  const p =
    doc.class_probabilities?.ai ??
    doc.completely_generated_prob ??
    doc.average_generated_prob;
  return typeof p === "number" ? Math.max(0, Math.min(1, p)) : null;
}

async function checkGptZero(text: string): Promise<DetectorVerdict | null> {
  const res = await fetch("https://api.gptzero.me/v2/predict/text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.GPTZERO_API_KEY!,
    },
    body: JSON.stringify({ document: text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GPTZero ${res.status} ${res.statusText}`);
  const prob = readGptZeroProbability(await res.json());
  if (prob === null) return null;
  return { provider: "GPTZero", aiProbability: prob, passed: prob < PASS_THRESHOLD };
}

/**
 * Run configured external detectors over `text`. Returns null when none are
 * configured; on a provider error returns an empty array (configured but
 * unavailable) so the caller can distinguish "not offered" from "we tried and
 * it's down" if it wants to. Never throws.
 */
export async function checkDetectors(text: string): Promise<DetectorVerdict[] | null> {
  if (!detectorsConfigured()) return null;
  try {
    const verdict = await checkGptZero(text);
    return verdict ? [verdict] : [];
  } catch (err) {
    captureError("external detector check failed", err, { provider: "GPTZero" });
    return [];
  }
}
