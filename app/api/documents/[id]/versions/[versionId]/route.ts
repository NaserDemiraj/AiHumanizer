import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";

type Params = { params: Promise<{ id: string; versionId: string }> };

async function ownedVersion(userId: string, docId: string, versionId: string) {
  return prisma.documentVersion.findFirst({
    where: { id: versionId, documentId: docId, document: { userId } },
  });
}

/** Full version content — used for restore and compare. */
export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id, versionId } = await params;
  const version = await ownedVersion(user.id, id, versionId);
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  return NextResponse.json(version);
}

/** Rename a version. */
export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id, versionId } = await params;
  const version = await ownedVersion(user.id, id, versionId);
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { label?: string };
  const label = body.label?.trim().slice(0, 80);
  if (!label) return NextResponse.json({ error: "Label is required" }, { status: 400 });

  await prisma.documentVersion.update({ where: { id: versionId }, data: { label } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id, versionId } = await params;
  const version = await ownedVersion(user.id, id, versionId);
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  await prisma.documentVersion.delete({ where: { id: versionId } });
  return NextResponse.json({ ok: true });
}
