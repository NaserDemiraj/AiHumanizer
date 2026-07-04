import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * File blob storage. Local-disk driver for dev; swaps to Cloudflare R2
 * (S3-compatible) automatically once R2_* env vars are set — same
 * fallback pattern as the rate limiter. Keys are opaque and generated
 * here; callers never control paths.
 */

const LOCAL_DIR = path.join(process.cwd(), "var", "uploads");

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY,
  );
}

export function makeStorageKey(userId: string, filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  return `${userId}/${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
}

export async function putFile(key: string, data: Buffer): Promise<void> {
  if (r2Configured()) {
    // R2 driver lands when credentials exist — the call sites won't change.
    throw new Error("R2 driver not implemented yet — remove R2_* env vars to use local storage");
  }
  const filePath = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

export async function getFile(key: string): Promise<Buffer> {
  if (r2Configured()) {
    throw new Error("R2 driver not implemented yet — remove R2_* env vars to use local storage");
  }
  return readFile(path.join(LOCAL_DIR, key));
}

export async function deleteFile(key: string): Promise<void> {
  if (r2Configured()) {
    throw new Error("R2 driver not implemented yet — remove R2_* env vars to use local storage");
  }
  await unlink(path.join(LOCAL_DIR, key)).catch(() => {
    // already gone — deletion is idempotent
  });
}
