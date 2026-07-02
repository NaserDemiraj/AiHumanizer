import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const { count } = await prisma.apiKey.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return NextResponse.json({ error: "Key not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
