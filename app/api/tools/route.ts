import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { runTool, type ToolName } from "@/app/lib/llm";
import { countWords } from "@/app/lib/plans";
import { checkQuota, logActivity } from "@/app/lib/usage";
import { textStats, fleschReadingEase, keywordDensity, seoScore } from "@/app/lib/metrics";
import {
  copyleaksConfigured,
  copyleaksWebhooksReachable,
  submitPlagiarismScan,
} from "@/app/lib/copyleaks";

const TOOL_NAMES: ToolName[] = [
  "detect", "grammar", "paraphrase", "summarize",
  "translate", "tone", "citation", "plagiarism",
];

/** Free analysis tools don't consume word credits — only generation does. */
const FREE_TOOLS = new Set<string>(["analyze"]);

const MAX_INPUT_WORDS = 3_000;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to use the writing tools" }, { status: 401 });
  }

  let body: { tool?: string; text?: string; options?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const tool = body.tool ?? "";
  const text = body.text?.trim();
  const options = body.options ?? {};

  if (!text) {
    return NextResponse.json({ error: "Paste some text first" }, { status: 400 });
  }

  const words = countWords(text);
  if (words > MAX_INPUT_WORDS) {
    return NextResponse.json(
      { error: `Text is too long (${words.toLocaleString()} words). Limit is ${MAX_INPUT_WORDS.toLocaleString()} words per request.` },
      { status: 400 },
    );
  }

  // Pure computation: word/char counts, readability, keyword density, SEO
  if (tool === "analyze") {
    return NextResponse.json({
      stats: textStats(text),
      readability: fleschReadingEase(text),
      keywords: keywordDensity(text),
      seoScore: seoScore(text),
    });
  }

  if (!TOOL_NAMES.includes(tool as ToolName)) {
    return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
  }

  const quota = FREE_TOOLS.has(tool) ? null : checkQuota(user, words);
  if (quota && !quota.ok) {
    return NextResponse.json(
      { error: quota.error, wordsUsed: quota.wordsUsed, limit: quota.limit },
      { status: 402 },
    );
  }

  // Real Copyleaks scan when the account is configured and webhooks can
  // reach us (public https deployment). On localhost this falls through
  // to the LLM estimate below.
  if (tool === "plagiarism" && copyleaksConfigured() && copyleaksWebhooksReachable()) {
    const title = text.split(/\s+/).slice(0, 6).join(" ") + (words > 6 ? "…" : "");
    const document = await prisma.document.create({
      data: {
        userId: user.id,
        title,
        kind: "plagiarism",
        originalText: text,
        improvedText: "Scanning against billions of sources — results land here shortly.",
        mode: "Plagiarism",
        metrics: { provider: "copyleaks", status: "processing" },
      },
    });

    try {
      await submitPlagiarismScan(text, document.id);
    } catch (err) {
      console.error("Copyleaks submit failed:", err);
      await prisma.document.delete({ where: { id: document.id } });
      return NextResponse.json(
        { error: "The plagiarism scanner is unavailable right now. Try again in a moment." },
        { status: 502 },
      );
    }

    if (quota) {
      await prisma.user.update({
        where: { id: user.id },
        data: { wordsUsed: quota.wordsUsed + words, periodStart: quota.periodStart },
      });
    }
    logActivity(user.id, "TOOL_RUN", `Plagiarism scan · ${words} words`);

    return NextResponse.json({
      output:
        "Scan submitted to Copyleaks. Results will appear on the document page in your dashboard within a minute or two.",
      extra: { provider: "copyleaks", status: "processing" },
      documentId: document.id,
      wordsUsed: quota ? quota.wordsUsed + words : undefined,
      limit: quota?.limit,
    });
  }

  let result;
  try {
    result = await runTool(tool as ToolName, text, options);
  } catch (err) {
    console.error(`Tool ${tool} failed:`, err);
    return NextResponse.json(
      { error: "The tool is unavailable right now. Try again in a moment." },
      { status: 502 },
    );
  }

  const title = text.split(/\s+/).slice(0, 6).join(" ") + (words > 6 ? "…" : "");
  const toolLabel = tool.charAt(0).toUpperCase() + tool.slice(1);

  const [document] = await prisma.$transaction([
    prisma.document.create({
      data: {
        userId: user.id,
        title,
        kind: tool,
        originalText: text,
        improvedText: result.output,
        mode: toolLabel,
        metrics: (result.extra as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: quota
        ? { wordsUsed: quota.wordsUsed + words, periodStart: quota.periodStart }
        : {},
    }),
  ]);

  logActivity(user.id, "TOOL_RUN", `${toolLabel} · ${words} words`);

  return NextResponse.json({
    output: result.output,
    extra: result.extra ?? null,
    documentId: document.id,
    wordsUsed: quota ? quota.wordsUsed + words : undefined,
    limit: quota?.limit,
  });
}
