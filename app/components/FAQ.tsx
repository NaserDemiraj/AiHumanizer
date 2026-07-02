"use client";

import { useState } from "react";
import { faqs } from "../lib/content";
import "./FAQ.css";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="hf-faq-section">
      <div className="hf-faq-heading">
        <div className="hf-eyebrow">FAQ</div>
        <h2 className="hf-h2">Questions, answered</h2>
      </div>
      <div className="hf-faq-list">
        {faqs.map((q, i) => {
          const open = openIndex === i;
          return (
            <div
              key={q.question}
              className={`hf-faq-item${open ? " hf-faq-item-open" : ""}`}
            >
              <button
                onClick={() => setOpenIndex(open ? -1 : i)}
                className="hf-faq-question"
              >
                <span className="hf-faq-question-text">{q.question}</span>
                <span className="hf-faq-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </button>
              <div className="hf-faq-answer-wrap" style={{ maxHeight: open ? "240px" : "0px" }}>
                <p className="hf-faq-answer">{q.answer}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
