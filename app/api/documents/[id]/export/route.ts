import { NextResponse } from "next/server";
import { Document as DocxDocument, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/usage";

type Params = { params: Promise<{ id: string }> };

function safeFilename(title: string): string {
  return title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "document";
}

function buildPlainText(title: string, original: string, improved: string | null): string {
  let out = `${title}\n${"=".repeat(Math.min(60, title.length))}\n\n`;
  if (improved) {
    out += `IMPROVED TEXT\n-------------\n${improved}\n\nORIGINAL TEXT\n-------------\n${original}\n`;
  } else {
    out += `${original}\n`;
  }
  return out;
}

async function buildDocx(title: string, original: string, improved: string | null): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
  ];
  if (improved) {
    children.push(new Paragraph({ text: "Improved text", heading: HeadingLevel.HEADING_2 }));
    for (const para of improved.split(/\n+/)) {
      children.push(new Paragraph({ children: [new TextRun(para)] }));
    }
    children.push(new Paragraph({ text: "Original text", heading: HeadingLevel.HEADING_2 }));
  }
  for (const para of original.split(/\n+/)) {
    children.push(new Paragraph({ children: [new TextRun(para)] }));
  }
  const doc = new DocxDocument({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

async function buildPdf(title: string, original: string, improved: string | null): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595; // A4
  const pageHeight = 842;
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  const bodySize = 11;
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
      y -= lineHeight;
    }
    y -= lineHeight / 2;
  };

  write(title, 18, bold);
  if (improved) {
    write("Improved text", 13, bold, rgb(0.18, 0.42, 1));
    write(improved, bodySize);
    write("Original text", 13, bold, rgb(0.35, 0.4, 0.48));
    write(original, bodySize, font, rgb(0.35, 0.4, 0.48));
  } else {
    write(original, bodySize);
  }

  return pdf.save();
}

export async function GET(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const format = new URL(request.url).searchParams.get("format") ?? "txt";
  const filename = safeFilename(doc.title);

  logActivity(user.id, "EXPORT", `${doc.title} → ${format.toUpperCase()}`);

  if (format === "txt") {
    return new NextResponse(buildPlainText(doc.title, doc.originalText, doc.improvedText), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.txt"`,
      },
    });
  }

  if (format === "docx") {
    const buffer = await buildDocx(doc.title, doc.originalText, doc.improvedText);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
      },
    });
  }

  if (format === "pdf") {
    const bytes = await buildPdf(doc.title, doc.originalText, doc.improvedText);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown format. Use txt, docx, or pdf." }, { status: 400 });
}
