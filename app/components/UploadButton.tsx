"use client";

import { useRef, useState } from "react";

type Props = {
  onExtracted: (text: string) => void;
  onError: (message: string) => void;
  className?: string;
};

export default function UploadButton({ onExtracted, onError, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function handleFile(file: File) {
    setPending(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        onError(data?.error ?? "Couldn't process that file.");
        return;
      }
      onExtracted(data.text);
      if (data.truncated) {
        onError("File was longer than 3,000 words — truncated to fit the per-request limit.");
      }
    } catch {
      onError("Network error while uploading. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.docx,.pdf"
        className="hf-upload-input-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        className={className}
        onClick={() => inputRef.current?.click()}
        disabled={pending}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M7 8l5-5 5 5M5 21h14" />
        </svg>
        {pending ? "Reading…" : "Upload"}
      </button>
    </>
  );
}
