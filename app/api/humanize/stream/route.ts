import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";
import { streamRewriteText, estimateMetrics } from "@/app/lib/llm";
import { countWords } from "@/app/lib/plans";
import { checkQuota, logActivity } from "@/app/lib/usage";
import { rateLimit } from "@/app/lib/ratelimit";

const MAX_INPUT_WORDS = 3_000;

/**
 * Streaming counterpart to /api/humanize, used by the interactive editor.
 * Responds with newline-delimited JSON events instead of a single JSON
 * body, so the UI can render text as Groq generates it:
 *
 *   {"type":"delta","text":"..."}          — zero or more
 *   {"type":"done","documentId":...,"metrics":{...},"wordsUsed":...,"limit":...}
 *   {"type":"error","error":"..."}         — instead of "done" on failure
 *
 * The public v1 API keeps using the non-streaming /api/humanize, whose
 * request/response contract this does not change.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to humanize text" }, { status: 401 });
  }

  const limit = await rateLimit("humanize", user.id, 20, 10 * 60);
  if (!limit.success) {
    return NextResponse.json(
      { error: "You're humanizing text too quickly. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  let body: { text?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = body.text?.trim();
  const mode = body.mode?.trim() || "Humanize";
  if (!text) {
    return NextResponse.json({ error: "Paste some text to humanize" }, { status: 400 });
  }

  const words = countWords(text);
  if (words > MAX_INPUT_WORDS) {
    return NextResponse.json(
      { error: `Text is too long (${words.toLocaleString()} words). Limit is ${MAX_INPUT_WORDS.toLocaleString()} words per request.` },
      { status: 400 },
    );
  }

  const quota = checkQuota(user, words);
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.error, wordsUsed: quota.wordsUsed, limit: quota.limit },
      { status: 402 },
    );
  }

  const generator = streamRewriteText(text, mode);

  // Pull the first chunk before committing to a streaming response, so
  // immediate failures (bad API key, Groq unreachable) still return a
  // normal JSON error with a real HTTP status instead of an NDJSON event —
  // once the stream starts, the 200 status is already locked in.
  let first: IteratorResult<string, void>;
  try {
    first = await generator.next();
  } catch (err) {
    console.error("Humanize stream failed to start:", err);
    return NextResponse.json(
      { error: "The rewrite service is unavailable right now. Try again in a moment." },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // If the client disconnects mid-stream (closes the tab, navigates
      // away), the platform tears down the controller and calls cancel()
      // below — but the async work here keeps running until its next
      // await. Guard every enqueue/close so a late write after teardown
      // logs nothing instead of throwing an unhandled rejection.
      let closed = false;
      const send = (obj: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          closed = true;
        }
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by the platform — nothing to do
        }
      };

      let fullText = "";
      try {
        if (!first.done && first.value) {
          fullText += first.value;
          send({ type: "delta", text: first.value });
        }
        while (true) {
          const { done, value } = await generator.next();
          if (done) break;
          fullText += value;
          send({ type: "delta", text: value });
        }

        if (!fullText.trim()) {
          send({ type: "error", error: "The rewrite came back empty. Try again." });
          return;
        }

        const metrics = await estimateMetrics(text, fullText);
        const title = text.split(/\s+/).slice(0, 6).join(" ") + (words > 6 ? "…" : "");

        const [document] = await prisma.$transaction([
          prisma.document.create({
            data: { userId: user.id, title, originalText: text, improvedText: fullText, mode, metrics },
          }),
          prisma.user.update({
            where: { id: user.id },
            data: { wordsUsed: quota.wordsUsed + words, periodStart: quota.periodStart },
          }),
        ]);
        logActivity(user.id, "HUMANIZE", `${mode} · ${words} words`);

        send({
          type: "done",
          documentId: document.id,
          metrics,
          wordsUsed: quota.wordsUsed + words,
          limit: quota.limit,
        });
      } catch (err) {
        console.error("Streaming humanize failed mid-stream:", err);
        send({ type: "error", error: "Something went wrong while generating. Try again." });
      } finally {
        safeClose();
      }
    },
    cancel() {
      // Client disconnected. The generator will simply finish naturally on
      // its next await; send()/safeClose() above already no-op afterward.
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
