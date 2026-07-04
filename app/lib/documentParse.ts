import "server-only";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import WordExtractor from "word-extractor";
import { marked } from "marked";
import { detectFormat, type DocFormat, IMAGE_FORMATS } from "./fileFormat";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

export class UnsupportedFileError extends Error {}

export type ExtractedDocument = {
  format: DocFormat;
  /** Plain text — always present */
  text: string;
  /** Semantic HTML when the source format carries structure (docx, md) */
  html: string | null;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain text → minimal HTML: one <p> per paragraph. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/**
 * Minimal RTF text extractor: tracks group depth to skip non-content
 * destinations (font/color tables, metadata), decodes \uN and \'hh
 * escapes, maps \par to newlines. Text only — formatting is discarded.
 */
function extractRtfText(rtf: string): string {
  const SKIP_DESTINATIONS = new Set([
    "fonttbl", "colortbl", "stylesheet", "info", "pict", "object",
    "header", "footer", "themedata", "listtable", "listoverridetable",
  ]);
  let out = "";
  let i = 0;
  let skipDepth = 0; // >0 while inside a skipped destination group
  let depth = 0;
  const skipStack: number[] = [];

  while (i < rtf.length) {
    const ch = rtf[i];
    if (ch === "{") {
      depth++;
      i++;
      continue;
    }
    if (ch === "}") {
      if (skipDepth > 0 && depth === skipStack[skipStack.length - 1]) {
        skipStack.pop();
        skipDepth--;
      }
      depth--;
      i++;
      continue;
    }
    if (ch === "\\") {
      // \'hh — hex-encoded character
      if (rtf[i + 1] === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (skipDepth === 0) out += String.fromCharCode(parseInt(hex, 16) || 32);
        i += 4;
        continue;
      }
      // \*\destination or control word
      const m = /^\\\*?\\?([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i));
      if (m) {
        const word = m[1];
        const param = m[2];
        if (SKIP_DESTINATIONS.has(word) || rtf.slice(i, i + 2) === "\\*") {
          if (skipDepth === 0 || depth > (skipStack[skipStack.length - 1] ?? -1)) {
            skipStack.push(depth);
            skipDepth++;
          }
        } else if (skipDepth === 0) {
          if (word === "par" || word === "line") out += "\n";
          else if (word === "tab") out += "\t";
          else if (word === "u" && param) {
            let code = parseInt(param, 10);
            if (code < 0) code += 65536;
            out += String.fromCharCode(code);
            // consume the fallback character that follows \uN
            if (i + m[0].length < rtf.length && rtf[i + m[0].length] !== "\\") i++;
          }
        }
        i += m[0].length;
        continue;
      }
      // escaped literal: \{ \} \\
      const next = rtf[i + 1];
      if (next === "{" || next === "}" || next === "\\") {
        if (skipDepth === 0) out += next;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (skipDepth === 0 && ch !== "\r" && ch !== "\n") out += ch;
    i++;
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** ODT content.xml → plain text with paragraph breaks. */
async function extractOdtText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.file("content.xml");
  if (!contentFile) throw new UnsupportedFileError("Not a valid ODT file (missing content.xml)");
  const xml = await contentFile.async("string");
  return xml
    .replace(/<text:tab[^>]*\/>/g, "\t")
    .replace(/<text:line-break[^>]*\/>/g, "\n")
    .replace(/<text:s(?:\s+text:c="(\d+)")?[^>]*\/>/g, (_, n) => " ".repeat(n ? parseInt(n, 10) : 1))
    .replace(/<\/text:(p|h)>/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extracts text (and HTML where the format carries structure) from an upload. */
export async function extractDocument(buffer: Buffer, filename: string): Promise<ExtractedDocument> {
  const format = await detectFormat(buffer, filename);

  if (!format) {
    throw new UnsupportedFileError(
      "Unsupported file type. Upload a PDF, DOCX, DOC, RTF, ODT, TXT, Markdown, or image file.",
    );
  }
  if (IMAGE_FORMATS.includes(format)) {
    // Handled by the OCR pipeline, not text extraction
    return { format, text: "", html: null };
  }

  switch (format) {
    case "txt": {
      const text = buffer.toString("utf-8");
      return { format, text, html: null };
    }
    case "md": {
      const raw = buffer.toString("utf-8");
      const html = await marked.parse(raw, { async: true });
      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return { format, text, html };
    }
    case "docx": {
      const [rawResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ buffer }),
        mammoth.convertToHtml({ buffer }),
      ]);
      return { format, text: rawResult.value, html: htmlResult.value };
    }
    case "doc": {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buffer);
      return { format, text: doc.getBody(), html: null };
    }
    case "rtf": {
      return { format, text: extractRtfText(buffer.toString("utf-8")), html: null };
    }
    case "odt": {
      return { format, text: await extractOdtText(buffer), html: null };
    }
    case "pdf": {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return { format, text: result.text, html: null };
      } finally {
        await parser.destroy();
      }
    }
    default:
      // Image formats returned above; TS can't narrow the union across the guard
      throw new UnsupportedFileError(`Unsupported format: ${format}`);
  }
}

/** @deprecated kept for the existing /api/upload route — use extractDocument */
export async function extractTextFromUpload(buffer: Buffer, filename: string): Promise<string> {
  const { text } = await extractDocument(buffer, filename);
  return text;
}
