"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export default function ApiKeysCard({ keys }: { keys: ApiKeyRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || "API key" }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.secret) setNewSecret(data.secret);
    setName("");
    setPending(false);
    router.refresh();
  }

  async function deleteKey(id: string) {
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function copySecret() {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="hf-dash-card" id="api-keys">
      <div className="hf-dashboard-docs-header">API keys</div>
      <div className="hf-dash-card-body">
        <p className="hf-dash-card-empty" style={{ textAlign: "left" }}>
          Use the HumanFlow API programmatically:{" "}
          <code className="hf-dash-code">POST /api/v1/humanize</code> with{" "}
          <code className="hf-dash-code">Authorization: Bearer &lt;key&gt;</code>
        </p>

        {newSecret && (
          <div className="hf-dash-secret">
            <div className="hf-dash-secret-note">
              Copy this key now — it won&apos;t be shown again:
            </div>
            <div className="hf-dash-secret-row">
              <code className="hf-dash-secret-value">{newSecret}</code>
              <button className="hf-dash-small-btn" onClick={copySecret}>
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {keys.map((k) => (
          <div key={k.id} className="hf-dash-project-row">
            <span className="hf-dash-project-name">
              🔑 {k.name} <code className="hf-dash-code">{k.prefix}…</code>
            </span>
            <span className="hf-dash-project-count">
              {k.lastUsedAt ? `used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}
            </span>
            <button
              className="hf-dash-doc-delete"
              onClick={() => deleteKey(k.id)}
              aria-label={`Revoke key ${k.name}`}
              title="Revoke key"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
              </svg>
            </button>
          </div>
        ))}

        <form onSubmit={createKey} className="hf-dash-project-form">
          <input
            className="hf-dash-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name (e.g. production)…"
            maxLength={60}
          />
          <button className="hf-dash-small-btn" type="submit" disabled={pending}>
            Create key
          </button>
        </form>
      </div>
    </div>
  );
}
