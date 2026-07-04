import { NextResponse } from "next/server";
import TurndownService from "turndown";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/usage";
import { htmlToBlocks, buildDocx, buildPdf, type Block } from "@/app/lib/exportBuilders";

type Params = { params: Promise<{ id: string }> };

function safeFilename(title: string): string {
  return title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "document";
}

/** Editor documents store { doc: <ProseMirror JSON>, html: string } in content. */
function editorHtml(doc: { content: unknown }): string | null {
  const content = doc.content as { html?: string } | null;
  return typeof content?.html === "string" && content.html.trim() ? content.html : null;
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

function toolDocBlocks(title: string, original: string, improved: string | null): Block[] {
  const blocks: Block[] = [{ kind: "h1", text: title }];
  if (improved) {
    blocks.push({ kind: "h2", text: "Improved text" });
    for (const p of improved.split(/\n+/)) if (p.trim()) blocks.push({ kind: "p", text: p });
    blocks.push({ kind: "h2", text: "Original text" });
  }
  for (const p of original.split(/\n+/)) if (p.trim()) blocks.push({ kind: "p", text: p });
  return blocks;
}

export async function GET(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const format = new URL(request.url).searchParams.get("format") ?? "txt";
  const filename = safeFilename(doc.title);
  const html = editorHtml(doc);
  const bodyText = doc.improvedText || doc.originalText;

  logActivity(user.id, "EXPORT", `${doc.title} → ${format.toUpperCase()}`);

  if (format === "txt") {
    const body = html
      ? `${doc.title}\n${"=".repeat(Math.min(60, doc.title.length))}\n\n${bodyText}\n`
      : buildPlainText(doc.title, doc.originalText, doc.improvedText);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.txt"`,
      },
    });
  }

  if (format === "md") {
    const markdown = html
      ? new TurndownService({ headingStyle: "atx" }).turndown(html)
      : `# ${doc.title}\n\n${bodyText}\n`;
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
      },
    });
  }

  const blocks = html
    ? [{ kind: "h1" as const, text: doc.title }, ...htmlToBlocks(html)]
    : toolDocBlocks(doc.title, doc.originalText, doc.improvedText);

  if (format === "docx") {
    const buffer = await buildDocx(blocks);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
      },
    });
  }

  if (format === "pdf") {
    const bytes = await buildPdf(blocks);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown format. Use txt, md, docx, or pdf." }, { status: 400 });
}
