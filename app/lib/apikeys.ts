import "server-only";
import { createHash } from "node:crypto";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
