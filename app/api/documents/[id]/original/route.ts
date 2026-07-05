import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { getFile } from "@/app/lib/storage";

const MIME_BY_FORMAT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

function safeFilename(title: string): string {
  return title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "document";
}

/** Streams back the exact original file the user uploaded, byte-for-byte. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!doc.sourcePath || !doc.sourceFormat) {
    return NextResponse.json(
      { error: "This document has no uploaded original — it was created in the editor." },
      { status: 404 },
    );
  }

  let data: Buffer;
  try {
    data = await getFile(doc.sourcePath);
  } catch {
    return NextResponse.json(
      { error: "The original file is no longer available in storage." },
      { status: 410 },
    );
  }

  const mime = MIME_BY_FORMAT[doc.sourceFormat] ?? "application/octet-stream";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${safeFilename(doc.title)}.${doc.sourceFormat}"`,
    },
  });
}
