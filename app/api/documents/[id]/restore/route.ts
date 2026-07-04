import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/usage";

/** Restores a trashed document. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const { count } = await prisma.document.updateMany({
    where: { id, userId: user.id, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (count === 0) return NextResponse.json({ error: "Document not found in trash" }, { status: 404 });

  const doc = await prisma.document.findUnique({ where: { id }, select: { title: true } });
  logActivity(user.id, "DOC_RESTORED", doc?.title ?? id);
  return NextResponse.json({ ok: true });
}
