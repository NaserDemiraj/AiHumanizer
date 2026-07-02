import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "../../lib/db";
import { getCurrentUser } from "../../lib/auth";
import Nav from "../../components/Nav";
import { FavoriteToggle, DeleteDocInline } from "./DocActions";
import "../../page.css";
import "./document.css";

export const metadata: Metadata = {
  title: "Document — HumanFlow",
};

const KIND_LABELS: Record<string, string> = {
  humanize: "Humanized",
  detect: "AI Detection",
  grammar: "Grammar Check",
  paraphrase: "Paraphrased",
  summarize: "Summary",
  translate: "Translation",
  tone: "Tone Change",
  citation: "Citation",
  plagiarism: "Plagiarism Check",
};

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id },
    include: { project: { select: { name: true } } },
  });
  if (!doc) notFound();

  const metrics = doc.metrics as Record<string, unknown> | null;
  const metricEntries = metrics
    ? Object.entries(metrics).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      )
    : [];

  const METRIC_LABELS: Record<string, string> = {
    humanScore: "Human Score",
    aiDetection: "AI Detection",
    aiProbability: "AI Probability",
    plagiarism: "Plagiarism",
    originalityScore: "Originality",
    grammar: "Grammar",
    readability: "Readability",
    seoScore: "SEO Score",
  };

  return (
    <div className="hf-page">
      <Nav />
      <main className="hf-doc-main">
        <Link href="/dashboard" className="hf-doc-back">
          ← Back to dashboard
        </Link>

        <div className="hf-doc-header">
          <div>
            <h1 className="hf-doc-title">{doc.title}</h1>
            <div className="hf-doc-meta">
              <span className="hf-doc-kind">{KIND_LABELS[doc.kind] ?? doc.mode}</span>
              {doc.project && <span className="hf-doc-project">📁 {doc.project.name}</span>}
              <span>{doc.createdAt.toLocaleString()}</span>
            </div>
          </div>
          <div className="hf-doc-actions">
            <FavoriteToggle id={doc.id} favorite={doc.favorite} />
            <DeleteDocInline id={doc.id} />
          </div>
        </div>

        <div className="hf-doc-export-row">
          <span className="hf-doc-export-label">Export:</span>
          <a href={`/api/documents/${doc.id}/export?format=txt`} className="hf-doc-export-btn">TXT</a>
          <a href={`/api/documents/${doc.id}/export?format=docx`} className="hf-doc-export-btn">DOCX</a>
          <a href={`/api/documents/${doc.id}/export?format=pdf`} className="hf-doc-export-btn">PDF</a>
        </div>

        <div className="hf-doc-panes">
          <div className="hf-doc-pane">
            <div className="hf-doc-pane-label">Original text</div>
            <p className="hf-doc-pane-text">{doc.originalText}</p>
          </div>
          {doc.improvedText && (
            <div className="hf-doc-pane hf-doc-pane-improved">
              <div className="hf-doc-pane-label">Result</div>
              <p className="hf-doc-pane-text">{doc.improvedText}</p>
            </div>
          )}
        </div>

        {metricEntries.length > 0 && (
          <div className="hf-doc-metrics">
            {metricEntries.map(([key, value]) => (
              <div key={key} className="hf-doc-metric">
                <span>{METRIC_LABELS[key] ?? key}</span>
                <strong>{value}%</strong>
              </div>
            ))}
          </div>
        )}

        {Array.isArray(metrics?.matches) && metrics.matches.length > 0 && (
          <div className="hf-doc-matches">
            <div className="hf-doc-pane-label">Matching sources</div>
            {(metrics.matches as { url?: string; title?: string; matchedWords?: number }[]).map(
              (m, i) => (
                <a
                  key={i}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hf-doc-match-row"
                >
                  <span className="hf-doc-match-title">{m.title || m.url}</span>
                  <span className="hf-doc-match-words">{m.matchedWords} matched words</span>
                </a>
              ),
            )}
          </div>
        )}
      </main>
    </div>
  );
}
