"use client";

import { useState } from "react";
import { plans, compareRows, payMethods } from "../lib/content";
import "./Pricing.css";

export default function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="hf-pricing-section">
      <div className="hf-pricing-heading">
        <div className="hf-eyebrow">Pricing</div>
        <h2 className="hf-h2">Simple pricing that scales with you</h2>
        <div className="hf-pricing-toggle">
          <button
            onClick={() => setAnnual(false)}
            className={`hf-pricing-toggle-btn${!annual ? " hf-pricing-toggle-btn-active" : ""}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`hf-pricing-toggle-btn${annual ? " hf-pricing-toggle-btn-active" : ""}`}
          >
            Annual <span className="hf-pricing-toggle-save">−20%</span>
          </button>
        </div>
      </div>

      <div className="hf-pricing-grid">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`hf-plan-card${p.dark ? " hf-plan-card-dark" : ""}${p.popular ? " hf-plan-card-popular" : ""}`}
          >
            <div className="hf-plan-header">
              <h3 className="hf-plan-name">{p.name}</h3>
              {p.popular && <span className="hf-plan-popular-badge">Most popular</span>}
            </div>
            <p className="hf-plan-tagline">{p.tagline}</p>
            <div className="hf-plan-price-row">
              <span className="hf-plan-price">{annual ? p.priceAnnual : p.priceMonthly}</span>
              <span className="hf-plan-period">{annual ? p.periodAnnual : p.periodMonthly}</span>
            </div>
            <a href={p.ctaHref} className="hf-plan-cta">
              {p.cta}
            </a>
            <div className="hf-plan-features">
              {p.features.map((feat) => (
                <div key={feat} className="hf-plan-feature">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={p.dark ? "#5B8CFF" : "#12A150"}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="hf-plan-feature-check"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {feat}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hf-pricing-reassurance">
        <div className="hf-pricing-secure">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#12A150" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Secure checkout — pay with card, PayPal, or invoice. Cancel anytime.
        </div>
        <div className="hf-pricing-pay-methods">
          {payMethods.map((pm) => (
            <span key={pm} className="hf-pricing-pay-method">
              {pm}
            </span>
          ))}
        </div>
      </div>

      <div className="hf-compare-table-wrap">
        <div className="hf-compare-table-title">Compare plans</div>
        <div className="hf-compare-table-scroll">
          <table className="hf-compare-table">
            <thead>
              <tr className="hf-compare-table-head-row">
                <th className="hf-compare-table-head-feature">Feature</th>
                <th className="hf-compare-table-head-plan">Free</th>
                <th className="hf-compare-table-head-plan hf-compare-table-head-plan-pro">Pro</th>
                <th className="hf-compare-table-head-plan">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row) => (
                <tr key={row.label} className="hf-compare-table-row">
                  <td className="hf-compare-table-cell-feature">{row.label}</td>
                  <td className="hf-compare-table-cell">{row.free}</td>
                  <td className="hf-compare-table-cell hf-compare-table-cell-pro">{row.pro}</td>
                  <td className="hf-compare-table-cell">{row.ent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
