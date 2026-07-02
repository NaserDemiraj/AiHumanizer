import { features, moreFeatures } from "../lib/content";
import "./Features.css";

export default function Features() {
  return (
    <section id="features" className="hf-features">
      <div className="hf-features-heading">
        <div className="hf-eyebrow">Everything you need</div>
        <h2 className="hf-h2">One platform for writing that sounds human</h2>
        <p className="hf-features-sub">
          A complete toolkit of AI writing tools that work together — from humanizing and
          detection to plagiarism, tone, and SEO.
        </p>
      </div>

      <div className="hf-features-grid">
        {features.map((f) => (
          <div key={f.title} className="hf-feature-card">
            <div className="hf-feature-icon">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d={f.d} />
              </svg>
            </div>
            <h3 className="hf-feature-title">{f.title}</h3>
            <p className="hf-feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="hf-more-features">
        <div className="hf-more-features-heading">
          <span className="hf-more-features-dot" />
          Plus everything else your writing needs
        </div>
        <div className="hf-more-features-grid">
          {moreFeatures.map((m) => (
            <div key={m} className="hf-more-features-item">
              <span className="hf-more-features-check">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              {m}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
