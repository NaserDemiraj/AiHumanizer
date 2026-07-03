import "server-only";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const SUPPORTED_UPLOAD_TYPES = [".txt", ".docx", ".pdf"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

export class UnsupportedFileError extends Error {}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

/** Extracts plain text from an uploaded TXT, DOCX, or PDF file. */
export async function extractTextFromUpload(buffer: Buffer, filename: string): Promise<string> {
  const ext = extensionOf(filename);

  if (ext === ".txt") {
    return buffer.toString("utf-8");
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === ".pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  throw new UnsupportedFileError(
    `Unsupported file type "${ext || "unknown"}". Upload a .txt, .docx, or .pdf file.`,
  );
}
