import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { hashApiKey } from "@/app/lib/apikeys";
import { rewriteText, estimateMetrics } from "@/app/lib/llm";
import { countWords } from "@/app/lib/plans";
import { checkQuota, logActivity } from "@/app/lib/usage";

/**
 * Public programmatic API.
 *
 *   POST /api/v1/humanize
 *   Authorization: Bearer hf_live_...
 *   { "text": "...", "mode": "Humanize" }
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json(
      { error: "Missing API key. Send it as: Authorization: Bearer hf_live_..." },
      { status: 401 },
    );
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(token) },
    include: { user: true },
  });
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  let body: { text?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  const mode = body.mode?.trim() || "Humanize";
  if (!text) return NextResponse.json({ error: "'text' is required" }, { status: 400 });

  const words = countWords(text);
  if (words > 3_000) {
    return NextResponse.json({ error: "Text exceeds the 3,000-word request limit" }, { status: 400 });
  }

  const quota = checkQuota(apiKey.user, words);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error }, { status: 402 });
  }

  let improvedText: string;
  try {
    improvedText = await rewriteText(text, mode);
  } catch (err) {
    console.error("v1/humanize rewrite failed:", err);
    return NextResponse.json({ error: "Rewrite service unavailable" }, { status: 502 });
  }

  const metrics = estimateMetrics(text, improvedText);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: apiKey.userId },
      data: { wordsUsed: quota.wordsUsed + words, periodStart: quota.periodStart },
    }),
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }),
  ]);
  logActivity(apiKey.userId, "API_CALL", `v1/humanize · ${words} words`);

  return NextResponse.json({
    improved_text: improvedText,
    metrics,
    words_used: quota.wordsUsed + words,
    limit: quota.limit,
  });
}
