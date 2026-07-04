"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "./editor.css";

export default function NewDocumentLauncher() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"blank" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function createBlank() {
    setError(null);
    setPending("blank");
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn't create the document.");
        return;
      }
      router.push(`/editor/${data.id}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(null);
    }
  }

  async function uploadFile(file: File) {
    setError(null);
    setPending("upload");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn't process that file.");
        return;
      }
      router.push(`/editor/${data.id}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="hf-launcher">
      <div className="hf-launcher-heading">
        <div className="hf-eyebrow">Document editor</div>
        <h1 className="hf-h2">Start writing, or bring a document</h1>
        <p className="hf-launcher-sub">
          Upload a PDF, Word file, Markdown, or plain text — edit it, run AI tools on it, and
          export to any format.
        </p>
      </div>

      <div className="hf-launcher-options">
        <button className="hf-launcher-card" onClick={createBlank} disabled={pending !== null}>
          <span className="hf-launcher-card-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="hf-launcher-card-title">
            {pending === "blank" ? "Creating…" : "Blank document"}
          </span>
          <span className="hf-launcher-card-desc">Start from scratch in the editor</span>
        </button>

        <button
          className={`hf-launcher-card${dragging ? " hf-launcher-card-drag" : ""}`}
          onClick={() => inputRef.current?.click()}
          disabled={pending !== null}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) uploadFile(file);
          }}
        >
          <span className="hf-launcher-card-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 8l5-5 5 5M5 21h14" />
            </svg>
          </span>
          <span className="hf-launcher-card-title">
            {pending === "upload" ? "Reading file…" : "Upload a document"}
          </span>
          <span className="hf-launcher-card-desc">
            PDF · DOCX · DOC · RTF · ODT · TXT · MD · images &amp; scans (OCR) — drop it here or
            click to browse
          </span>
        </button>
      </div>

      {error && <div className="hf-launcher-error">{error}</div>}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.rtf,.odt,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp"
        className="hf-upload-input-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) uploadFile(file);
        }}
      />
    </main>
  );
}
