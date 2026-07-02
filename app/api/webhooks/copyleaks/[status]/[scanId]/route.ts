import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import type { CopyleaksCompletedPayload } from "@/app/lib/copyleaks";

/**
 * Receives Copyleaks scan status callbacks. The scanId in the path is our
 * Document id (unguessable cuid), which scopes each callback to one record.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ status: string; scanId: string }> },
) {
  const { status, scanId } = await params;

  const doc = await prisma.document.findUnique({ where: { id: scanId } });
  if (!doc || doc.kind !== "plagiarism") {
    // Unknown scan — acknowledge anyway so Copyleaks stops retrying
    return NextResponse.json({ ok: true });
  }

  if (status === "completed") {
    const payload = (await request.json().catch(() => null)) as CopyleaksCompletedPayload | null;
    const score = payload?.results?.score;
    const aggregated = score?.aggregatedScore ?? 0;
    const originality = Math.max(0, Math.min(100, Math.round(100 - aggregated)));
    const matches = (payload?.results?.internet ?? []).slice(0, 10).map((m) => ({
      url: m.url,
      title: m.title,
      matchedWords: m.matchedWords,
    }));

    await prisma.document.update({
      where: { id: scanId },
      data: {
        improvedText: `${originality}% original — ${matches.length} matching source${matches.length === 1 ? "" : "s"} found (Copyleaks scan).`,
        metrics: {
          provider: "copyleaks",
          status: "completed",
          originalityScore: originality,
          similarityScore: Math.round(aggregated),
          identicalWords: score?.identicalWords ?? 0,
          matches,
        },
      },
    });
  } else if (status === "error") {
    const body = await request.text().catch(() => "");
    console.error(`Copyleaks scan ${scanId} failed:`, body.slice(0, 500));
    await prisma.document.update({
      where: { id: scanId },
      data: {
        improvedText: "Plagiarism scan failed. Try again later.",
        metrics: { provider: "copyleaks", status: "error" },
      },
    });
  }
  // "creditsChecked" / "indexed" statuses need no action

  return NextResponse.json({ ok: true });
}
