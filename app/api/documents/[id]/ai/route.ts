import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { rewriteText, runTool, estimateMetrics, type ToolName } from "@/app/lib/llm";
import { countWords } from "@/app/lib/plans";
import { checkQuota, chargeWords, logActivity } from "@/app/lib/usage";
import { rateLimit } from "@/app/lib/ratelimit";

type Step = { op: string; option?: string };

const MODE_OPS = new Set([
  "Humanize", "Academic", "Professional", "Business", "SEO Optimized", "Blog",
  "Email", "Social Media", "Native English", "Simplify", "Formal", "Friendly",
  "Persuasive", "Creative",
]);
const TOOL_OPS = new Set<ToolName>(["grammar", "paraphrase", "summarize", "translate", "tone"]);

async function runStep(step: Step, text: string): Promise<string> {
  if (MODE_OPS.has(step.op)) {
    return rewriteText(text, step.op);
  }
  if (TOOL_OPS.has(step.op as ToolName)) {
    const options: Record<string, string> = {};
    if (step.op === "translate" && step.option) options.targetLang = step.option;
    if (step.op === "tone" && step.option) options.tone = step.option;
    if (step.op === "summarize" && step.option) options.length = step.option;
    const result = await runTool(step.op as ToolName, text, options);
    return result.output;
  }
  throw new Error(`Unknown operation: ${step.op}`);
}

/**
 * Runs one AI operation — or a chain of them — over the given text
 * (a selection or the whole document). Words are charged per step, since
 * each step is a full LLM pass. Metrics are computed once at the end of
 * the chain, not after every step.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limit = await rateLimit("humanize", user.id, 20, 10 * 60);
  if (!limit.success) {
    return NextResponse.json(
      { error: "You're running AI operations too quickly. Wait a few minutes." },
      { status: 429 },
    );
  }

  const { id } = await params;
  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  let body: { text?: string; steps?: Step[]; withMetrics?: boolean; apply?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = body.text?.trim();
  const steps = (body.steps ?? []).filter((s) => s && typeof s.op === "string").slice(0, 6);
  if (!text) return NextResponse.json({ error: "No text to process" }, { status: 400 });
  if (steps.length === 0) return NextResponse.json({ error: "No operations selected" }, { status: 400 });

  const words = countWords(text);
  if (words > 3_000) {
    return NextResponse.json(
      { error: "Selection is too long (limit 3,000 words per operation)" },
      { status: 400 },
    );
  }

  const totalWords = words * steps.length;
  const quota = checkQuota(user, totalWords);
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.error, wordsUsed: quota.wordsUsed, limit: quota.limit },
      { status: 402 },
    );
  }

  let output = text;
  try {
    for (const step of steps) {
      output = await runStep(step, output);
    }
  } catch (err) {
    console.error("Editor AI op failed:", err);
    return NextResponse.json(
      { error: "The AI operation failed. Try again in a moment." },
      { status: 502 },
    );
  }

  const metrics = body.withMetrics ? await estimateMetrics(text, output) : null;

  // Batch flow: persist the result server-side (snapshotting the previous
  // state as a version) instead of round-tripping through the editor UI.
  if (body.apply) {
    const current = await prisma.document.findUnique({ where: { id } });
    if (current) {
      const html = output
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`)
        .join("");
      await prisma.$transaction([
        prisma.documentVersion.create({
          data: {
            documentId: id,
            label: `Before: ${steps.map((s) => s.op).join(" → ")}`,
            op: steps.map((s) => s.op).join(" → "),
            text: current.improvedText ?? current.originalText,
            content: current.content ?? undefined,
          },
        }),
        prisma.document.update({
          where: { id },
          data: {
            improvedText: output,
            content: { doc: null, html },
            ...(metrics ? { metrics } : {}),
          },
        }),
      ]);
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: chargeWords(quota, totalWords),
  });
  logActivity(
    user.id,
    "EDITOR_AI",
    `${steps.map((s) => s.op).join(" → ")} · ${totalWords} words`,
  );

  return NextResponse.json({
    output,
    metrics,
    wordsUsed: quota.wordsUsed + totalWords,
    limit: quota.limit,
  });
}
