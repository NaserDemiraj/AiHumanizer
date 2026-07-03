"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import "./auth.css";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }

    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.get("password") }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong. Try again.");
        setPending(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
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
        <h1 className="hf-auth-title">Choose a new password</h1>
        <p className="hf-auth-sub">Make it at least 8 characters.</p>

        {!token ? (
          <div className="hf-auth-error" style={{ marginTop: 22 }}>
            This link is missing its reset token.{" "}
            <Link href="/forgot-password">Request a new one</Link>.
          </div>
        ) : (
          <form className="hf-auth-form" onSubmit={handleSubmit}>
            <div className="hf-auth-field">
              <label className="hf-auth-label" htmlFor="password">
                New password
              </label>
              <input
                className="hf-auth-input"
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {error && <div className="hf-auth-error">{error}</div>}

            <button className="hf-auth-submit" type="submit" disabled={pending}>
              {pending ? "Resetting…" : "Reset password"}
            </button>
          </form>
        )}

        <p className="hf-auth-switch">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
