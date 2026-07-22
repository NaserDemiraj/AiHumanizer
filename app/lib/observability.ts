import "server-only";
import { randomUUID } from "node:crypto";

/**
 * Lightweight, dependency-free error capture.
 *
 * Today every failing path just does `console.error`, which vanishes into
 * per-instance serverless logs — you can't tell whether rewrites are failing
 * for one user or everyone. This gives one funnel for errors:
 *
 *   - Always logs a single structured JSON line (so platform log search works).
 *   - When SENTRY_DSN is set, also ships the event to Sentry, best-effort and
 *     fire-and-forget, so a reporting hiccup never affects the request.
 *
 * It intentionally implements only the minimal Sentry store payload (message +
 * exception + context). Swap in @sentry/nextjs later for tracing/source maps;
 * call sites won't change.
 */

type Context = Record<string, unknown>;

function parseDsn(dsn: string) {
  // https://<publicKey>@<host>/<projectId>
  const url = new URL(dsn);
  const projectId = url.pathname.replace(/^\//, "");
  return {
    publicKey: url.username,
    host: url.host,
    projectId,
    endpoint: `${url.protocol}//${url.host}/api/${projectId}/store/`,
  };
}

function shipToSentry(message: string, err: unknown, context?: Context): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  let parsed: ReturnType<typeof parseDsn>;
  try {
    parsed = parseDsn(dsn);
  } catch {
    return; // malformed DSN — the structured log still captured everything
  }

  const error = err instanceof Error ? err : undefined;
  const payload = {
    event_id: randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "error",
    environment: process.env.NODE_ENV ?? "development",
    message,
    exception: error
      ? { values: [{ type: error.name, value: error.message, stacktrace: undefined }] }
      : undefined,
    extra: { ...context, raw: error ? undefined : String(err) },
  };

  void fetch(parsed.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=humanflow/1.0`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Never let error reporting throw into the request path.
  });
}

/**
 * Report a server-side error. `context` should carry the few identifiers that
 * make an error triageable (route, userId, mode, …) — never secrets or full
 * request bodies.
 */
export function captureError(message: string, err: unknown, context?: Context): void {
  const error = err instanceof Error ? err : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      message,
      error: error ? { name: error.name, message: error.message } : String(err),
      ...context,
    }),
  );
  shipToSentry(message, err, context);
}
