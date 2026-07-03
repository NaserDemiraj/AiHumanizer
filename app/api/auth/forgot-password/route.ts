import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { issueToken } from "@/app/lib/verification";
import { sendPasswordResetEmail } from "@/app/lib/email";
import { rateLimit, clientIp } from "@/app/lib/ratelimit";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const limit = await rateLimit("forgot-password", clientIp(request), 5, 15 * 60);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Always return the same generic response — this endpoint intentionally
  // does NOT reveal whether the email is registered (unlike signup, where
  // telling the user is a UX requirement, not just an information leak).
  if (user) {
    const token = await issueToken(user.id, "PASSWORD_RESET");
    sendPasswordResetEmail(user.email, user.name, token).catch((err) =>
      console.error("Failed to send password reset email:", err),
    );
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link is on its way.",
  });
}
