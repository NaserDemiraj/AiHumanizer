import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

  const { count } = await prisma.project.updateMany({
    where: { id, userId: user.id },
    data: { name },
  });
  if (count === 0) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const { count } = await prisma.project.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
