import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { verifyPassword, createSession } from "@/app/lib/auth";
import { rateLimit, clientIp } from "@/app/lib/ratelimit";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Limit by IP+email together: caps brute-forcing one account without
  // letting a single IP guessing many emails hide behind a shared bucket.
  const limit = await rateLimit("login", `${clientIp(request)}:${email}`, 10, 5 * 60);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
