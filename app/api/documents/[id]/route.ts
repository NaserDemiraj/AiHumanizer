import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/usage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, userId: user.id },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  return NextResponse.json(document);
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  let body: {
    favorite?: boolean;
    projectId?: string | null;
    title?: string;
    tags?: string[];
    /** Editor autosave payload: ProseMirror JSON + rendered HTML + plain text */
    content?: { doc: unknown; html: string };
    text?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data: {
    favorite?: boolean;
    projectId?: string | null;
    title?: string;
    tags?: string[];
    content?: Prisma.InputJsonValue;
    improvedText?: string;
  } = {};
  if (typeof body.favorite === "boolean") data.favorite = body.favorite;
  if (body.title?.trim()) data.title = body.title.trim();
  if (Array.isArray(body.tags)) {
    data.tags = body.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 20);
  }
  if (body.content && typeof body.content.html === "string") {
    data.content = body.content as Prisma.InputJsonValue;
    if (typeof body.text === "string") data.improvedText = body.text;
  }
  if (body.projectId !== undefined) {
    if (body.projectId !== null) {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, userId: user.id },
      });
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    data.projectId = body.projectId;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { count } = await prisma.document.updateMany({
    where: { id, userId: user.id },
    data,
  });
  if (count === 0) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const updated = await prisma.document.findUnique({ where: { id } });
  return NextResponse.json(updated);
}

/**
 * First DELETE moves the document to trash (soft delete); a second DELETE
 * (or ?permanent=true) removes it for good, reclaiming stored file bytes.
 * POST /api/documents/[id]/restore undoes a soft delete.
 */
export async function DELETE(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const permanent =
    new URL(request.url).searchParams.get("permanent") === "true" || doc.deletedAt !== null;

  if (!permanent) {
    await prisma.document.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
    logActivity(user.id, "DOC_TRASHED", doc.title);
    return NextResponse.json({ ok: true, trashed: true });
  }

  if (doc.sourcePath) {
    const { deleteFile } = await import("@/app/lib/storage");
    await deleteFile(doc.sourcePath);
  }
  await prisma.$transaction([
    prisma.document.delete({ where: { id: doc.id } }),
    ...(doc.sourceBytes
      ? [
          prisma.user.update({
            where: { id: user.id },
            data: { storageBytes: { decrement: doc.sourceBytes } },
          }),
        ]
      : []),
  ]);
  logActivity(user.id, "DOC_DELETED", doc.title);
  return NextResponse.json({ ok: true, trashed: false });
}
