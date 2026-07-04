import "server-only";
import { Document as DocxDocument, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type Block = { kind: "h1" | "h2" | "h3" | "li" | "p"; text: string };

/**
 * Flattens semantic HTML into typed blocks (headings/list items/paragraphs).
 * Inline character formatting is not carried into DOCX/PDF yet.
 */
export function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const re = /<(h1|h2|h3|h4|h5|h6|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const text = m[2]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
      .trim();
    if (!text) continue;
    const kind: Block["kind"] =
      tag === "h1" ? "h1" : tag === "h2" ? "h2" : tag.startsWith("h") ? "h3" : tag === "li" ? "li" : "p";
    blocks.push({ kind, text });
  }
  return blocks;
}

export function textToBlocks(title: string | null, text: string): Block[] {
  const blocks: Block[] = title ? [{ kind: "h1", text: title }] : [];
  for (const p of text.split(/\n{2,}/)) if (p.trim()) blocks.push({ kind: "p", text: p.trim() });
  return blocks;
}

export async function buildDocx(blocks: Block[]): Promise<Buffer> {
  const children = blocks.map((b) => {
    if (b.kind === "h1") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_1 });
    if (b.kind === "h2") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_2 });
    if (b.kind === "h3") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_3 });
    if (b.kind === "li") return new Paragraph({ children: [new TextRun(b.text)], bullet: { level: 0 } });
    return new Paragraph({ children: [new TextRun(b.text)] });
  });
  const doc = new DocxDocument({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

export async function buildPdf(blocks: Block[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595; // A4
  const pageHeight = 842;
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 16;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const wrap = (text: string, size: number, f = font): string[] => {
    const lines: string[] = [];
    for (const rawLine of text.split(/\n/)) {
      const words = rawLine.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(candidate, size) > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }
    return lines;
  };

  const write = (text: string, size: number, f = font, color = rgb(0.07, 0.09, 0.15)) => {
    for (const line of wrap(text, size, f)) {
      if (y < margin + lineHeight) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size, font: f, color });
      y -= lineHeight * (size / 11);
    }
    y -= lineHeight / 2;
  };

  for (const b of blocks) {
    if (b.kind === "h1") write(b.text, 18, bold);
    else if (b.kind === "h2") write(b.text, 14, bold, rgb(0.18, 0.42, 1));
    else if (b.kind === "h3") write(b.text, 12, bold);
    else if (b.kind === "li") write(`•  ${b.text}`, 11);
    else write(b.text, 11);
  }

  return pdf.save();
}

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.kind === "h1") return `# ${b.text}`;
      if (b.kind === "h2") return `## ${b.text}`;
      if (b.kind === "h3") return `### ${b.text}`;
      if (b.kind === "li") return `- ${b.text}`;
      return b.text;
    })
    .join("\n\n");
}

export function blocksToText(blocks: Block[]): string {
  return blocks.map((b) => (b.kind === "li" ? `• ${b.text}` : b.text)).join("\n\n");
}
