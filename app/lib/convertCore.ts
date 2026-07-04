import "server-only";
import TurndownService from "turndown";
import { extractDocument } from "./documentParse";
import { IMAGE_FORMATS } from "./fileFormat";
import {
  htmlToBlocks,
  textToBlocks,
  buildDocx,
  buildPdf,
  blocksToMarkdown,
  blocksToText,
} from "./exportBuilders";
import type { ExportFile } from "./documentExport";

export type ConvertTarget = "txt" | "md" | "docx" | "pdf";
export const CONVERT_TARGETS = new Set<ConvertTarget>(["txt", "md", "docx", "pdf"]);

export class ConvertError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Shared convert pipeline used by the web converter and the public API. */
export async function convertFile(
  buffer: Buffer,
  filename: string,
  target: ConvertTarget,
): Promise<ExportFile> {
  const extracted = await extractDocument(buffer, filename);

  if (IMAGE_FORMATS.includes(extracted.format)) {
    throw new ConvertError("Images need OCR first — upload them through the editor instead.");
  }
  if (!extracted.text.trim()) {
    throw new ConvertError("No readable text found in that file.");
  }

  const blocks = extracted.html ? htmlToBlocks(extracted.html) : textToBlocks(null, extracted.text);
  const basename =
    filename.replace(/\.[^.]+$/, "").replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "converted";

  switch (target) {
    case "txt":
      return {
        data: blocksToText(blocks),
        filename: `${basename}.txt`,
        mime: "text/plain; charset=utf-8",
      };
    case "md": {
      const markdown = extracted.html
        ? new TurndownService({ headingStyle: "atx" }).turndown(extracted.html)
        : blocksToMarkdown(blocks);
      return { data: markdown, filename: `${basename}.md`, mime: "text/markdown; charset=utf-8" };
    }
    case "docx":
      return {
        data: await buildDocx(blocks),
        filename: `${basename}.docx`,
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    case "pdf":
      return {
        data: Buffer.from(await buildPdf(blocks)),
        filename: `${basename}.pdf`,
        mime: "application/pdf",
      };
  }
}
