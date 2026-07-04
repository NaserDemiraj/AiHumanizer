import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Lists versions (metadata only — full content comes from the version detail route). */
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, label: true, op: true, createdAt: true },
  });
  return NextResponse.json(versions);
}

/**
 * Creates a version snapshot. The client sends the document state to
 * snapshot — typically the state *before* applying an AI change, so
 * restore always means "go back to how it was".
 */
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  let body: { label?: string; op?: string; text?: string; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const op = body.op?.trim() || "manual";
  const label = body.label?.trim().slice(0, 80) || op;
  if (typeof body.text !== "string") {
    return NextResponse.json({ error: "Missing text snapshot" }, { status: 400 });
  }

  // Keep at most 50 versions per document — drop the oldest beyond that
  const excess = await prisma.documentVersion.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    skip: 49,
    select: { id: true },
  });
  if (excess.length > 0) {
    await prisma.documentVersion.deleteMany({
      where: { id: { in: excess.map((v) => v.id) } },
    });
  }

  const version = await prisma.documentVersion.create({
    data: {
      documentId: id,
      label,
      op,
      text: body.text,
      content: (body.content as Prisma.InputJsonValue | undefined) ?? undefined,
    },
    select: { id: true, label: true, op: true, createdAt: true },
  });
  return NextResponse.json(version, { status: 201 });
}
