import "server-only";
import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";
import { PDFParse } from "pdf-parse";

/**
 * OCR via Tesseract (WASM — free, in-process, no external API).
 * Honest accuracy expectations: 95%+ on clean 300dpi scans, 80–95% on
 * phone photos, poor on handwriting. English language pack downloads on
 * first use and is cached under var/ocr-cache.
 */

const CACHE_DIR = path.join(process.cwd(), "var", "ocr-cache");

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, { cachePath: CACHE_DIR });
  }
  return workerPromise;
}

export async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await getWorker();
  const result = await worker.recognize(buffer);
  return result.data.text.trim();
}

/** A digital PDF has extractable text; a scanned one is images of pages. */
export function looksScanned(extractedText: string, pageCount: number): boolean {
  const charsPerPage = extractedText.trim().length / Math.max(1, pageCount);
  return charsPerPage < 40;
}

export type PdfOcrResult = { text: string; pages: number };

/** Rasterizes PDF pages and OCRs each one. Capped by maxPages. */
export async function ocrPdf(buffer: Buffer, maxPages: number): Promise<PdfOcrResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const shots = await parser.getScreenshot({
      first: maxPages,
      scale: 2, // ~144dpi — good accuracy/speed balance for Tesseract
      imageBuffer: true,
    });

    const texts: string[] = [];
    for (const page of shots.pages) {
      if (!page.data) continue;
      texts.push(await ocrImage(Buffer.from(page.data)));
    }
    return { text: texts.join("\n\n").trim(), pages: texts.length };
  } finally {
    await parser.destroy();
  }
}

/** Page count of a PDF without extracting anything else. */
export async function pdfPageCount(buffer: Buffer): Promise<number> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const info = await parser.getInfo();
    return info.total ?? 1;
  } finally {
    await parser.destroy();
  }
}
