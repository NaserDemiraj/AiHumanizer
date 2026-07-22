import { NextResponse } from "next/server";
import { runCleanup } from "@/app/lib/cleanup";
import { runQuotaNudges } from "@/app/lib/nudges";
import { captureError } from "@/app/lib/observability";

/**
 * Scheduled maintenance endpoint. Purges long-trashed documents (reclaiming
 * their stored files and storage quota) and expired/used verification tokens,
 * then emails quota nudges to users near their monthly limit.
 *
 * Guarded by CRON_SECRET — Vercel Cron sends it automatically as a Bearer
 * token; any other scheduler can call it the same way:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://host/api/cron/cleanup
 *
 * If CRON_SECRET is unset the endpoint is disabled (503) so it can never run
 * unauthenticated.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cleanup is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cleanup = await runCleanup();
    const nudges = await runQuotaNudges();
    return NextResponse.json({ ok: true, ...cleanup, ...nudges });
  } catch (err) {
    captureError("scheduled maintenance failed", err, { route: "/api/cron/cleanup" });
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
}

// Vercel Cron issues GET; support POST too for manual/other schedulers.
export const GET = handle;
export const POST = handle;
