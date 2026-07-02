import "./Hero.css";

export default function Hero() {
  return (
    <section className="hf-hero">
      <div className="hf-hero-copy">
        <div className="hf-hero-badge">
          <span className="hf-hero-badge-new">NEW</span>
          Undetectable humanizer v4 is live
        </div>
        <h1 className="hf-hero-title">
          Write naturally.
          <br />
          <span className="hf-hero-title-accent">Publish confidently.</span>
        </h1>
        <p className="hf-hero-sub">
          Humanize AI-generated content, detect AI writing, check plagiarism, rewrite text
          naturally, improve readability, and optimize your writing — all in one intelligent
          platform.
        </p>
        <div className="hf-hero-actions">
          <a href="#editor" className="hf-hero-try">
            Try free
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
          <a href="#editor" className="hf-hero-demo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M10 9l5 3-5 3z" fill="var(--accent)" stroke="none" />
            </svg>
            Watch demo
          </a>
        </div>
        <div className="hf-hero-trust">
          <span className="hf-hero-trust-item">
            <CheckIcon />
            Free to start — pay your way
          </span>
          <span className="hf-hero-trust-item">
            <CheckIcon />
            Private &amp; secure
          </span>
          <span className="hf-hero-trust-item">
            <CheckIcon />
            2M+ writers
          </span>
        </div>
      </div>

      <div className="hf-hero-illustration">
        <div className="hf-hero-editor-card">
          <div className="hf-hero-editor-titlebar">
            <span className="hf-dot hf-dot-red" />
            <span className="hf-dot hf-dot-yellow" />
            <span className="hf-dot hf-dot-green" />
            <span className="hf-hero-editor-titlebar-label">humanflow — editor</span>
          </div>
          <div className="hf-hero-editor-body">
            <div className="hf-hero-editor-row">
              <span className="hf-hero-editor-tag-ai">● AI-generated</span>
              <span className="hf-hero-editor-pct">96% AI detected</span>
            </div>
            <p className="hf-hero-editor-text-bad">
              <span className="hf-hero-editor-highlight">Leveraging cutting-edge paradigms</span>,
              we utilize AI to synergistically optimize operational efficiencies.
            </p>
            <div className="hf-hero-editor-humanizing-wrap">
              <span className="hf-hero-editor-humanizing">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4z" />
                </svg>
                Humanizing
              </span>
            </div>
            <div className="hf-hero-editor-row">
              <span className="hf-hero-editor-tag-human">● Human</span>
              <span className="hf-hero-editor-pct">99% human</span>
            </div>
            <p className="hf-hero-editor-text-good">
              We use AI to help our team work smarter — cutting busywork so people can focus on
              what actually moves the business forward.
            </p>
          </div>
        </div>

        <div className="hf-hero-float hf-hero-float-1">
          <div className="hf-hero-stat-card">
            <div className="hf-hero-stat-label">Human Score</div>
            <div className="hf-hero-stat-value" style={{ color: "#12A150" }}>
              99%
            </div>
          </div>
        </div>
        <div className="hf-hero-float hf-hero-float-2">
          <div className="hf-hero-stat-card">
            <div className="hf-hero-stat-label">AI Score</div>
            <div className="hf-hero-stat-value" style={{ color: "#E5484D" }}>
              3%
            </div>
          </div>
        </div>
        <div className="hf-hero-float hf-hero-float-3">
          <div className="hf-hero-stat-card">
            <div className="hf-hero-stat-label">Plagiarism</div>
            <div className="hf-hero-stat-value" style={{ color: "#0A1120" }}>
              0%
            </div>
          </div>
        </div>
        <div className="hf-hero-float hf-hero-float-4">
          <div className="hf-hero-stat-card hf-hero-stat-card-split">
            <div>
              <div className="hf-hero-stat-label-sm">Grammar</div>
              <div className="hf-hero-stat-value-sm" style={{ color: "#0A1120" }}>
                A+
              </div>
            </div>
            <div>
              <div className="hf-hero-stat-label-sm">Readability</div>
              <div className="hf-hero-stat-value-sm" style={{ color: "var(--accent)" }}>
                92
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#12A150" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
