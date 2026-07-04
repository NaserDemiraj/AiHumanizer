import "server-only";
import TurndownService from "turndown";
import type { Document } from "@prisma/client";
import {
  htmlToBlocks,
  buildDocx,
  buildPdf,
  blocksToText,
  type Block,
} from "./exportBuilders";

export type ExportFormat = "txt" | "md" | "docx" | "pdf";

export type ExportFile = {
  data: Buffer | string;
  filename: string;
  mime: string;
};

export function safeFilename(title: string): string {
  return title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "document";
}

function editorHtml(doc: Document): string | null {
  const content = doc.content as { html?: string } | null;
  return typeof content?.html === "string" && content.html.trim() ? content.html : null;
}

function docBlocks(doc: Document): Block[] {
  const html = editorHtml(doc);
  if (html) return [{ kind: "h1", text: doc.title }, ...htmlToBlocks(html)];

  const blocks: Block[] = [{ kind: "h1", text: doc.title }];
  const improved = doc.improvedText;
  if (improved && improved !== doc.originalText) {
    blocks.push({ kind: "h2", text: "Improved text" });
    for (const p of improved.split(/\n+/)) if (p.trim()) blocks.push({ kind: "p", text: p });
    blocks.push({ kind: "h2", text: "Original text" });
  }
  for (const p of doc.originalText.split(/\n+/)) if (p.trim()) blocks.push({ kind: "p", text: p });
  return blocks;
}

/** Renders a document into the requested format — shared by single export and batch ZIP. */
export async function exportDocument(doc: Document, format: ExportFormat): Promise<ExportFile> {
  const filename = safeFilename(doc.title);
  const html = editorHtml(doc);
  const blocks = docBlocks(doc);

  switch (format) {
    case "txt":
      return {
        data: blocksToText(blocks),
        filename: `${filename}.txt`,
        mime: "text/plain; charset=utf-8",
      };
    case "md": {
      const markdown = html
        ? `# ${doc.title}\n\n${new TurndownService({ headingStyle: "atx" }).turndown(html)}`
        : blocks
            .map((b) =>
              b.kind === "h1" ? `# ${b.text}` : b.kind === "h2" ? `## ${b.text}` : b.kind === "li" ? `- ${b.text}` : b.text,
            )
            .join("\n\n");
      return { data: markdown, filename: `${filename}.md`, mime: "text/markdown; charset=utf-8" };
    }
    case "docx":
      return {
        data: await buildDocx(blocks),
        filename: `${filename}.docx`,
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    case "pdf":
      return {
        data: Buffer.from(await buildPdf(blocks)),
        filename: `${filename}.pdf`,
        mime: "application/pdf",
      };
  }
}
