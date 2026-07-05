import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "../lib/db";
import { getCurrentUser } from "../lib/auth";
import { PLAN_LIMITS, PLAN_LABELS, periodExpired } from "../lib/plans";
import Nav from "../components/Nav";
import DeleteDocButton from "./DeleteDocButton";
import FavoriteStar from "./FavoriteStar";
import ProjectsCard from "./ProjectsCard";
import ApiKeysCard from "./ApiKeysCard";
import "../components/Dashboard.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "Dashboard",
};

const ACTIVITY_LABELS: Record<string, string> = {
  HUMANIZE: "Humanized text",
  TOOL_RUN: "Ran tool",
  DOC_DELETED: "Deleted document",
  EXPORT: "Exported",
  KEY_CREATED: "Created API key",
  API_CALL: "API call",
  PROJECT_CREATED: "Created project",
};

const KIND_LABELS: Record<string, string> = {
  humanize: "Humanized",
  detect: "AI Detection",
  grammar: "Grammar",
  paraphrase: "Paraphrase",
  summarize: "Summary",
  translate: "Translation",
  tone: "Tone",
  citation: "Citation",
  plagiarism: "Plagiarism",
};

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const q = (await searchParams).q?.trim() ?? "";

  const [documents, projects, activities, apiKeys] = await Promise.all([
    prisma.document.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { tags: { has: q.toLowerCase() } },
                { originalText: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { documents: true } } },
    }),
    prisma.activity.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
    }),
  ]);

  const wordsUsed = periodExpired(user.periodStart) ? 0 : user.wordsUsed;
  const limit = PLAN_LIMITS[user.plan];
  const usagePct = limit ? Math.min(100, Math.round((wordsUsed / limit) * 100)) : 0;

  const humanScores = documents
    .map((d) => (d.metrics as { humanScore?: number } | null)?.humanScore)
    .filter((s): s is number => typeof s === "number");
  const avgHumanScore = humanScores.length
    ? (humanScores.reduce((a, b) => a + b, 0) / humanScores.length).toFixed(1)
    : null;

  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="hf-dash-page">
      <Nav />
      <main className="hf-dash-main hf-dash-main-wide">
        <div className="hf-dash-header">
          <div>
            <h1 className="hf-dash-title">Dashboard</h1>
            <p className="hf-dash-welcome">Welcome back, {user.name.split(" ")[0]}</p>
          </div>
          <div className="hf-dash-header-right">
            <span className="hf-dashboard-plan-badge">{PLAN_LABELS[user.plan]}</span>
            <span className="hf-dash-avatar">{initials}</span>
          </div>
        </div>

        {documents.length === 0 && (
          <section className="hf-onboard">
            <div className="hf-onboard-intro">
              <h2 className="hf-onboard-title">Welcome to HumanFlow 👋</h2>
              <p className="hf-onboard-sub">
                Here&apos;s how to get started — pick whatever fits what you need right now.
              </p>
            </div>
            <div className="hf-onboard-grid">
              <Link href="/editor" className="hf-onboard-tile">
                <span className="hf-onboard-num">1</span>
                <span className="hf-onboard-tile-title">Open the editor</span>
                <span className="hf-onboard-tile-desc">
                  Start a blank document, or upload a PDF/Word/Markdown file to edit and humanize.
                </span>
              </Link>
              <Link href="/tools" className="hf-onboard-tile">
                <span className="hf-onboard-num">2</span>
                <span className="hf-onboard-tile-title">Try the tools</span>
                <span className="hf-onboard-tile-desc">
                  Humanize, detect AI, fix grammar, paraphrase, summarize, translate, and more.
                </span>
              </Link>
              <Link href="/convert" className="hf-onboard-tile">
                <span className="hf-onboard-num">3</span>
                <span className="hf-onboard-tile-title">Convert a file</span>
                <span className="hf-onboard-tile-desc">
                  Turn a PDF into Word, Word into Markdown, and more — no AI credits used.
                </span>
              </Link>
              <a href="#api-keys" className="hf-onboard-tile">
                <span className="hf-onboard-num">4</span>
                <span className="hf-onboard-tile-title">Get an API key</span>
                <span className="hf-onboard-tile-desc">
                  Build HumanFlow into your own apps with the developer API.
                </span>
              </a>
            </div>
          </section>
        )}

        <div className="hf-dash-stats">
          <div className="hf-dashboard-credits-card">
            <div className="hf-dashboard-credits-label">Words used this month</div>
            <div className="hf-dashboard-credits-value">{wordsUsed.toLocaleString()}</div>
            <div className="hf-dashboard-credits-track">
              <div className="hf-dashboard-credits-fill" style={{ width: `${usagePct}%` }} />
            </div>
            <div className="hf-dashboard-credits-note">
              {limit === null
                ? "Unlimited words on your plan"
                : `of ${limit.toLocaleString()} — ${(limit - wordsUsed).toLocaleString()} left`}
            </div>
          </div>
          <div className="hf-dashboard-mini-stat hf-dash-stat-card">
            <div className="hf-dashboard-mini-stat-label">Documents</div>
            <div className="hf-dashboard-mini-stat-value">{documents.length}</div>
          </div>
          <div className="hf-dashboard-mini-stat hf-dash-stat-card">
            <div className="hf-dashboard-mini-stat-label">Avg. human score</div>
            <div className="hf-dashboard-mini-stat-value" style={{ color: "#12A150" }}>
              {avgHumanScore !== null ? `${avgHumanScore}%` : "—"}
            </div>
          </div>
        </div>

        <div className="hf-dash-columns">
          <div className="hf-dash-col-main">
            <div className="hf-dashboard-docs hf-dash-docs">
              <div className="hf-dashboard-docs-header hf-dash-docs-header-row">
                <span>{q ? `Search: “${q}”` : "Recent documents"}</span>
                <form className="hf-dash-search" action="/dashboard" method="get">
                  <input
                    className="hf-dash-input"
                    type="search"
                    name="q"
                    placeholder="Search title, text, tags…"
                    defaultValue={q}
                  />
                </form>
                <Link href="/trash" className="hf-dash-trash-link">
                  Trash
                </Link>
              </div>
              {documents.length === 0 ? (
                <div className="hf-dash-empty">
                  {q ? (
                    <>No documents match “{q}”.</>
                  ) : (
                    <>
                      No documents yet.{" "}
                      <Link href="/editor" className="hf-dash-empty-link">
                        Create your first document →
                      </Link>
                    </>
                  )}
                </div>
              ) : (
                documents.map((doc) => {
                  const humanScore = (doc.metrics as { humanScore?: number } | null)?.humanScore;
                  return (
                    <div key={doc.id} className="hf-dashboard-doc-row">
                      <div className="hf-dashboard-doc-info">
                        <FavoriteStar id={doc.id} favorite={doc.favorite} />
                        <Link
                          href={doc.kind === "editor" ? `/editor/${doc.id}` : `/documents/${doc.id}`}
                          className="hf-dashboard-doc-info hf-dash-doc-link"
                        >
                          <span className="hf-dashboard-doc-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5" />
                            </svg>
                          </span>
                          <span className="hf-dashboard-doc-text">
                            <span className="hf-dashboard-doc-name">{doc.title}</span>
                            <span className="hf-dashboard-doc-time">
                              {KIND_LABELS[doc.kind] ?? doc.mode} · {timeAgo(doc.createdAt)}
                            </span>
                          </span>
                        </Link>
                      </div>
                      <div className="hf-dash-doc-actions">
                        {typeof humanScore === "number" && (
                          <span
                            className="hf-dashboard-doc-tag"
                            style={{ color: "#12A150", background: "#EAF7EF" }}
                          >
                            {humanScore}% human
                          </span>
                        )}
                        <DeleteDocButton id={doc.id} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <ApiKeysCard keys={apiKeys.map((k) => ({
              ...k,
              createdAt: k.createdAt.toISOString(),
              lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            }))} />
          </div>

          <div className="hf-dash-col-side">
            <ProjectsCard
              projects={projects.map((p) => ({ id: p.id, name: p.name, count: p._count.documents }))}
            />

            <div className="hf-dash-card">
              <div className="hf-dashboard-docs-header">Recent activity</div>
              <div className="hf-dash-card-body">
                {activities.length === 0 ? (
                  <p className="hf-dash-card-empty">Your activity will show up here.</p>
                ) : (
                  activities.map((a) => (
                    <div key={a.id} className="hf-dash-activity-row">
                      <span className="hf-dash-activity-dot" />
                      <div className="hf-dash-activity-text">
                        <span className="hf-dash-activity-label">
                          {ACTIVITY_LABELS[a.type] ?? a.type}
                        </span>
                        <span className="hf-dash-activity-detail">{a.detail}</span>
                      </div>
                      <span className="hf-dash-activity-time">{timeAgo(a.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="hf-dash-cta-row">
              <Link href="/batch" className="hf-dash-new-doc hf-dash-tools-btn">
                Batch
              </Link>
              <Link href="/tools" className="hf-dash-new-doc hf-dash-tools-btn">
                Tools
              </Link>
              <Link href="/editor" className="hf-dash-new-doc">
                + New document
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
