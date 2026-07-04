import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/app/lib/apiAuth";
import { rateLimit, clientIp } from "@/app/lib/ratelimit";
import { textStats, fleschReadingEase, keywordDensity, seoScore } from "@/app/lib/metrics";

/**
 * Public API: text statistics. Pure computation — no word quota consumed.
 *
 *   POST /api/v1/analyze
 *   Authorization: Bearer hf_live_...
 *   { "text": "..." }
 */
export async function POST(request: Request) {
  const ipLimit = await rateLimit("v1-auth", clientIp(request), 60, 60);
  if (!ipLimit.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Missing or invalid API key. Send it as: Authorization: Bearer hf_live_..." },
      { status: 401 },
    );
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "'text' is required" }, { status: 400 });

  return NextResponse.json({
    stats: textStats(text),
    readability: fleschReadingEase(text),
    keywords: keywordDensity(text),
    seo_score: seoScore(text),
  });
}
