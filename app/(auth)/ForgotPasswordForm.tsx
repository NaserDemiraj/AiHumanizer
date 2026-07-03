"use client";

import { useState } from "react";
import Link from "next/link";
import "./auth.css";

export default function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email") }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.");
      } else {
        setMessage(data.message);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="hf-auth-page">
      <div className="hf-auth-card">
        <Link href="/" className="hf-auth-logo">
          <span className="hf-auth-logo-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18c4-9 12-9 16 0M8 12c2-4 6-4 8 0" />
            </svg>
          </span>
          HumanFlow
        </Link>
        <h1 className="hf-auth-title">Reset your password</h1>
        <p className="hf-auth-sub">
          Enter your account email and we&apos;ll send you a reset link.
        </p>

        <form className="hf-auth-form" onSubmit={handleSubmit}>
          <div className="hf-auth-field">
            <label className="hf-auth-label" htmlFor="email">
              Email
            </label>
            <input className="hf-auth-input" id="email" name="email" type="email" required autoComplete="email" />
          </div>

          {error && <div className="hf-auth-error">{error}</div>}
          {message && <div className="hf-auth-success">{message}</div>}

          <button className="hf-auth-submit" type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="hf-auth-switch">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
