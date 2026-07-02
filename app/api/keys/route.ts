import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/usage";
import { hashApiKey } from "@/app/lib/apikeys";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json(keys);
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
  const name = body.name?.trim() || "API key";

  // hf_live_<48 hex chars> — shown once, only the hash is stored
  const secret = `hf_live_${randomBytes(24).toString("hex")}`;
  const prefix = secret.slice(0, 15);

  const key = await prisma.apiKey.create({
    data: { userId: user.id, name, prefix, keyHash: hashApiKey(secret) },
  });
  logActivity(user.id, "KEY_CREATED", name);

  return NextResponse.json(
    { id: key.id, name: key.name, prefix: key.prefix, secret, createdAt: key.createdAt },
    { status: 201 },
  );
}
