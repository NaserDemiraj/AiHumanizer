import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Sliding-window rate limiting. Backed by Upstash Redis when configured
 * (survives serverless cold starts, shared across instances); falls back
 * to an in-memory Map otherwise so the app still protects itself in dev
 * or before Upstash is wired up — just without cross-instance sharing.
 */

const redisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

const redis = redisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

export type RateLimitResult = { success: boolean; remaining: number; resetMs: number };

type MemoryEntry = { count: number; resetAt: number };
const memoryStore = new Map<string, MemoryEntry>();

// Prevent unbounded growth of the in-memory fallback store
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt < now) memoryStore.delete(key);
    }
  },
  5 * 60 * 1000,
).unref?.();

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetMs: windowMs };
  }

  entry.count += 1;
  const success = entry.count <= limit;
  return { success, remaining: Math.max(0, limit - entry.count), resetMs: entry.resetAt - now };
}

const limiters = new Map<string, Ratelimit>();

function getRedisLimiter(name: string, limit: number, windowSeconds: number): Ratelimit {
  const key = `${name}:${limit}:${windowSeconds}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `hf_rl_${name}`,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

/**
 * @param name    Bucket name, e.g. "login" — isolates limits per route
 * @param id      Identifier to limit by (IP, user id, ...)
 * @param limit   Max requests
 * @param windowSeconds  Window size in seconds
 */
export async function rateLimit(
  name: string,
  id: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (redis) {
    const limiter = getRedisLimiter(name, limit, windowSeconds);
    const { success, remaining, reset } = await limiter.limit(id);
    return { success, remaining, resetMs: Math.max(0, reset - Date.now()) };
  }
  return memoryLimit(`${name}:${id}`, limit, windowSeconds * 1000);
}

/** Best-effort client IP from standard proxy headers (Vercel, most hosts). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
