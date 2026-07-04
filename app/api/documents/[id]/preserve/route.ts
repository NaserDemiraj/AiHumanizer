import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { getFile } from "@/app/lib/storage";
import { readDocxParagraphs, patchDocxParagraphs } from "@/app/lib/docxPatch";
import { rewriteBlocks } from "@/app/lib/llm";
import { checkQuota, logActivity } from "@/app/lib/usage";
import { rateLimit } from "@/app/lib/ratelimit";

/**
 * Preserve mode: AI-rewrites the text of the ORIGINAL uploaded DOCX
 * in place — every style, table, image, header, footer, and margin
 * stays untouched — and returns the patched .docx as a download.
 * Only available for documents that were created from a DOCX upload.
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
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (doc.sourceFormat !== "docx" || !doc.sourcePath) {
    return NextResponse.json(
      { error: "Preserve mode needs the original DOCX — this document wasn't created from one." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode?.trim() || "Humanize";

  let original: Buffer;
  try {
    original = await getFile(doc.sourcePath);
  } catch {
    return NextResponse.json(
      { error: "The original file is no longer available in storage." },
      { status: 410 },
    );
  }

  const paragraphs = await readDocxParagraphs(original);
  // Rewrite only paragraphs with meaningful prose; leave short labels intact
  const targets = paragraphs.filter((p) => p.text.trim().split(/\s+/).length >= 3);
  const totalWords = targets.reduce((sum, p) => sum + p.text.trim().split(/\s+/).length, 0);

  if (totalWords === 0) {
    return NextResponse.json({ error: "No rewritable text found in the document." }, { status: 400 });
  }
  if (totalWords > 3_000) {
    return NextResponse.json(
      { error: `Document is too long for one preserve-mode pass (${totalWords.toLocaleString()} words, limit 3,000).` },
      { status: 400 },
    );
  }

  const quota = checkQuota(user, totalWords);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error }, { status: 402 });
  }

  let rewritten: string[];
  try {
    rewritten = await rewriteBlocks(targets.map((p) => p.text), mode);
  } catch (err) {
    console.error("Preserve-mode rewrite failed:", err);
    return NextResponse.json(
      { error: "The rewrite failed. Try again in a moment." },
      { status: 502 },
    );
  }

  const replacements = new Map<number, string>();
  targets.forEach((p, i) => {
    if (rewritten[i] && rewritten[i] !== p.text) replacements.set(p.index, rewritten[i]);
  });

  const patched = await patchDocxParagraphs(original, replacements);

  await prisma.user.update({
    where: { id: user.id },
    data: { wordsUsed: quota.wordsUsed + totalWords, periodStart: quota.periodStart },
  });
  logActivity(user.id, "PRESERVE_MODE", `${doc.title} · ${mode} · ${totalWords} words`);

  const filename = doc.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "document";
  return new NextResponse(new Uint8Array(patched), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}-${mode.toLowerCase().replace(/\s+/g, "-")}.docx"`,
    },
  });
}
