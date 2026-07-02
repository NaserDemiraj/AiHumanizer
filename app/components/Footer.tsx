import { socials, footerCols } from "../lib/content";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="hf-footer">
      <div className="hf-footer-top">
        <div className="hf-footer-brand">
          <a href="#" className="hf-footer-logo">
            <span className="hf-footer-logo-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 18c4-9 12-9 16 0M8 12c2-4 6-4 8 0" />
              </svg>
            </span>
            HumanFlow
          </a>
          <p className="hf-footer-tagline">
            The intelligent writing platform for content that sounds human and passes every
            check.
          </p>
          <div className="hf-footer-socials">
            {socials.map((s, i) => (
              <a key={i} href="#" className="hf-footer-social">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d={s.d} />
                </svg>
              </a>
            ))}
          </div>
        </div>
        <div className="hf-footer-cols">
          {footerCols.map((col) => (
            <div key={col.title} className="hf-footer-col">
              <div className="hf-footer-col-title">{col.title}</div>
              <div className="hf-footer-col-links">
                {col.links.map((l) => (
                  <a key={l.label} href={l.href} className="hf-footer-link">
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hf-footer-bottom">
        <div className="hf-footer-copyright">© 2026 HumanFlow, Inc. All rights reserved.</div>
      </div>
    </footer>
  );
}
