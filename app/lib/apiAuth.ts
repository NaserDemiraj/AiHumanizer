import "server-only";
import type { ApiKey, User } from "@prisma/client";
import { prisma } from "./db";
import { hashApiKey } from "./apikeys";

export type ApiAuth = { user: User; apiKey: ApiKey };

/**
 * Authenticates a public-API request via `Authorization: Bearer hf_live_…`.
 * Returns null when the header is missing/invalid; touches lastUsedAt on
 * success (fire-and-forget).
 */
export async function authenticateApiKey(request: Request): Promise<ApiAuth | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(token) },
    include: { user: true },
  });
  if (!apiKey) return null;

  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => null);

  return { user: apiKey.user, apiKey };
}
