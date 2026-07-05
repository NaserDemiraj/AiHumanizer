import { NextResponse } from "next/server";
import { streamChat, type ChatMessage } from "@/app/lib/llm";
import { buildKnowledgeBase, CHAT_SYSTEM_PROMPT } from "@/app/lib/chatKnowledge";
import { rateLimit, clientIp } from "@/app/lib/ratelimit";

const MAX_TURNS = 12; // user+assistant messages kept from the client
const MAX_CHARS_PER_MESSAGE = 1_000;

/**
 * Public help-assistant chat. Open to anonymous visitors, so it's guarded on
 * three fronts: per-IP rate limiting, a hard message-length cap, and a tightly
 * scoped system prompt that keeps it on-topic (see chatKnowledge). Responds
 * with newline-delimited JSON events:
 *   {"type":"delta","text":"..."}   — zero or more
 *   {"type":"done"}                 — at the end
 *   {"type":"error","error":"..."}  — on failure
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = await rateLimit("chat", ip, 20, 60); // 20 messages / minute / IP
  if (!limit.success) {
    return NextResponse.json(
      { error: "You're sending messages too quickly. Give it a moment." },
      { status: 429 },
    );
  }
  const daily = await rateLimit("chat-daily", ip, 200, 24 * 60 * 60);
  if (!daily.success) {
    return NextResponse.json(
      { error: "Daily chat limit reached. Please email support for more help." },
      { status: 429 },
    );
  }

  let body: { messages?: { role?: string; content?: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  // Keep only well-formed user/assistant turns, trim length, cap history
  const history: ChatMessage[] = raw
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS_PER_MESSAGE) }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Send a question to start." }, { status: 400 });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: `${CHAT_SYSTEM_PROMPT}\n\n--- FACTS ---\n${buildKnowledgeBase()}` },
    ...history,
  ];

  const generator = streamChat(messages);

  // Pull the first chunk before committing to a 200 stream, so an immediate
  // failure still returns a real error status.
  let first: IteratorResult<string, void>;
  try {
    first = await generator.next();
  } catch (err) {
    console.error("Chat stream failed to start:", err);
    return NextResponse.json(
      { error: "The assistant is unavailable right now. Try again shortly." },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (obj: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          closed = true;
        }
      };
      try {
        if (!first.done && first.value) send({ type: "delta", text: first.value });
        while (true) {
          const { done, value } = await generator.next();
          if (done) break;
          send({ type: "delta", text: value });
        }
        send({ type: "done" });
      } catch (err) {
        console.error("Chat stream failed mid-flight:", err);
        send({ type: "error", error: "Something went wrong. Try again." });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
