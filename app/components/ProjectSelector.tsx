"use client";

import { useState } from "react";
import "./ProjectSelector.css";

type Project = { id: string; name: string };

export default function ProjectSelector({
  docId,
  projects,
  current,
  compact,
}: {
  docId: string;
  projects: Project[];
  current: string | null;
  compact?: boolean;
}) {
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);

  async function assign(projectId: string) {
    setValue(projectId);
    setSaving(true);
    try {
      await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectId || null }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (projects.length === 0) return null;

  return (
    <label className={`hf-projsel${compact ? " hf-projsel-compact" : ""}`}>
      {!compact && <span className="hf-projsel-label">Project</span>}
      <select
        className="hf-projsel-select"
        value={value}
        onChange={(e) => assign(e.target.value)}
        disabled={saving}
        aria-label="Assign to project"
      >
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
