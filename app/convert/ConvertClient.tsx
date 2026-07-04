"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import "../components/LiveEditor.css";
import "../editor/editor.css";
import "./convert.css";

const TARGETS = [
  { id: "pdf", label: "PDF" },
  { id: "docx", label: "Word (DOCX)" },
  { id: "txt", label: "Plain text (TXT)" },
  { id: "md", label: "Markdown (MD)" },
];

export default function ConvertClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState("pdf");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function convert() {
    if (!file) return;
    setError(null);
    setNeedsAuth(false);
    setPending(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target", target);
      const res = await fetch("/api/convert", { method: "POST", body: formData });
      if (res.status === 401) {
        setNeedsAuth(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Conversion failed. Try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `converted.${target}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="hf-launcher">
      <div className="hf-launcher-heading">
        <div className="hf-eyebrow">File converter</div>
        <h1 className="hf-h2">Convert documents between formats</h1>
        <p className="hf-launcher-sub">
          PDF, DOCX, DOC, RTF, ODT, TXT, and Markdown in — PDF, DOCX, TXT, or Markdown out.
          Content and structure carry over; no AI involved, no word credits used. Want to edit
          before converting? <Link href="/editor" style={{ color: "var(--accent)", fontWeight: 600 }}>Open the editor</Link> instead.
        </p>
      </div>

      <div
        className={`hf-launcher-card${dragging ? " hf-launcher-card-drag" : ""}`}
        style={{ cursor: "pointer" }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
        role="button"
        tabIndex={0}
      >
        <span className="hf-launcher-card-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9a8 8 0 0 1 14-4l2 2 M20 15a8 8 0 0 1-14 4l-2-2 M18 3v4h-4 M6 21v-4h4" />
          </svg>
        </span>
        <span className="hf-launcher-card-title">{file ? file.name : "Choose a file"}</span>
        <span className="hf-launcher-card-desc">
          {file
            ? `${(file.size / 1024).toFixed(0)} KB — click to pick a different file`
            : "Drop it here or click to browse"}
        </span>
      </div>

      <div className="hf-convert-controls">
        <label className="hf-convert-label" htmlFor="target">
          Convert to
        </label>
        <select
          id="target"
          className="hf-editor-mode-select"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          {TARGETS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          className="hf-editor-run"
          type="button"
          onClick={() => void convert()}
          disabled={!file || pending}
        >
          {pending ? "Converting…" : "Convert & download"}
        </button>
      </div>

      {needsAuth && (
        <div className="hf-launcher-error">
          <Link href="/signup" style={{ fontWeight: 700 }}>Create a free account</Link> or{" "}
          <Link href="/login" style={{ fontWeight: 700 }}>sign in</Link> to convert files.
        </div>
      )}
      {error && <div className="hf-launcher-error">{error}</div>}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.rtf,.odt,.txt,.md,.markdown"
        className="hf-upload-input-hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) setFile(f);
        }}
      />
    </main>
  );
}
