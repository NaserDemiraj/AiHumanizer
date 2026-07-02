import { steps } from "../lib/content";
import "./HowItWorks.css";

export default function HowItWorks() {
  return (
    <section className="hf-how">
      <div className="hf-how-heading">
        <div className="hf-eyebrow">How it works</div>
        <h2 className="hf-h2">From draft to done in four steps</h2>
      </div>
      <div className="hf-how-grid">
        {steps.map((s) => (
          <div key={s.num} className="hf-how-step">
            <div className="hf-how-step-line" />
            <div className="hf-how-step-num">{s.num}</div>
            <h3 className="hf-how-step-title">{s.title}</h3>
            <p className="hf-how-step-desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
