import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { authenticateApiKey } from "@/app/lib/apiAuth";
import { runTool, type ToolName } from "@/app/lib/llm";
import { countWords } from "@/app/lib/plans";
import { checkQuota, chargeWords, logActivity } from "@/app/lib/usage";
import { rateLimit, clientIp } from "@/app/lib/ratelimit";

const TOOL_NAMES: ToolName[] = [
  "detect", "grammar", "paraphrase", "summarize",
  "translate", "tone", "citation", "plagiarism",
];

/**
 * Public API: run a writing tool.
 *
 *   POST /api/v1/tools
 *   Authorization: Bearer hf_live_...
 *   { "tool": "grammar", "text": "...", "options": { "targetLang": "French" } }
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

  const keyLimit = await rateLimit("v1-tools", auth.apiKey.id, 60, 60 * 60);
  if (!keyLimit.success) {
    return NextResponse.json(
      { error: "API rate limit exceeded for this key. Try again later." },
      { status: 429 },
    );
  }

  let body: { tool?: string; text?: string; options?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tool = body.tool ?? "";
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "'text' is required" }, { status: 400 });
  if (!TOOL_NAMES.includes(tool as ToolName)) {
    return NextResponse.json(
      { error: `Unknown tool. Use one of: ${TOOL_NAMES.join(", ")}` },
      { status: 400 },
    );
  }

  const words = countWords(text);
  if (words > 3_000) {
    return NextResponse.json({ error: "Text exceeds the 3,000-word request limit" }, { status: 400 });
  }

  const quota = checkQuota(auth.user, words);
  if (!quota.ok) return NextResponse.json({ error: quota.error }, { status: 402 });

  let result;
  try {
    result = await runTool(tool as ToolName, text, body.options ?? {});
  } catch (err) {
    console.error("v1/tools failed:", err);
    return NextResponse.json({ error: "Tool unavailable" }, { status: 502 });
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: chargeWords(quota, words),
  });
  logActivity(auth.user.id, "API_CALL", `v1/tools ${tool} · ${words} words`);

  return NextResponse.json({
    output: result.output,
    extra: result.extra ?? null,
    words_used: quota.wordsUsed + words,
    limit: quota.limit,
  });
}
