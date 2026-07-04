import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { rateLimit } from "@/app/lib/ratelimit";
import { logActivity } from "@/app/lib/usage";
import {
  extractDocument,
  textToHtml,
  UnsupportedFileError,
  MAX_UPLOAD_BYTES,
} from "@/app/lib/documentParse";
import { IMAGE_FORMATS } from "@/app/lib/fileFormat";
import { putFile, makeStorageKey } from "@/app/lib/storage";
import { ocrImage, ocrPdf, pdfPageCount, looksScanned } from "@/app/lib/ocr";
import { periodExpired } from "@/app/lib/plans";

/** Per-plan storage caps (bytes) for uploaded originals. */
const STORAGE_LIMITS: Record<string, bigint> = {
  FREE: BigInt(100 * 1024 * 1024), // 100MB
  PRO: BigInt(5 * 1024 * 1024 * 1024), // 5GB
  ENTERPRISE: BigInt(50 * 1024 * 1024 * 1024),
};

const OCR_PAGE_LIMITS: Record<string, number | null> = {
  FREE: 20,
  PRO: 500,
  ENTERPRISE: null,
};

/**
 * Creates an editor document.
 *  - multipart/form-data with `file`: parse the upload, store the original
 *  - JSON { title?, text? }: blank or pre-filled document
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create documents" }, { status: 401 });

  const limit = await rateLimit("upload", user.id, 20, 10 * 60);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many documents created. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  let title = "Untitled document";
  let text = "";
  let html: string | null = null;
  let sourcePath: string | null = null;
  let sourceFormat: string | null = null;
  let sourceBytes: number | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File is too large. Max size is ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.` },
        { status: 400 },
      );
    }

    const storageLimit = STORAGE_LIMITS[user.plan] ?? STORAGE_LIMITS.FREE;
    if (user.storageBytes + BigInt(file.size) > storageLimit) {
      return NextResponse.json(
        { error: "Storage limit reached. Delete old documents to free up space." },
        { status: 402 },
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
      console.error("Document extraction failed:", err);
      return NextResponse.json(
        { error: "Couldn't read that file. It may be corrupted or password-protected." },
        { status: 400 },
      );
    }

    // Images and scanned PDFs go through OCR, charged against the OCR quota
    let ocrPages = 0;
    if (IMAGE_FORMATS.includes(extracted.format)) {
      ocrPages = 1;
    } else if (extracted.format === "pdf") {
      const pageCount = await pdfPageCount(buffer);
      if (looksScanned(extracted.text, pageCount)) {
        ocrPages = Math.min(pageCount, 20);
      }
    }

    if (ocrPages > 0) {
      const used = periodExpired(user.periodStart) ? 0 : user.ocrPagesUsed;
      const ocrLimit = OCR_PAGE_LIMITS[user.plan] ?? OCR_PAGE_LIMITS.FREE;
      if (ocrLimit !== null && used + ocrPages > ocrLimit) {
        return NextResponse.json(
          { error: `This scanned document needs ${ocrPages} OCR pages, but only ${ocrLimit - used} are left on your plan this month.` },
          { status: 402 },
        );
      }
      try {
        if (IMAGE_FORMATS.includes(extracted.format)) {
          extracted = { ...extracted, text: await ocrImage(buffer) };
        } else {
          const result = await ocrPdf(buffer, 20);
          extracted = { ...extracted, text: result.text };
          ocrPages = result.pages;
        }
      } catch (err) {
        console.error("OCR during upload failed:", err);
        return NextResponse.json(
          { error: "This looks like a scanned document, but OCR failed on it. Try a clearer scan." },
          { status: 502 },
        );
      }
      if (!extracted.text.trim()) {
        return NextResponse.json(
          { error: "OCR couldn't find readable text in this document." },
          { status: 400 },
        );
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { ocrPagesUsed: { increment: ocrPages } },
      });
      logActivity(user.id, "OCR", `${file.name} · ${ocrPages} page${ocrPages === 1 ? "" : "s"}`);
    }

    sourcePath = makeStorageKey(user.id, file.name);
    await putFile(sourcePath, buffer);
    await prisma.user.update({
      where: { id: user.id },
      data: { storageBytes: { increment: file.size } },
    });

    title = file.name.replace(/\.[^.]+$/, "").slice(0, 120) || title;
    text = extracted.text;
    html = extracted.html ?? textToHtml(extracted.text);
    sourceFormat = extracted.format;
    sourceBytes = file.size;
  } else {
    const body = (await request.json().catch(() => ({}))) as { title?: string; text?: string };
    title = body.title?.trim().slice(0, 120) || title;
    text = body.text?.trim() ?? "";
    html = text ? textToHtml(text) : "<p></p>";
  }

  const document = await prisma.document.create({
    data: {
      userId: user.id,
      title,
      kind: "editor",
      originalText: text,
      improvedText: text,
      content: { doc: null, html },
      sourcePath,
      sourceFormat,
      sourceBytes,
      mode: "Editor",
    },
  });

  logActivity(
    user.id,
    "DOC_CREATED",
    sourceFormat ? `${title} (from ${sourceFormat.toUpperCase()})` : title,
  );

  return NextResponse.json(
    { id: document.id, title: document.title, sourceFormat },
    { status: 201 },
  );
}
