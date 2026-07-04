import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { authenticateApiKey } from "@/app/lib/apiAuth";
import { rateLimit, clientIp } from "@/app/lib/ratelimit";
import { logActivity } from "@/app/lib/usage";
import { periodExpired } from "@/app/lib/plans";
import { MAX_UPLOAD_BYTES, UnsupportedFileError } from "@/app/lib/documentParse";
import { convertFile, ConvertError, CONVERT_TARGETS, type ConvertTarget } from "@/app/lib/convertCore";

const CONVERSION_LIMITS: Record<string, number | null> = {
  FREE: 20,
  PRO: 500,
  ENTERPRISE: null,
};

/**
 * Public API: convert a file.
 *
 *   POST /api/v1/convert   (multipart/form-data)
 *   Authorization: Bearer hf_live_...
 *   fields: file=<binary>, target=pdf|docx|txt|md
 */
export async function POST(request: Request) {
  const ipLimit = await rateLimit("v1-auth", clientIp(request), 60, 60);
  if (!ipLimit.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Missing or invalid API key. Send it as: Authorization: Bearer hf_live_..." },
      { status: 401 },
    );
  }

  const keyLimit = await rateLimit("v1-convert", auth.apiKey.id, 30, 60 * 60);
  if (!keyLimit.success) {
    return NextResponse.json({ error: "API rate limit exceeded for this key." }, { status: 429 });
  }

  const conversionsUsed = periodExpired(auth.user.periodStart) ? 0 : auth.user.conversionsUsed;
  const planLimit = CONVERSION_LIMITS[auth.user.plan] ?? CONVERSION_LIMITS.FREE;
  if (planLimit !== null && conversionsUsed >= planLimit) {
    return NextResponse.json(
      { error: `Monthly conversion limit reached (${planLimit}).` },
      { status: 402 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const target = String(formData?.get("target") ?? "").toLowerCase() as ConvertTarget;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "'file' is required (multipart/form-data)" }, { status: 400 });
  }
  if (!CONVERT_TARGETS.has(target)) {
    return NextResponse.json({ error: "'target' must be txt, md, docx, or pdf" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File exceeds the 10MB limit" }, { status: 400 });
  }

  let out;
  try {
    out = await convertFile(Buffer.from(await file.arrayBuffer()), file.name, target);
  } catch (err) {
    if (err instanceof ConvertError || err instanceof UnsupportedFileError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("v1/convert failed:", err);
    return NextResponse.json({ error: "Conversion failed" }, { status: 502 });
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: periodExpired(auth.user.periodStart)
      ? { conversionsUsed: 1, wordsUsed: 0, ocrPagesUsed: 0, periodStart: new Date() }
      : { conversionsUsed: { increment: 1 } },
  });
  logActivity(auth.user.id, "API_CALL", `v1/convert ${file.name} → ${target.toUpperCase()}`);

  const body = typeof out.data === "string" ? out.data : new Uint8Array(out.data);
  return new NextResponse(body, {
    headers: {
      "Content-Type": out.mime,
      "Content-Disposition": `attachment; filename="${out.filename}"`,
    },
  });
}
