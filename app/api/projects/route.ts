import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/usage";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { documents: true } } },
  });
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  if (name.length > 80) {
    return NextResponse.json({ error: "Project name is too long" }, { status: 400 });
  }

  const project = await prisma.project.create({ data: { userId: user.id, name } });
  logActivity(user.id, "PROJECT_CREATED", name);
  return NextResponse.json(project, { status: 201 });
}
