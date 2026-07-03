import "server-only";
import { randomBytes } from "node:crypto";
import type { VerificationTokenType } from "@prisma/client";
import { prisma } from "./db";

const TTL_MS: Record<VerificationTokenType, number> = {
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

export async function issueToken(userId: string, type: VerificationTokenType): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: { token, type, userId, expiresAt: new Date(Date.now() + TTL_MS[type]) },
  });
  return token;
}

/** Consumes the token if valid (unexpired, unused) and returns its userId. */
export async function consumeToken(
  token: string,
  type: VerificationTokenType,
): Promise<{ userId: string } | null> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }
  await prisma.verificationToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });
  return { userId: record.userId };
}
