import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { hashPassword, createSession } from "@/app/lib/auth";
import { consumeToken } from "@/app/lib/verification";

export async function POST(request: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = body.token?.trim();
  const password = body.password;
  if (!token || !password) {
    return NextResponse.json({ error: "Missing token or password" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const consumed = await consumeToken(token, "PASSWORD_RESET");
  if (!consumed) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: consumed.userId },
    data: { passwordHash: await hashPassword(password) },
  });

  // Invalidate every existing session — a password reset should log out
  // any attacker who had access via the old (possibly compromised) password.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
