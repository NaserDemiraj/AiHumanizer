import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { rateLimit } from "@/app/lib/ratelimit";
import { logActivity } from "@/app/lib/usage";
import { periodExpired } from "@/app/lib/plans";
import { detectFormat, IMAGE_FORMATS } from "@/app/lib/fileFormat";
import { MAX_UPLOAD_BYTES } from "@/app/lib/documentParse";
import { ocrImage, ocrPdf, pdfPageCount } from "@/app/lib/ocr";

const OCR_PAGE_LIMITS: Record<string, number | null> = {
  FREE: 20, // pages per 30-day period
  PRO: 500,
  ENTERPRISE: null,
};
const MAX_PDF_PAGES_PER_RUN = 20;

/**
 * OCR endpoint: accepts an image (PNG/JPG/WEBP) or a scanned PDF and
 * returns the recognized text. Counts against the per-plan OCR page quota.
 * Runs are slow by nature (~2–10s per page on CPU) — the UI should warn.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to use OCR" }, { status: 401 });

  const limit = await rateLimit("ocr", user.id, 10, 10 * 60);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many OCR runs. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

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

  const buffer = Buffer.from(await file.arrayBuffer());
  const format = await detectFormat(buffer, file.name);
  if (!format || (!IMAGE_FORMATS.includes(format) && format !== "pdf")) {
    return NextResponse.json(
      { error: "OCR accepts PNG, JPG, WEBP images or scanned PDFs." },
      { status: 400 },
    );
  }

  const pagesNeeded =
    format === "pdf" ? Math.min(await pdfPageCount(buffer), MAX_PDF_PAGES_PER_RUN) : 1;

  const used = periodExpired(user.periodStart) ? 0 : user.ocrPagesUsed;
  const planLimit = OCR_PAGE_LIMITS[user.plan] ?? OCR_PAGE_LIMITS.FREE;
  if (planLimit !== null && used + pagesNeeded > planLimit) {
    return NextResponse.json(
      { error: `This would exceed your monthly OCR limit (${planLimit - used} of ${planLimit} pages left).` },
      { status: 402 },
    );
  }

  let text: string;
  let pages: number;
  try {
    if (format === "pdf") {
      const result = await ocrPdf(buffer, MAX_PDF_PAGES_PER_RUN);
      text = result.text;
      pages = result.pages;
    } else {
      text = await ocrImage(buffer);
      pages = 1;
    }
  } catch (err) {
    console.error("OCR failed:", err);
    return NextResponse.json(
      { error: "OCR failed on that file. Try a clearer image or a different scan." },
      { status: 502 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: periodExpired(user.periodStart)
      ? { ocrPagesUsed: pages, wordsUsed: 0, conversionsUsed: 0, periodStart: new Date() }
      : { ocrPagesUsed: { increment: pages } },
  });
  logActivity(user.id, "OCR", `${file.name} · ${pages} page${pages === 1 ? "" : "s"}`);

  return NextResponse.json({ text, pages });
}
