import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth";
import { rateLimit } from "@/app/lib/ratelimit";
import {
  extractTextFromUpload,
  UnsupportedFileError,
  MAX_UPLOAD_BYTES,
} from "@/app/lib/documentParse";
import { countWords } from "@/app/lib/plans";

const MAX_OUTPUT_WORDS = 3_000; // matches the humanize/tools per-request cap

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to upload documents" }, { status: 401 });
  }

  const limit = await rateLimit("upload", user.id, 20, 10 * 60);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many uploads. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Max size is ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    text = await extractTextFromUpload(buffer, file.name);
  } catch (err) {
    if (err instanceof UnsupportedFileError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Upload parse failed:", err);
    return NextResponse.json(
      { error: "Couldn't read that file. It may be corrupted or password-protected." },
      { status: 400 },
    );
  }

  text = text.trim();
  if (!text) {
    return NextResponse.json({ error: "No readable text found in that file." }, { status: 400 });
  }

  const words = text.split(/\s+/).filter(Boolean);
  let truncated = false;
  if (words.length > MAX_OUTPUT_WORDS) {
    text = words.slice(0, MAX_OUTPUT_WORDS).join(" ");
    truncated = true;
  }

  return NextResponse.json({
    text,
    words: countWords(text),
    truncated,
  });
}
