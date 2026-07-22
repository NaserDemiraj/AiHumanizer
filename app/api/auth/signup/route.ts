import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { hashPassword, createSession, passwordProblem } from "@/app/lib/auth";
import { rateLimit, clientIp } from "@/app/lib/ratelimit";
import { sendVerificationEmail } from "@/app/lib/email";
import { issueToken } from "@/app/lib/verification";
import { isDisposableEmail } from "@/app/lib/emailValidation";

export async function POST(request: Request) {
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (isDisposableEmail(email)) {
    return NextResponse.json(
      { error: "Please use a permanent email address — disposable addresses aren't allowed." },
      { status: 400 },
    );
  }
  const pwProblem = passwordProblem(password);
  if (pwProblem) {
    return NextResponse.json({ error: pwProblem }, { status: 400 });
  }

  // Caps mass account creation from one IP (each account = free Groq words)
  const limit = await rateLimit("signup", clientIp(request), 5, 60 * 60);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many accounts created recently. Try again later." },
      { status: 429 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });
  await createSession(user.id);

  // Non-blocking: a flaky email provider should never break signup itself.
  // The account works immediately; verification just unlocks a badge/nag
  // removal rather than gating usage.
  issueToken(user.id, "EMAIL_VERIFY")
    .then((token) => sendVerificationEmail(user.email, user.name, token))
    .catch((err) => console.error("Failed to send verification email:", err));

  return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
}
