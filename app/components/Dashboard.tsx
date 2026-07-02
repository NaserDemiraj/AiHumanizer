import { dashHighlights, dashDocs } from "../lib/content";
import "./Dashboard.css";

export default function Dashboard() {
  return (
    <section className="hf-dashboard-section">
      <div className="hf-dashboard-grid">
        <div>
          <div className="hf-eyebrow">Your dashboard</div>
          <h2 className="hf-h2">Every document, project, and metric in one place</h2>
          <p className="hf-dashboard-sub">
            Track your writing history, manage saved projects, and monitor usage and AI credits
            from a single elegant workspace.
          </p>
          <div className="hf-dashboard-highlights">
            {dashHighlights.map((d) => (
              <div key={d} className="hf-dashboard-highlight">
                <span className="hf-dashboard-highlight-dot" />
                {d}
              </div>
            ))}
          </div>
        </div>

        <div className="hf-dashboard-mock">
          <div className="hf-dashboard-mock-header">
            <div className="hf-dashboard-mock-title">Dashboard</div>
            <div className="hf-dashboard-mock-header-right">
              <span className="hf-dashboard-plan-badge">Pro plan</span>
              <span className="hf-dashboard-avatar" />
            </div>
          </div>
          <div className="hf-dashboard-mock-body">
            <div className="hf-dashboard-mock-stats">
              <div className="hf-dashboard-credits-card">
                <div className="hf-dashboard-credits-label">AI credits</div>
                <div className="hf-dashboard-credits-value">68,400</div>
                <div className="hf-dashboard-credits-track">
                  <div className="hf-dashboard-credits-fill" />
                </div>
                <div className="hf-dashboard-credits-note">of 100,000 this month</div>
              </div>
              <div className="hf-dashboard-mini-stats">
                <div className="hf-dashboard-mini-stat">
                  <div className="hf-dashboard-mini-stat-label">Documents</div>
                  <div className="hf-dashboard-mini-stat-value">142</div>
                </div>
                <div className="hf-dashboard-mini-stat">
                  <div className="hf-dashboard-mini-stat-label">Avg. human score</div>
                  <div className="hf-dashboard-mini-stat-value" style={{ color: "#12A150" }}>
                    98.4%
                  </div>
                </div>
              </div>
            </div>

            <div className="hf-dashboard-docs">
              <div className="hf-dashboard-docs-header">Recent documents</div>
              {dashDocs.map((doc) => (
                <div key={doc.name} className="hf-dashboard-doc-row">
                  <div className="hf-dashboard-doc-info">
                    <span className="hf-dashboard-doc-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5" />
                      </svg>
                    </span>
                    <div className="hf-dashboard-doc-text">
                      <div className="hf-dashboard-doc-name">{doc.name}</div>
                      <div className="hf-dashboard-doc-time">{doc.time}</div>
                    </div>
                  </div>
                  <span
                    className="hf-dashboard-doc-tag"
                    style={{ color: doc.tagColor, background: doc.tagBg }}
                  >
                    {doc.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
