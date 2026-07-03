import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { consumeToken } from "@/app/lib/verification";

export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const consumed = await consumeToken(token, "EMAIL_VERIFY");
  if (!consumed) {
    return NextResponse.json(
      { error: "This verification link is invalid or has expired." },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: consumed.userId },
    data: { emailVerified: true },
  });

  return NextResponse.json({ ok: true });
}
