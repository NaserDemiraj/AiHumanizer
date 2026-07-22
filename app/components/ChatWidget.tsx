"use client";

import { useEffect, useRef, useState } from "react";
import "./ChatWidget.css";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! I'm the HumanFlow assistant. Ask me about our tools, pricing, the editor, file conversion, or the API.",
};

const SUGGESTIONS = [
  "How do I humanize a PDF?",
  "What's included in the Free plan?",
  "How do I get an API key?",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    setInput("");

    const history = [...messages, { role: "user" as const, content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Drop the canned greeting from what we send the server
        body: JSON.stringify({ messages: history.filter((m) => m !== GREETING) }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: data?.error ?? "Something went wrong. Try again.",
          };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Append each streamed delta to the last (assistant) message. We derive
      // the new content from previous state rather than a mutable accumulator.
      const appendToLast = (text: string) =>
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { role: "assistant", content: last.content + text };
          return next;
        });
      const replaceLast = (text: string) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: text };
          return next;
        });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "delta"; text: string }
            | { type: "done" }
            | { type: "error"; error: string };
          if (event.type === "delta") {
            appendToLast(event.text);
          } else if (event.type === "error") {
            replaceLast(event.error);
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "Network error. Check your connection and try again.",
        };
        return next;
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        className="hf-chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close help chat" : "Open help chat"}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="hf-chat-panel" role="dialog" aria-label="HumanFlow help chat">
          <div className="hf-chat-head">
            <div className="hf-chat-head-title">
              <span className="hf-chat-dot" /> HumanFlow assistant
            </div>
            <span className="hf-chat-head-sub">Answers about the product</span>
          </div>

          <div className="hf-chat-body" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`hf-chat-msg hf-chat-msg-${m.role}`}>
                {m.content || (pending && i === messages.length - 1 ? <span className="hf-chat-typing"><i /><i /><i /></span> : "")}
              </div>
            ))}
            {messages.length === 1 && (
              <div className="hf-chat-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={pending}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="hf-chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              ref={inputRef}
              className="hf-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              maxLength={1000}
              disabled={pending}
            />
            <button className="hf-chat-send" type="submit" disabled={pending || !input.trim()} aria-label="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
