"use client";

import { useState } from "react";
import Link from "next/link";
import { TRANSLATE_LANGUAGES, CITATION_STYLES, TONE_OPTIONS } from "../lib/content";
import "../components/LiveEditor.css";
import "./tools.css";

type ToolDef = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  placeholder: string;
  free?: boolean;
  options?: { key: string; label: string; values: string[] };
};

const TOOLS: ToolDef[] = [
  {
    id: "detect",
    name: "AI Detector",
    desc: "Score how likely a text is AI-generated",
    icon: "M12 3l7 3v5c0 4-3 6.6-7 8-4-1.4-7-4-7-8V6z M9 12l2 2 4-4",
    placeholder: "Paste the text you want to check for AI generation…",
  },
  {
    id: "grammar",
    name: "Grammar Checker",
    desc: "Fix grammar, spelling, and punctuation",
    icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12l2.5 2.5L16 9",
    placeholder: "Paste text to check for grammar and spelling errors…",
  },
  {
    id: "paraphrase",
    name: "Paraphraser",
    desc: "Reword text while keeping the meaning",
    icon: "M4 9a8 8 0 0 1 14-4l2 2 M20 15a8 8 0 0 1-14 4l-2-2 M18 3v4h-4 M6 21v-4h4",
    placeholder: "Paste the text you want to paraphrase…",
  },
  {
    id: "summarize",
    name: "Summarizer",
    desc: "Condense long text into key points",
    icon: "M4 6h16 M4 12h16 M4 18h9",
    placeholder: "Paste a long text to summarize…",
    options: { key: "length", label: "Length", values: ["short", "medium", "bullets"] },
  },
  {
    id: "translate",
    name: "Translator",
    desc: "Translate into 30+ languages",
    icon: "M4 8h9 M17 8h3 M4 16h3 M11 16h9 M15 6v4 M9 14v4",
    placeholder: "Paste the text you want to translate…",
    options: { key: "targetLang", label: "Language", values: TRANSLATE_LANGUAGES },
  },
  {
    id: "tone",
    name: "Tone Changer",
    desc: "Shift formal, friendly, persuasive & more",
    icon: "M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4z",
    placeholder: "Paste text and pick the tone you want…",
    options: { key: "tone", label: "Tone", values: TONE_OPTIONS },
  },
  {
    id: "citation",
    name: "Citation Generator",
    desc: "Format sources in APA, MLA & more",
    icon: "M4 6a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2z M20 6a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z",
    placeholder:
      "Describe your source — e.g. \"Atomic Habits by James Clear, Avery, 2018\" or a website URL with author and date…",
    options: { key: "style", label: "Style", values: CITATION_STYLES },
  },
  {
    id: "plagiarism",
    name: "Plagiarism Checker",
    desc: "Estimate originality of your text",
    icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3",
    placeholder: "Paste text to estimate its originality…",
  },
  {
    id: "analyze",
    name: "Text Analyzer",
    desc: "Word count, readability, keywords, SEO — free",
    icon: "M3 17l6-6 4 4 8-8 M15 7h6v6",
    placeholder: "Paste text to analyze readability, keywords, and SEO…",
    free: true,
  },
];

type AnalyzeResult = {
  stats: {
    words: number;
    characters: number;
    charactersNoSpaces: number;
    sentences: number;
    readingTimeMin: number;
  };
  readability: number;
  keywords: { keyword: string; count: number; density: number }[];
  seoScore: number;
};

type ToolExtra = {
  aiProbability?: number;
  humanScore?: number;
  signals?: string[];
  fixes?: string[];
  originalityScore?: number;
};

export default function ToolsWorkspace() {
  const [active, setActive] = useState<ToolDef>(TOOLS[0]);
  const [text, setText] = useState("");
  const [option, setOption] = useState<string>("");
  const [output, setOutput] = useState<string | null>(null);
  const [extra, setExtra] = useState<ToolExtra | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [copied, setCopied] = useState(false);

  function selectTool(tool: ToolDef) {
    setActive(tool);
    setOutput(null);
    setExtra(null);
    setAnalysis(null);
    setError(null);
    setNeedsAuth(false);
    setOption(tool.options?.values[0] ?? "");
  }

  async function run() {
    setError(null);
    setNeedsAuth(false);
    setOutput(null);
    setExtra(null);
    setAnalysis(null);
    setPending(true);
    try {
      const options: Record<string, string> = {};
      if (active.options && option) options[active.options.key] = option;

      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: active.id, text, options }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setNeedsAuth(true);
      } else if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.");
      } else if (active.id === "analyze") {
        setAnalysis(data);
      } else {
        setOutput(data.output);
        setExtra(data.extra);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const meterValue =
    extra?.aiProbability !== undefined
      ? extra.aiProbability
      : extra?.originalityScore !== undefined
        ? extra.originalityScore
        : null;
  const meterLabel =
    extra?.aiProbability !== undefined ? "AI probability" : "Originality";
  const meterColor =
    extra?.aiProbability !== undefined
      ? extra.aiProbability >= 50
        ? "#E5484D"
        : "#12A150"
      : "#12A150";

  return (
    <main className="hf-tools-main">
      <div className="hf-tools-heading">
        <div className="hf-eyebrow">Writing tools</div>
        <h1 className="hf-h2">Every tool your writing needs</h1>
        <p className="hf-tools-sub">
          Nine tools, one workspace. Runs are saved to your dashboard automatically.
        </p>
      </div>

      <div className="hf-tools-layout">
        <aside className="hf-tools-sidebar">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={`hf-tools-item${tool.id === active.id ? " hf-tools-item-active" : ""}`}
              onClick={() => selectTool(tool)}
            >
              <span className="hf-tools-item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d={tool.icon} />
                </svg>
              </span>
              <span className="hf-tools-item-text">
                <span className="hf-tools-item-name">
                  {tool.name}
                  {tool.free && <span className="hf-tools-free-badge">Free</span>}
                </span>
                <span className="hf-tools-item-desc">{tool.desc}</span>
              </span>
            </button>
          ))}
        </aside>

        <div className="hf-tools-panel">
          <div className="hf-tools-toolbar">
            <div className="hf-tools-toolbar-title">{active.name}</div>
            <div className="hf-tools-toolbar-actions">
              {active.options && (
                <select
                  className="hf-editor-mode-select"
                  value={option || active.options.values[0]}
                  onChange={(e) => setOption(e.target.value)}
                  aria-label={active.options.label}
                >
                  {active.options.values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              )}
              <button className="hf-editor-run" onClick={run} disabled={pending || !text.trim()}>
                {pending ? "Working…" : "Run"}
              </button>
            </div>
          </div>

          <textarea
            className="hf-tools-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={active.placeholder}
            rows={7}
          />

          {(output || analysis || error || needsAuth) && (
            <div className="hf-tools-output">
              {needsAuth ? (
                <p className="hf-tools-note">
                  <Link href="/signup">Create a free account</Link> or{" "}
                  <Link href="/login">sign in</Link> to use the writing tools.
                </p>
              ) : error ? (
                <p className="hf-tools-error">{error}</p>
              ) : analysis ? (
                <div className="hf-tools-analysis">
                  <div className="hf-tools-stats-grid">
                    <div className="hf-tools-stat"><span>Words</span><strong>{analysis.stats.words.toLocaleString()}</strong></div>
                    <div className="hf-tools-stat"><span>Characters</span><strong>{analysis.stats.characters.toLocaleString()}</strong></div>
                    <div className="hf-tools-stat"><span>No spaces</span><strong>{analysis.stats.charactersNoSpaces.toLocaleString()}</strong></div>
                    <div className="hf-tools-stat"><span>Sentences</span><strong>{analysis.stats.sentences}</strong></div>
                    <div className="hf-tools-stat"><span>Reading time</span><strong>{analysis.stats.readingTimeMin} min</strong></div>
                    <div className="hf-tools-stat"><span>Readability</span><strong>{analysis.readability}/100</strong></div>
                    <div className="hf-tools-stat"><span>SEO score</span><strong>{analysis.seoScore}/100</strong></div>
                  </div>
                  {analysis.keywords.length > 0 && (
                    <div className="hf-tools-keywords">
                      <div className="hf-tools-keywords-title">Top keywords</div>
                      {analysis.keywords.map((k) => (
                        <div key={k.keyword} className="hf-tools-keyword-row">
                          <span className="hf-tools-keyword">{k.keyword}</span>
                          <span className="hf-tools-keyword-count">×{k.count}</span>
                          <div className="hf-tools-keyword-bar">
                            <div style={{ width: `${Math.min(100, k.density * 12)}%` }} />
                          </div>
                          <span className="hf-tools-keyword-density">{k.density}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {meterValue !== null && (
                    <div className="hf-tools-meter">
                      <div className="hf-tools-meter-row">
                        <span>{meterLabel}</span>
                        <strong style={{ color: meterColor }}>{meterValue}%</strong>
                      </div>
                      <div className="hf-editor-metric-track">
                        <div
                          className="hf-editor-metric-fill"
                          style={{ width: `${meterValue}%`, background: meterColor }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="hf-tools-result">
                    <p>{output}</p>
                    <button className="hf-tools-copy" onClick={copyOutput}>
                      {copied ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                  {extra?.signals && extra.signals.length > 0 && (
                    <ul className="hf-tools-list">
                      {extra.signals.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                  {extra?.fixes && extra.fixes.length > 0 && (
                    <ul className="hf-tools-list">
                      {extra.fixes.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
