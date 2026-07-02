"use client";

import { useState } from "react";
import { modeNames } from "../lib/content";
import "./RewriteModes.css";

export default function RewriteModes() {
  const [activeMode, setActiveMode] = useState("Humanize");

  return (
    <section className="hf-modes-section">
      <div className="hf-modes-panel">
        <div className="hf-modes-glow" />
        <div className="hf-modes-content">
          <div>
            <div className="hf-modes-eyebrow">Smart rewrite modes</div>
            <h2 className="hf-modes-title">Pick your objective. We tune every word to match.</h2>
            <p className="hf-modes-desc">
              Choose a goal before you rewrite — HumanFlow adapts tone, structure, and vocabulary
              to fit the exact context you&apos;re writing for.
            </p>
            <p className="hf-modes-selected">
              Selected: <span className="hf-modes-selected-value">{activeMode}</span>
            </p>
          </div>
          <div className="hf-modes-chips">
            {modeNames.map((mode) => {
              const active = activeMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setActiveMode(mode)}
                  className={`hf-mode-chip${active ? " hf-mode-chip-active" : ""}`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
