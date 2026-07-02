"use client";

import { useState } from "react";
import Link from "next/link";
import { metricDefs, MetricColorKey, modeNames } from "../lib/content";
import "./LiveEditor.css";

const colorMap: Record<MetricColorKey, string> = {
  green: "#12A150",
  red: "#E5484D",
  accent: "var(--accent)",
};

type ApiMetrics = {
  humanScore: number;
  aiDetection: number;
  plagiarism: number;
  grammar: number;
  readability: number;
  seoScore: number;
};

const METRIC_KEYS: Record<string, keyof ApiMetrics> = {
  "Human Score": "humanScore",
  "AI Detection": "aiDetection",
  Plagiarism: "plagiarism",
  Grammar: "grammar",
  Readability: "readability",
  "SEO Score": "seoScore",
};

const SAMPLE_TEXT =
  "In today's fast-paced landscape, leveraging artificial intelligence is a paramount consideration for organizations seeking to optimize operational efficiencies and maximize stakeholder value in a synergistic manner.";

const MODE_TONES: Record<string, string> = {
  Humanize: "Natural",
  Academic: "Scholarly",
  Professional: "Polished",
  Business: "Direct",
  "SEO Optimized": "Focused",
  Blog: "Conversational",
  Email: "Courteous",
  "Social Media": "Punchy",
  "Native English": "Fluent",
  Simplify: "Plain",
  Formal: "Formal",
  Friendly: "Warm",
  Persuasive: "Confident",
  Creative: "Vivid",
};

const IMPROVED_PLACEHOLDER =
  "Click “Humanize” to rewrite your text into natural, human writing — and watch every score update live.";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function LiveEditor() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [mode, setMode] = useState("Humanize");
  const [improved, setImproved] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ApiMetrics | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const done = improved !== null;
  const words = countWords(text);

  async function runHumanize() {
    setError(null);
    setNeedsAuth(false);
    setPending(true);
    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setNeedsAuth(true);
      } else if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.");
      } else {
        setImproved(data.improvedText);
        setMetrics(data.metrics);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setText(SAMPLE_TEXT);
    setImproved(null);
    setMetrics(null);
    setError(null);
    setNeedsAuth(false);
  }

  const rows = metricDefs.map((m) => {
    const value = done && metrics ? metrics[METRIC_KEYS[m.label]] : m.before;
    return { label: m.label, value, color: colorMap[m.colorKey] };
  });

  return (
    <section id="editor" className="hf-editor-section">
      <div className="hf-editor-heading">
        <div className="hf-eyebrow">Live editor</div>
        <h2 className="hf-h2">See it work in real time</h2>
        <p className="hf-editor-sub">
          Paste your own text, pick a mode, and watch it transform — every metric updates live.
        </p>
      </div>

      <div className="hf-editor-card">
        <div className="hf-editor-toolbar">
          <div className="hf-editor-doc-name">
            <span className="hf-editor-doc-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16M4 20l2-6 9-9a2.8 2.8 0 0 1 4 4l-9 9z" />
              </svg>
            </span>
            Untitled document
          </div>
          <div className="hf-editor-toolbar-actions">
            <select
              className="hf-editor-mode-select"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              aria-label="Rewrite mode"
            >
              {modeNames.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button onClick={reset} className="hf-editor-reset">
              Reset
            </button>
            <button onClick={runHumanize} className="hf-editor-run" disabled={pending || !text.trim()}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={pending ? { animation: "hf-spin 1s linear infinite" } : undefined}
              >
                <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4z" />
              </svg>
              {pending ? "Humanizing…" : "Humanize"}
            </button>
          </div>
        </div>

        <div className="hf-editor-panes">
          <div className="hf-editor-pane hf-editor-pane-original">
            <div className="hf-editor-pane-header">
              <span className="hf-editor-pane-label">Your text</span>
              <span className="hf-editor-pane-badge-ai">Original</span>
            </div>
            <textarea
              className="hf-editor-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type the text you want to humanize…"
              rows={6}
            />
          </div>
          <div
            className="hf-editor-pane hf-editor-pane-improved"
            style={{ background: done ? "#F0FBF4" : "#FBFCFE" }}
          >
            <div className="hf-editor-pane-header">
              <span className="hf-editor-pane-label">Improved text</span>
              <span
                className="hf-editor-pane-badge"
                style={{
                  color: done ? "#12A150" : "#8A94A6",
                  background: done ? "#EAF7EF" : "#F1F3F8",
                }}
              >
                {done ? "Human" : "Awaiting"}
              </span>
            </div>
            {needsAuth ? (
              <p className="hf-editor-pane-text-improved">
                <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 700 }}>
                  Create a free account
                </Link>{" "}
                (or{" "}
                <Link href="/login" style={{ color: "var(--accent)", fontWeight: 700 }}>
                  sign in
                </Link>
                ) to humanize your text — 2,000 free words a month.
              </p>
            ) : error ? (
              <p className="hf-editor-pane-text-improved" style={{ color: "#B3261E", opacity: 1 }}>
                {error}
              </p>
            ) : (
              <p className="hf-editor-pane-text-improved" style={{ opacity: done ? 1 : 0.55 }}>
                {improved ?? IMPROVED_PLACEHOLDER}
              </p>
            )}
          </div>
        </div>

        <div className="hf-editor-metrics">
          <div className="hf-editor-metrics-grid">
            {rows.map((m) => (
              <div key={m.label}>
                <div className="hf-editor-metric-row">
                  <span className="hf-editor-metric-label">{m.label}</span>
                  <span className="hf-editor-metric-value" style={{ color: m.color }}>
                    {m.value}%
                  </span>
                </div>
                <div className="hf-editor-metric-track">
                  <div
                    className="hf-editor-metric-fill"
                    style={{ width: `${m.value}%`, background: m.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="hf-editor-metrics-footer">
            <div className="hf-editor-metrics-footer-item">
              <span className="hf-editor-metrics-footer-label">Words</span>
              <span className="hf-editor-metrics-footer-value">{words}</span>
            </div>
            <div className="hf-editor-metrics-footer-item">
              <span className="hf-editor-metrics-footer-label">Characters</span>
              <span className="hf-editor-metrics-footer-value">{text.length.toLocaleString()}</span>
            </div>
            <div className="hf-editor-metrics-footer-item">
              <span className="hf-editor-metrics-footer-label">Reading time</span>
              <span className="hf-editor-metrics-footer-value">
                {Math.max(1, Math.ceil(words / 200))} min
              </span>
            </div>
            <div className="hf-editor-metrics-footer-item">
              <span className="hf-editor-metrics-footer-label">Tone</span>
              <span className="hf-editor-metrics-footer-value hf-editor-metrics-footer-value-accent">
                {done ? (MODE_TONES[mode] ?? "Natural") : "Corporate"}
              </span>
            </div>
            <div className="hf-editor-metrics-footer-item">
              <span className="hf-editor-metrics-footer-label">Mode</span>
              <span className="hf-editor-metrics-footer-value hf-editor-metrics-footer-value-accent">
                {mode}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
