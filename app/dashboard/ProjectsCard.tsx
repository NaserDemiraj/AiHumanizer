"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Project = { id: string; name: string; count: number };

export default function ProjectsCard({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    setPending(false);
    router.refresh();
  }

  async function deleteProject(id: string) {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="hf-dash-card">
      <div className="hf-dashboard-docs-header">Projects</div>
      <div className="hf-dash-card-body">
        {projects.length === 0 && (
          <p className="hf-dash-card-empty">Group documents into projects.</p>
        )}
        {projects.map((p) => (
          <div key={p.id} className="hf-dash-project-row">
            <span className="hf-dash-project-name">📁 {p.name}</span>
            <span className="hf-dash-project-count">{p.count} docs</span>
            <button
              className="hf-dash-doc-delete"
              onClick={() => deleteProject(p.id)}
              aria-label={`Delete project ${p.name}`}
              title="Delete project"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
              </svg>
            </button>
          </div>
        ))}
        <form onSubmit={createProject} className="hf-dash-project-form">
          <input
            className="hf-dash-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name…"
            maxLength={80}
          />
          <button className="hf-dash-small-btn" type="submit" disabled={pending || !name.trim()}>
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
