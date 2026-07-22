"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder, CharacterCount } from "@tiptap/extensions";
import { diffWords, type Change } from "diff";
import { textStats, fleschReadingEase } from "../../lib/metrics";
import { TRANSLATE_LANGUAGES, TONE_OPTIONS } from "../../lib/content";
import ProjectSelector from "../../components/ProjectSelector";
import "../../components/LiveEditor.css";
import "../../dashboard/dashboard.css";
import "../editor.css";

function ToolBtn({
  active,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      className={`hf-ed-tbtn${active ? " hf-ed-tbtn-on" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      type="button"
    >
      {children}
    </button>
  );
}

type Props = {
  docId: string;
  initialTitle: string;
  initialHtml: string;
  sourceFormat: string | null;
  projects: { id: string; name: string }[];
  currentProjectId: string | null;
};

type VersionMeta = { id: string; label: string; op: string; createdAt: string };

type AiOp = { id: string; label: string; kind: "mode" | "tool"; options?: string[] };

const AI_OPS: AiOp[] = [
  { id: "Humanize", label: "Humanize", kind: "mode" },
  { id: "paraphrase", label: "Smart Rewrite", kind: "tool" },
  { id: "grammar", label: "Fix Grammar & Spelling", kind: "tool" },
  { id: "tone", label: "Change Tone", kind: "tool", options: TONE_OPTIONS },
  { id: "summarize", label: "Summarize", kind: "tool", options: ["short", "medium", "bullets"] },
  { id: "translate", label: "Translate", kind: "tool", options: TRANSLATE_LANGUAGES },
  { id: "SEO Optimized", label: "SEO Optimize", kind: "mode" },
  { id: "Simplify", label: "Improve Readability", kind: "mode" },
  { id: "Native English", label: "Native English Rewrite", kind: "mode" },
  { id: "Professional", label: "Professional Rewrite", kind: "mode" },
  { id: "Creative", label: "Creative Rewrite", kind: "mode" },
];

type ChainStep = { op: string; option?: string; label: string };

export default function EditorWorkspace({
  docId,
  initialTitle,
  initialHtml,
  sourceFormat,
  projects,
  currentProjectId,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [stats, setStats] = useState(() => ({ ...textStats(""), readability: 0 }));
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [findCount, setFindCount] = useState<number | null>(null);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [selectedOp, setSelectedOp] = useState<AiOp>(AI_OPS[0]);
  const [opOption, setOpOption] = useState<string>("");
  const [chain, setChain] = useState<ChainStep[]>([]);
  const [aiPending, setAiPending] = useState(false);
  const [preservePending, setPreservePending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    before: string;
    after: string;
    changes: Change[];
    accepted: boolean[];
    scope: "selection" | "document";
    selFrom: number;
    selTo: number;
    opLabel: string;
    detectors: { provider: string; aiProbability: number; passed: boolean }[];
  } | null>(null);
  const [compare, setCompare] = useState<{ label: string; changes: Change[] } | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing, or paste your text…" }),
      CharacterCount,
    ],
    content: initialHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "hf-ed-prose" },
    },
    onUpdate: ({ editor }) => {
      setSaveState("dirty");
      recomputeStats(editor.getText());
      scheduleSave();
    },
    onCreate: ({ editor }) => {
      recomputeStats(editor.getText());
    },
  });

  function recomputeStats(text: string) {
    setStats({ ...textStats(text), readability: fleschReadingEase(text) });
  }

  const persist = useCallback(async () => {
    if (!editor) return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: { doc: editor.getJSON(), html: editor.getHTML() },
          text: editor.getText(),
        }),
      });
      setSaveState(res.ok ? "saved" : "dirty");
    } catch {
      setSaveState("dirty");
    }
  }, [editor, docId, title]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(), 1500);
  }, [persist]);

  function handleTitleChange(value: string) {
    setTitle(value);
    setSaveState("dirty");
    scheduleSave();
  }

  // Ctrl+F opens find, Ctrl+S forces save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setFindOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void persist();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persist]);

  async function loadVersions() {
    const res = await fetch(`/api/documents/${docId}/versions`);
    if (res.ok) setVersions(await res.json());
  }
  function toggleVersions() {
    const next = !versionsOpen;
    setVersionsOpen(next);
    if (next) void loadVersions();
  }

  // ---- find & replace (plain-text based) ----
  function runFind() {
    if (!editor || !findQuery) return;
    const text = editor.getText();
    let count = 0;
    let idx = text.indexOf(findQuery);
    while (idx !== -1) {
      count++;
      idx = text.indexOf(findQuery, idx + findQuery.length);
    }
    setFindCount(count);
  }

  function replaceAll() {
    if (!editor || !findQuery) return;
    // Walk text nodes and rebuild content with replacements, preserving marks
    const { state } = editor;
    const tr = state.tr;
    const replacements: { from: number; to: number }[] = [];
    state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      let idx = node.text.indexOf(findQuery);
      while (idx !== -1) {
        replacements.push({ from: pos + idx, to: pos + idx + findQuery.length });
        idx = node.text.indexOf(findQuery, idx + findQuery.length);
      }
    });
    // Apply from the end so earlier positions stay valid
    for (const r of replacements.reverse()) {
      tr.insertText(replaceValue, r.from, r.to);
    }
    if (replacements.length > 0) {
      editor.view.dispatch(tr);
      setFindCount(0);
    }
  }

  // ---- drag & drop file into the editor ----
  async function handleDrop(e: React.DragEvent) {
    const file = e.dataTransfer?.files?.[0];
    if (!file || !editor) return;
    e.preventDefault();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.text) {
      editor.chain().focus().insertContent(data.text).run();
    } else {
      setAiError(data?.error ?? "Couldn't read the dropped file.");
    }
  }

  // ---- AI operations ----
  function currentSteps(): ChainStep[] {
    if (chain.length > 0) return chain;
    return [
      {
        op: selectedOp.id,
        option: selectedOp.options ? opOption || selectedOp.options[0] : undefined,
        label: selectedOp.label,
      },
    ];
  }

  async function runAi() {
    if (!editor) return;
    setAiError(null);

    const { from, to, empty } = editor.state.selection;
    const scope: "selection" | "document" = empty ? "document" : "selection";
    const before = empty
      ? editor.getText()
      : editor.state.doc.textBetween(from, to, "\n");
    if (!before.trim()) {
      setAiError("Nothing to process — the document is empty.");
      return;
    }

    const steps = currentSteps();
    setAiPending(true);
    try {
      const res = await fetch(`/api/documents/${docId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: before,
          steps: steps.map(({ op, option }) => ({ op, option })),
          withMetrics: steps.length > 1,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAiError(data?.error ?? "The AI operation failed.");
        return;
      }
      const changes = diffWords(before, data.output);
      setPreview({
        before,
        after: data.output,
        changes,
        accepted: changes.map(() => true),
        scope,
        selFrom: from,
        selTo: to,
        opLabel: steps.map((s) => s.label).join(" → "),
        detectors: Array.isArray(data.metrics?.detectors) ? data.metrics.detectors : [],
      });
    } catch {
      setAiError("Network error. Try again.");
    } finally {
      setAiPending(false);
    }
  }

  function previewResult(p: NonNullable<typeof preview>): string {
    return p.changes
      .map((c, i) => {
        if (!c.added && !c.removed) return c.value; // unchanged
        if (c.added) return p.accepted[i] ? c.value : "";
        return p.accepted[i] ? "" : c.value; // removed: accepted → drop it
      })
      .join("");
  }

  async function applyPreview() {
    if (!editor || !preview) return;
    const result = previewResult(preview);

    // Snapshot the pre-change state so restore always goes backwards
    await fetch(`/api/documents/${docId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: preview.opLabel,
        label: `Before: ${preview.opLabel}`,
        text: editor.getText(),
        content: { doc: editor.getJSON(), html: editor.getHTML() },
      }),
    }).catch(() => null);

    if (preview.scope === "selection") {
      editor
        .chain()
        .focus()
        .insertContentAt({ from: preview.selFrom, to: preview.selTo }, result)
        .run();
    } else {
      const html = result
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
      editor.chain().focus().setContent(html).run();
    }
    setPreview(null);
    setSaveState("dirty");
    scheduleSave();
    if (versionsOpen) void loadVersions();
  }

  async function runPreserve() {
    setAiError(null);
    setPreservePending(true);
    try {
      const mode = selectedOp.kind === "mode" ? selectedOp.id : "Humanize";
      const res = await fetch(`/api/documents/${docId}/preserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setAiError(data?.error ?? "Preserve mode failed.");
        return;
      }
      // Stream the returned .docx to a download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "document.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setAiError("Network error. Try again.");
    } finally {
      setPreservePending(false);
    }
  }

  async function saveVersionNow() {
    if (!editor) return;
    await fetch(`/api/documents/${docId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: "manual",
        label: `Manual save`,
        text: editor.getText(),
        content: { doc: editor.getJSON(), html: editor.getHTML() },
      }),
    });
    void loadVersions();
  }

  async function restoreVersion(id: string) {
    if (!editor) return;
    const res = await fetch(`/api/documents/${docId}/versions/${id}`);
    if (!res.ok) return;
    const version = await res.json();
    const content = version.content as { html?: string } | null;
    if (content?.html) {
      editor.commands.setContent(content.html);
    } else {
      editor.commands.setContent(
        version.text.split(/\n{2,}/).map((p: string) => `<p>${p}</p>`).join(""),
      );
    }
    setSaveState("dirty");
    scheduleSave();
  }

  async function compareVersion(id: string, label: string) {
    if (!editor) return;
    const res = await fetch(`/api/documents/${docId}/versions/${id}`);
    if (!res.ok) return;
    const version = await res.json();
    setCompare({ label, changes: diffWords(version.text, editor.getText()) });
  }

  async function renameVersion(id: string) {
    const label = window.prompt("New version name:");
    if (!label?.trim()) return;
    await fetch(`/api/documents/${docId}/versions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    void loadVersions();
  }

  async function deleteVersion(id: string) {
    await fetch(`/api/documents/${docId}/versions/${id}`, { method: "DELETE" });
    void loadVersions();
  }

  if (!editor) return null;

  return (
    <div className="hf-ed-page">
      <header className="hf-ed-topbar">
        <Link href="/dashboard" className="hf-ed-back">
          ← Dashboard
        </Link>
        <input
          className="hf-ed-title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          maxLength={120}
          aria-label="Document title"
        />
        <span className={`hf-ed-savestate hf-ed-savestate-${saveState}`}>
          {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Unsaved"}
        </span>
        {sourceFormat && <span className="hf-ed-badge">from {sourceFormat.toUpperCase()}</span>}
        <div className="hf-ed-topbar-actions">
          <div className="hf-ed-export">
            Export
            <div className="hf-ed-export-menu">
              {["txt", "md", "docx", "pdf"].map((f) => (
                <a key={f} href={`/api/documents/${docId}/export?format=${f}`}>
                  {f.toUpperCase()}
                </a>
              ))}
              {sourceFormat && (
                <a href={`/api/documents/${docId}/original`}>
                  Original ({sourceFormat.toUpperCase()})
                </a>
              )}
            </div>
          </div>
          {projects.length > 0 && (
            <ProjectSelector docId={docId} projects={projects} current={currentProjectId} compact />
          )}
          <button className="hf-ed-tbtn" onClick={toggleVersions} type="button">
            Versions
          </button>
        </div>
      </header>

      <div className="hf-ed-toolbar">
        <ToolBtn label="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>↩</ToolBtn>
        <ToolBtn label="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()}>↪</ToolBtn>
        <span className="hf-ed-tsep" />
        {[1, 2, 3].map((level) => (
          <ToolBtn
            key={level}
            label={`Heading ${level}`}
            active={editor.isActive("heading", { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
          >
            H{level}
          </ToolBtn>
        ))}
        <span className="hf-ed-tsep" />
        <ToolBtn label="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolBtn>
        <ToolBtn label="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolBtn>
        <ToolBtn label="Underline (Ctrl+U)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolBtn>
        <ToolBtn label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolBtn>
        <span className="hf-ed-tsep" />
        <ToolBtn label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>•≡</ToolBtn>
        <ToolBtn label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1≡</ToolBtn>
        <ToolBtn label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolBtn>
        <ToolBtn
          label="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const url = window.prompt("Link URL:", "https://");
            if (url) editor.chain().focus().setLink({ href: url }).run();
            else editor.chain().focus().unsetLink().run();
          }}
        >
          🔗
        </ToolBtn>
        <span className="hf-ed-tsep" />
        <ToolBtn label="Find & replace (Ctrl+F)" active={findOpen} onClick={() => setFindOpen(!findOpen)}>🔍</ToolBtn>
        <ToolBtn label="Save version snapshot" onClick={() => void saveVersionNow()}>📌</ToolBtn>
      </div>

      {findOpen && (
        <div className="hf-ed-findbar">
          <input
            className="hf-dash-input"
            placeholder="Find…"
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
              setFindCount(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && runFind()}
          />
          <input
            className="hf-dash-input"
            placeholder="Replace with…"
            value={replaceValue}
            onChange={(e) => setReplaceValue(e.target.value)}
          />
          <button className="hf-dash-small-btn" onClick={runFind} type="button">
            Find
          </button>
          <button className="hf-dash-small-btn" onClick={replaceAll} type="button" disabled={!findQuery}>
            Replace all
          </button>
          {findCount !== null && <span className="hf-ed-findcount">{findCount} matches</span>}
          <button className="hf-ed-tbtn" onClick={() => setFindOpen(false)} type="button">✕</button>
        </div>
      )}

      <div className="hf-ed-body">
        <div
          className="hf-ed-editor-col"
          ref={dropRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <EditorContent editor={editor} />
        </div>

        <aside className="hf-ed-side">
          <div className="hf-ed-panel">
            <button className="hf-ed-panel-head" onClick={() => setAiOpen(!aiOpen)} type="button">
              AI tools {aiOpen ? "▾" : "▸"}
            </button>
            {aiOpen && (
              <div className="hf-ed-panel-body">
                <p className="hf-ed-hint">
                  Select text to run on a selection, or leave nothing selected to process the whole
                  document.
                </p>
                <select
                  className="hf-editor-mode-select hf-ed-full"
                  value={selectedOp.id}
                  onChange={(e) => {
                    const op = AI_OPS.find((o) => o.id === e.target.value)!;
                    setSelectedOp(op);
                    setOpOption(op.options?.[0] ?? "");
                  }}
                >
                  {AI_OPS.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.label}
                    </option>
                  ))}
                </select>
                {selectedOp.options && (
                  <select
                    className="hf-editor-mode-select hf-ed-full"
                    value={opOption || selectedOp.options[0]}
                    onChange={(e) => setOpOption(e.target.value)}
                  >
                    {selectedOp.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                )}
                <div className="hf-ed-chain-row">
                  <button
                    className="hf-dash-small-btn"
                    type="button"
                    onClick={() =>
                      setChain([
                        ...chain,
                        {
                          op: selectedOp.id,
                          option: selectedOp.options ? opOption || selectedOp.options[0] : undefined,
                          label: selectedOp.label,
                        },
                      ])
                    }
                    disabled={chain.length >= 6}
                  >
                    + Add to chain
                  </button>
                  <button className="hf-editor-run hf-ed-runbtn" onClick={() => void runAi()} disabled={aiPending} type="button">
                    {aiPending ? "Running…" : chain.length > 0 ? `Run chain (${chain.length})` : "Run"}
                  </button>
                </div>
                {chain.length > 0 && (
                  <div className="hf-ed-chain">
                    {chain.map((s, i) => (
                      <span key={i} className="hf-ed-chain-step">
                        {i + 1}. {s.label}
                        {s.option ? ` (${s.option})` : ""}
                        <button
                          type="button"
                          onClick={() => setChain(chain.filter((_, j) => j !== i))}
                          aria-label={`Remove step ${i + 1}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button className="hf-ed-chain-clear" type="button" onClick={() => setChain([])}>
                      Clear chain
                    </button>
                  </div>
                )}
                {aiError && <p className="hf-ed-error">{aiError}</p>}

                {sourceFormat === "docx" && (
                  <div className="hf-ed-preserve">
                    <div className="hf-ed-preserve-title">Preserve formatting mode</div>
                    <p className="hf-ed-hint">
                      Rewrites the text inside your original DOCX — styles, tables, images,
                      headers and footers stay exactly as uploaded. Downloads the result.
                    </p>
                    <button
                      className="hf-dash-small-btn"
                      type="button"
                      disabled={preservePending}
                      onClick={() => void runPreserve()}
                    >
                      {preservePending ? "Rewriting original…" : `${selectedOp.kind === "mode" ? selectedOp.label : "Humanize"} original DOCX`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="hf-ed-panel">
            <div className="hf-ed-panel-head">Statistics</div>
            <div className="hf-ed-panel-body hf-ed-stats">
              <div><span>Words</span><strong>{stats.words.toLocaleString()}</strong></div>
              <div><span>Characters</span><strong>{stats.characters.toLocaleString()}</strong></div>
              <div><span>No spaces</span><strong>{stats.charactersNoSpaces.toLocaleString()}</strong></div>
              <div><span>Sentences</span><strong>{stats.sentences}</strong></div>
              <div><span>Paragraphs</span><strong>{stats.paragraphs}</strong></div>
              <div><span>Reading</span><strong>{stats.readingTimeMin} min</strong></div>
              <div><span>Speaking</span><strong>{stats.speakingTimeMin} min</strong></div>
              <div><span>Readability</span><strong>{stats.readability}/100</strong></div>
            </div>
          </div>

          {versionsOpen && (
            <div className="hf-ed-panel">
              <div className="hf-ed-panel-head">Versions</div>
              <div className="hf-ed-panel-body">
                {versions.length === 0 && <p className="hf-ed-hint">No versions yet — AI changes snapshot automatically.</p>}
                {versions.map((v) => (
                  <div key={v.id} className="hf-ed-version">
                    <div className="hf-ed-version-info">
                      <span className="hf-ed-version-label">{v.label}</span>
                      <span className="hf-ed-version-time">{new Date(v.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="hf-ed-version-actions">
                      <button type="button" onClick={() => void restoreVersion(v.id)}>Restore</button>
                      <button type="button" onClick={() => void compareVersion(v.id, v.label)}>Compare</button>
                      <button type="button" onClick={() => void renameVersion(v.id)}>Rename</button>
                      <button type="button" onClick={() => void deleteVersion(v.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {preview && (
        <div className="hf-ed-modal-backdrop" role="dialog" aria-label="AI change preview">
          <div className="hf-ed-modal">
            <div className="hf-ed-modal-head">
              <strong>{preview.opLabel}</strong> — review changes (click a change to toggle it)
            </div>
            {preview.detectors.length > 0 && (
              <div className="hf-ed-detectors">
                {preview.detectors.map((d) => (
                  <span
                    key={d.provider}
                    className={`hf-ed-detector ${d.passed ? "hf-ed-detector-pass" : "hf-ed-detector-flag"}`}
                  >
                    <span className="hf-ed-detector-mark">{d.passed ? "✓" : "✕"}</span>
                    {d.passed ? `Passed ${d.provider}` : `Flagged by ${d.provider}`}
                  </span>
                ))}
              </div>
            )}
            <div className="hf-ed-diff">
              {preview.changes.map((c, i) => {
                if (!c.added && !c.removed) return <span key={i}>{c.value}</span>;
                const on = preview.accepted[i];
                return (
                  <button
                    key={i}
                    type="button"
                    className={
                      c.added
                        ? `hf-ed-diff-add${on ? "" : " hf-ed-diff-off"}`
                        : `hf-ed-diff-del${on ? "" : " hf-ed-diff-off"}`
                    }
                    title={c.added ? (on ? "Will be added — click to reject" : "Rejected") : on ? "Will be removed — click to keep" : "Kept"}
                    onClick={() => {
                      const accepted = [...preview.accepted];
                      accepted[i] = !accepted[i];
                      setPreview({ ...preview, accepted });
                    }}
                  >
                    {c.value}
                  </button>
                );
              })}
            </div>
            <div className="hf-ed-modal-actions">
              <button className="hf-editor-reset" type="button" onClick={() => setPreview(null)}>
                Reject all
              </button>
              <button
                className="hf-editor-reset"
                type="button"
                onClick={() => setPreview({ ...preview, accepted: preview.accepted.map(() => true) })}
              >
                Accept all
              </button>
              <button className="hf-editor-run" type="button" onClick={() => void applyPreview()}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {compare && (
        <div className="hf-ed-modal-backdrop" role="dialog" aria-label="Version comparison">
          <div className="hf-ed-modal">
            <div className="hf-ed-modal-head">
              Changes since <strong>{compare.label}</strong>
            </div>
            <div className="hf-ed-diff">
              {compare.changes.map((c, i) =>
                c.added ? (
                  <span key={i} className="hf-ed-diff-add">{c.value}</span>
                ) : c.removed ? (
                  <span key={i} className="hf-ed-diff-del">{c.value}</span>
                ) : (
                  <span key={i}>{c.value}</span>
                ),
              )}
            </div>
            <div className="hf-ed-modal-actions">
              <button className="hf-editor-run" type="button" onClick={() => setCompare(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
