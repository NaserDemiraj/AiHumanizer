import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { rateLimit } from "@/app/lib/ratelimit";
import { logActivity } from "@/app/lib/usage";
import { exportDocument, type ExportFormat } from "@/app/lib/documentExport";

const FORMATS = new Set<ExportFormat>(["txt", "md", "docx", "pdf"]);

/** Bundles up to 10 of the user's documents into a ZIP in the chosen format. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limit = await rateLimit("batch-zip", user.id, 10, 10 * 60);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many ZIP downloads. Wait a few minutes." }, { status: 429 });
  }

  let body: { documentIds?: string[]; format?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const ids = (body.documentIds ?? []).filter((x) => typeof x === "string").slice(0, 10);
  const format = (body.format ?? "docx") as ExportFormat;
  if (ids.length === 0) return NextResponse.json({ error: "No documents selected" }, { status: 400 });
  if (!FORMATS.has(format)) {
    return NextResponse.json({ error: "Format must be txt, md, docx, or pdf" }, { status: 400 });
  }

  const docs = await prisma.document.findMany({
    where: { id: { in: ids }, userId: user.id },
  });
  if (docs.length === 0) return NextResponse.json({ error: "Documents not found" }, { status: 404 });

  const zip = new JSZip();
  const seen = new Set<string>();
  for (const doc of docs) {
    const file = await exportDocument(doc, format);
    // De-duplicate filenames inside the archive
    let name = file.filename;
    let n = 2;
    while (seen.has(name)) {
      name = file.filename.replace(/(\.[^.]+)$/, `-${n}$1`);
      n++;
    }
    seen.add(name);
    zip.file(name, file.data);
  }

  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  logActivity(user.id, "BATCH_ZIP", `${docs.length} documents → ${format.toUpperCase()}`);

  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="humanflow-batch.zip"`,
    },
  });
}
