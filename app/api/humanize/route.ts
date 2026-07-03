import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { rewriteText, estimateMetrics } from "@/app/lib/llm";
import { countWords } from "@/app/lib/plans";
import { checkQuota, logActivity } from "@/app/lib/usage";
import { rateLimit } from "@/app/lib/ratelimit";

const MAX_INPUT_WORDS = 3_000;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to humanize text" }, { status: 401 });
  }

  // Each humanize call makes 4 Groq requests (rewrite + detect + grammar +
  // plagiarism scoring) — caps runaway/scripted usage independent of the
  // word quota, which a burst of short texts wouldn't otherwise trip.
  const limit = await rateLimit("humanize", user.id, 20, 10 * 60);
  if (!limit.success) {
    return NextResponse.json(
      { error: "You're humanizing text too quickly. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  let body: { text?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = body.text?.trim();
  const mode = body.mode?.trim() || "Humanize";
  if (!text) {
    return NextResponse.json({ error: "Paste some text to humanize" }, { status: 400 });
  }

  const words = countWords(text);
  if (words > MAX_INPUT_WORDS) {
    return NextResponse.json(
      { error: `Text is too long (${words.toLocaleString()} words). Limit is ${MAX_INPUT_WORDS.toLocaleString()} words per request.` },
      { status: 400 },
    );
  }

  const quota = checkQuota(user, words);
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.error, wordsUsed: quota.wordsUsed, limit: quota.limit },
      { status: 402 },
    );
  }

  let improvedText: string;
  try {
    improvedText = await rewriteText(text, mode);
  } catch (err) {
    console.error("Rewrite failed:", err);
    return NextResponse.json(
      { error: "The rewrite service is unavailable right now. Try again in a moment." },
      { status: 502 },
    );
  }

  const metrics = await estimateMetrics(text, improvedText);
  const title = text.split(/\s+/).slice(0, 6).join(" ") + (words > 6 ? "…" : "");

  const [document] = await prisma.$transaction([
    prisma.document.create({
      data: { userId: user.id, title, originalText: text, improvedText, mode, metrics },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { wordsUsed: quota.wordsUsed + words, periodStart: quota.periodStart },
    }),
  ]);
  logActivity(user.id, "HUMANIZE", `${mode} · ${words} words`);

  return NextResponse.json({
    improvedText,
    metrics,
    documentId: document.id,
    wordsUsed: quota.wordsUsed + words,
    limit: quota.limit,
  });
}
