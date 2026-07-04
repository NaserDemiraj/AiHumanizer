import { NextResponse } from "next/server";
import TurndownService from "turndown";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { rateLimit } from "@/app/lib/ratelimit";
import { logActivity } from "@/app/lib/usage";
import { periodExpired } from "@/app/lib/plans";
import {
  extractDocument,
  UnsupportedFileError,
  MAX_UPLOAD_BYTES,
} from "@/app/lib/documentParse";
import { IMAGE_FORMATS } from "@/app/lib/fileFormat";
import {
  htmlToBlocks,
  textToBlocks,
  buildDocx,
  buildPdf,
  blocksToMarkdown,
  blocksToText,
} from "@/app/lib/exportBuilders";

const TARGETS = new Set(["txt", "md", "docx", "pdf"]);
const CONVERSION_LIMITS: Record<string, number | null> = {
  FREE: 20, // per 30-day period
  PRO: 500,
  ENTERPRISE: null,
};

/**
 * Convert-only pipeline: upload a file, get it back in another format.
 * No AI involved, no word quota — has its own per-plan conversion counter.
 * Content and semantic structure carry over; source page layout does not
 * (PDF layout can't be reflowed — see docs in exportBuilders).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to convert files" }, { status: 401 });

  const limit = await rateLimit("convert", user.id, 20, 10 * 60);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many conversions. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const conversionsUsed = periodExpired(user.periodStart) ? 0 : user.conversionsUsed;
  const planLimit = CONVERSION_LIMITS[user.plan] ?? CONVERSION_LIMITS.FREE;
  if (planLimit !== null && conversionsUsed >= planLimit) {
    return NextResponse.json(
      { error: `Monthly conversion limit reached (${planLimit}). Upgrade for more.` },
      { status: 402 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const target = String(formData?.get("target") ?? "").toLowerCase();

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!TARGETS.has(target)) {
    return NextResponse.json({ error: "Target must be txt, md, docx, or pdf" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Max size is ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let extracted;
  try {
    extracted = await extractDocument(buffer, file.name);
  } catch (err) {
    if (err instanceof UnsupportedFileError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Convert extraction failed:", err);
    return NextResponse.json(
      { error: "Couldn't read that file. It may be corrupted or password-protected." },
      { status: 400 },
    );
  }

  if (IMAGE_FORMATS.includes(extracted.format)) {
    return NextResponse.json(
      { error: "Images need OCR first — use the editor's upload, then export." },
      { status: 400 },
    );
  }
  if (!extracted.text.trim()) {
    return NextResponse.json({ error: "No readable text found in that file." }, { status: 400 });
  }

  const blocks = extracted.html ? htmlToBlocks(extracted.html) : textToBlocks(null, extracted.text);
  const basename = file.name.replace(/\.[^.]+$/, "").replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "converted";

  await prisma.user.update({
    where: { id: user.id },
    data: periodExpired(user.periodStart)
      ? { conversionsUsed: 1, wordsUsed: 0, ocrPagesUsed: 0, periodStart: new Date() }
      : { conversionsUsed: { increment: 1 } },
  });
  logActivity(user.id, "CONVERT", `${file.name} → ${target.toUpperCase()}`);

  if (target === "txt") {
    return new NextResponse(blocksToText(blocks), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${basename}.txt"`,
      },
    });
  }
  if (target === "md") {
    const markdown = extracted.html
      ? new TurndownService({ headingStyle: "atx" }).turndown(extracted.html)
      : blocksToMarkdown(blocks);
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${basename}.md"`,
      },
    });
  }
  if (target === "docx") {
    const out = await buildDocx(blocks);
    return new NextResponse(new Uint8Array(out), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${basename}.docx"`,
      },
    });
  }
  const out = await buildPdf(blocks);
  return new NextResponse(Buffer.from(out), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${basename}.pdf"`,
    },
  });
}
