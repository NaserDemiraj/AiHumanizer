"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TagsEditor({ id, tags }: { id: string; tags: string[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState(tags);
  const [input, setInput] = useState("");

  async function save(next: string[]) {
    setCurrent(next);
    await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: next }),
    });
    router.refresh();
  }

  function addTag() {
    const tag = input.trim().toLowerCase();
    setInput("");
    if (!tag || current.includes(tag) || current.length >= 20) return;
    void save([...current, tag]);
  }

  return (
    <div className="hf-doc-tags">
      {current.map((tag) => (
        <span key={tag} className="hf-doc-tag">
          #{tag}
          <button
            type="button"
            onClick={() => void save(current.filter((t) => t !== tag))}
            aria-label={`Remove tag ${tag}`}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        className="hf-doc-tag-input"
        value={input}
        placeholder="+ tag"
        maxLength={30}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag();
          }
        }}
        onBlur={addTag}
      />
    </div>
  );
}
