import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "../lib/db";
import { getCurrentUser } from "../lib/auth";
import Nav from "../components/Nav";
import TrashActions from "./TrashActions";
import "../components/Dashboard.css";
import "../dashboard/dashboard.css";
import "./trash.css";

export const metadata: Metadata = {
  title: "Trash — HumanFlow",
};

export default async function TrashPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const documents = await prisma.document.findMany({
    where: { userId: user.id, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    take: 50,
  });

  return (
    <div className="hf-dash-page">
      <Nav />
      <main className="hf-dash-main">
        <div className="hf-dash-header">
          <div>
            <h1 className="hf-dash-title">Trash</h1>
            <p className="hf-dash-welcome">
              Deleted documents stay here until you restore them or delete them forever.
            </p>
          </div>
          <Link href="/dashboard" className="hf-dash-new-doc">
            ← Back to dashboard
          </Link>
        </div>

        <div className="hf-dashboard-docs hf-dash-docs">
          <div className="hf-dashboard-docs-header">Trashed documents</div>
          {documents.length === 0 ? (
            <div className="hf-dash-empty">Trash is empty.</div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="hf-dashboard-doc-row">
                <div className="hf-dashboard-doc-info">
                  <span className="hf-dashboard-doc-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5" />
                    </svg>
                  </span>
                  <div className="hf-dashboard-doc-text">
                    <div className="hf-dashboard-doc-name">{doc.title}</div>
                    <div className="hf-dashboard-doc-time">
                      Deleted {doc.deletedAt?.toLocaleString()}
                    </div>
                  </div>
                </div>
                <TrashActions id={doc.id} />
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
