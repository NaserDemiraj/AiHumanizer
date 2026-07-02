import "./CTA.css";

export default function CTA() {
  return (
    <section className="hf-cta-section">
      <div className="hf-cta-panel">
        <div className="hf-cta-glow" />
        <div className="hf-cta-content">
          <h2 className="hf-cta-title">Ready to humanize your writing?</h2>
          <p className="hf-cta-sub">
            Join 2 million writers publishing content that reads naturally and passes every
            check.
          </p>
          <div className="hf-cta-actions">
            <a href="/signup" className="hf-cta-primary">
              Start free today
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
            <a href="mailto:sales@humanflow.app" className="hf-cta-secondary">
              Talk to sales
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
