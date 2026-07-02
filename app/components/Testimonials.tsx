import { testimonials } from "../lib/content";
import "./Testimonials.css";

export default function Testimonials() {
  return (
    <section className="hf-testimonials-section">
      <div className="hf-testimonials-heading">
        <div className="hf-eyebrow">Loved by writers</div>
        <h2 className="hf-h2">Trusted by teams who publish daily</h2>
      </div>
      <div className="hf-testimonials-grid">
        {testimonials.map((t) => (
          <div key={t.name} className="hf-testimonial-card">
            <div className="hf-testimonial-stars">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width="17" height="17" viewBox="0 0 24 24" fill="#FFB020" stroke="none">
                  <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" />
                </svg>
              ))}
            </div>
            <p className="hf-testimonial-quote">&quot;{t.quote}&quot;</p>
            <div className="hf-testimonial-author">
              <span className="hf-testimonial-avatar" style={{ background: t.avatarBg }}>
                {t.initials}
              </span>
              <div>
                <div className="hf-testimonial-name">{t.name}</div>
                <div className="hf-testimonial-role">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
