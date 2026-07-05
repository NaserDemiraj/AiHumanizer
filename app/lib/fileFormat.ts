import "server-only";
import { fileTypeFromBuffer } from "file-type";

export type DocFormat =
  | "pdf"
  | "docx"
  | "doc"
  | "rtf"
  | "odt"
  | "txt"
  | "md"
  | "png"
  | "jpg"
  | "webp";

export const IMAGE_FORMATS: DocFormat[] = ["png", "jpg", "webp"];

const EXT_MAP: Record<string, DocFormat> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".doc": "doc",
  ".rtf": "rtf",
  ".odt": "odt",
  ".txt": "txt",
  ".md": "md",
  ".markdown": "md",
  ".png": "png",
  ".jpg": "jpg",
  ".jpeg": "jpg",
  ".webp": "webp",
};

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

/**
 * Detects the real format from magic bytes, falling back to the extension
 * only for plain-text formats that have no signature (txt/md/rtf-ish).
 * A mismatched extension never wins over the binary signature.
 */
export async function detectFormat(buffer: Buffer, filename: string): Promise<DocFormat | null> {
  // RTF is a text format file-type doesn't recognize; its "{\rtf" signature
  // is unambiguous, so check it up front — independent of the binary sniffer.
  const head = buffer.subarray(0, 64).toString("utf-8");
  if (head.startsWith("{\\rtf")) return "rtf";

  const sniffed = await fileTypeFromBuffer(buffer);

  if (sniffed) {
    switch (sniffed.ext) {
      case "pdf":
        return "pdf";
      case "docx":
        return "docx";
      case "doc":
      case "cfb": // legacy .doc is an OLE compound file — file-type reports "cfb"
        return "doc";
      case "odt":
        return "odt";
      case "png":
        return "png";
      case "jpg":
        return "jpg";
      case "webp":
        return "webp";
      case "zip": {
        // ODT/DOCX are zips; if file-type couldn't narrow it, trust extension
        const byExt = EXT_MAP[extOf(filename)];
        return byExt === "docx" || byExt === "odt" ? byExt : null;
      }
      default:
        return null; // recognized binary type we don't support (exe, mp4, …)
    }
  }

  // No magic bytes — text-based formats
  const byExt = EXT_MAP[extOf(filename)];
  if (byExt === "txt" || byExt === "md" || byExt === "rtf") return byExt;

  // Unknown extension but looks like text? Treat as txt.
  const sample = buffer.subarray(0, 1024);
  const printable = sample.filter((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 128).length;
  if (sample.length > 0 && printable / sample.length > 0.9) return "txt";

  return null;
}
