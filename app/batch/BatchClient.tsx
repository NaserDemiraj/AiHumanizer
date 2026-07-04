"use client";

import { useRef, useState } from "react";
import { modeNames } from "../lib/content";
import "../components/LiveEditor.css";
import "../editor/editor.css";
import "./batch.css";

const MAX_FILES = 5;

type FileJob = {
  file: File;
  status: "queued" | "uploading" | "processing" | "done" | "error";
  error?: string;
  documentId?: string;
};

/**
 * Client-orchestrated batch: files are processed one at a time to stay
 * inside API rate limits. A server-side queue takes over when the app
 * gets a worker deployment.
 */
export default function BatchClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [op, setOp] = useState("Humanize");
  const [format, setFormat] = useState("docx");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(files: FileList | File[]) {
    setError(null);
    const incoming = Array.from(files);
    setJobs((prev) => {
      const room = MAX_FILES - prev.length;
      if (incoming.length > room) {
        setError(`Batch is capped at ${MAX_FILES} files for now — extra files were skipped.`);
      }
      return [
        ...prev,
        ...incoming.slice(0, Math.max(0, room)).map((file) => ({ file, status: "queued" as const })),
      ];
    });
  }

  function updateJob(index: number, patch: Partial<FileJob>) {
    setJobs((prev) => prev.map((j, i) => (i === index ? { ...j, ...patch } : j)));
  }

  async function run() {
    setRunning(true);
    setError(null);
    const documentIds: string[] = [];

    for (let i = 0; i < jobs.length; i++) {
      if (jobs[i].status === "done" && jobs[i].documentId) {
        documentIds.push(jobs[i].documentId!);
        continue;
      }
      try {
        updateJob(i, { status: "uploading", error: undefined });
        const formData = new FormData();
        formData.append("file", jobs[i].file);
        const createRes = await fetch("/api/documents", { method: "POST", body: formData });
        const created = await createRes.json().catch(() => null);
        if (!createRes.ok) {
          updateJob(i, { status: "error", error: created?.error ?? "Upload failed" });
          continue;
        }

        updateJob(i, { status: "processing", documentId: created.id });
        const docRes = await fetch(`/api/documents/${created.id}`);
        const doc = await docRes.json().catch(() => null);
        const text = doc?.improvedText || doc?.originalText;
        if (!text?.trim()) {
          updateJob(i, { status: "error", error: "No readable text in this file" });
          continue;
        }

        const aiRes = await fetch(`/api/documents/${created.id}/ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.slice(0, 100_000),
            steps: [{ op }],
            apply: true,
          }),
        });
        const aiData = await aiRes.json().catch(() => null);
        if (!aiRes.ok) {
          updateJob(i, { status: "error", error: aiData?.error ?? "AI processing failed" });
          continue;
        }

        documentIds.push(created.id);
        updateJob(i, { status: "done" });
      } catch {
        updateJob(i, { status: "error", error: "Network error" });
      }
    }

    if (documentIds.length > 0) {
      try {
        const zipRes = await fetch("/api/batch/zip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentIds, format }),
        });
        if (zipRes.ok) {
          const blob = await zipRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "humanflow-batch.zip";
          a.click();
          URL.revokeObjectURL(url);
        } else {
          const data = await zipRes.json().catch(() => null);
          setError(data?.error ?? "ZIP download failed — the documents are still on your dashboard.");
        }
      } catch {
        setError("ZIP download failed — the documents are still on your dashboard.");
      }
    }
    setRunning(false);
  }

  const doneCount = jobs.filter((j) => j.status === "done").length;

  return (
    <main className="hf-launcher">
      <div className="hf-launcher-heading">
        <div className="hf-eyebrow">Batch processing</div>
        <h1 className="hf-h2">Process multiple documents at once</h1>
        <p className="hf-launcher-sub">
          Upload up to {MAX_FILES} files, apply one AI operation to all of them, and download the
          results as a ZIP. Files are processed one at a time to respect rate limits.
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
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
      >
        <span className="hf-launcher-card-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M7 8l5-5 5 5M5 21h14" />
          </svg>
        </span>
        <span className="hf-launcher-card-title">
          {jobs.length > 0 ? `${jobs.length}/${MAX_FILES} files added` : "Add files"}
        </span>
        <span className="hf-launcher-card-desc">PDF · DOCX · DOC · RTF · ODT · TXT · MD</span>
      </div>

      {jobs.length > 0 && (
        <div className="hf-batch-list">
          {jobs.map((job, i) => (
            <div key={i} className="hf-batch-row">
              <span className="hf-batch-name">{job.file.name}</span>
              <span className={`hf-batch-status hf-batch-status-${job.status}`}>
                {job.status === "queued" && "Queued"}
                {job.status === "uploading" && "Uploading…"}
                {job.status === "processing" && "Processing…"}
                {job.status === "done" && "Done ✓"}
                {job.status === "error" && (job.error ?? "Failed")}
              </span>
              {!running && (
                <button
                  className="hf-batch-remove"
                  type="button"
                  onClick={() => setJobs(jobs.filter((_, j) => j !== i))}
                  aria-label={`Remove ${job.file.name}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="hf-convert-controls">
        <label className="hf-convert-label">Operation</label>
        <select className="hf-editor-mode-select" value={op} onChange={(e) => setOp(e.target.value)}>
          {modeNames.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value="grammar">Fix Grammar</option>
          <option value="paraphrase">Paraphrase</option>
          <option value="summarize">Summarize</option>
        </select>
        <label className="hf-convert-label">Download as</label>
        <select className="hf-editor-mode-select" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="docx">DOCX</option>
          <option value="pdf">PDF</option>
          <option value="txt">TXT</option>
          <option value="md">Markdown</option>
        </select>
        <button
          className="hf-editor-run"
          type="button"
          onClick={() => void run()}
          disabled={running || jobs.length === 0}
        >
          {running ? `Processing… (${doneCount}/${jobs.length})` : "Run batch & download ZIP"}
        </button>
      </div>

      {error && <div className="hf-launcher-error">{error}</div>}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.rtf,.odt,.txt,.md,.markdown"
        className="hf-upload-input-hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </main>
  );
}
