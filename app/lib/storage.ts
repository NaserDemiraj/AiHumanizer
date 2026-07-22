import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { AwsClient } from "aws4fetch";

/**
 * File blob storage. Local-disk driver for dev; swaps to Cloudflare R2
 * (S3-compatible) automatically once R2_* env vars are set — same
 * fallback pattern as the rate limiter. Keys are opaque and generated
 * here; callers never control paths.
 *
 * Local disk is dev-only: a serverless deployment has an ephemeral, per-
 * instance filesystem, so uploads there MUST use R2. Set R2_ACCOUNT_ID,
 * R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET to switch drivers.
 */

const LOCAL_DIR = path.join(process.cwd(), "var", "uploads");

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

export function makeStorageKey(userId: string, filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  return `${userId}/${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
}

// --- Cloudflare R2 (S3-compatible) driver ---------------------------------

let r2Client: AwsClient | null = null;

function r2() {
  if (!r2Client) {
    r2Client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      region: "auto",
      service: "s3",
    });
  }
  return r2Client;
}

/** Object URL for a key. Keys are `${userId}/${ts}-${hex}${ext}` — encode each
 *  path segment but keep the slashes so R2 sees the intended prefix. */
function r2Url(key: string): string {
  const account = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET!;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `https://${account}.r2.cloudflarestorage.com/${bucket}/${encoded}`;
}

export async function putFile(key: string, data: Buffer): Promise<void> {
  if (r2Configured()) {
    const res = await r2().fetch(r2Url(key), {
      method: "PUT",
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      throw new Error(`R2 putFile failed: ${res.status} ${res.statusText}`);
    }
    return;
  }
  const filePath = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

export async function getFile(key: string): Promise<Buffer> {
  if (r2Configured()) {
    const res = await r2().fetch(r2Url(key));
    if (!res.ok) {
      // Non-2xx (incl. 404) — callers treat a throw as "no longer available".
      throw new Error(`R2 getFile failed: ${res.status} ${res.statusText}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(path.join(LOCAL_DIR, key));
}

export async function deleteFile(key: string): Promise<void> {
  if (r2Configured()) {
    // DELETE on a missing key still returns 204 — deletion is idempotent.
    await r2()
      .fetch(r2Url(key), { method: "DELETE" })
      .catch((err) => console.error(`R2 deleteFile failed for ${key}:`, err));
    return;
  }
  await unlink(path.join(LOCAL_DIR, key)).catch(() => {
    // already gone — deletion is idempotent
  });
}
