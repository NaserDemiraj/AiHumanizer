"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./auth.css";

type Props = {
  variant: "login" | "signup";
};

export default function AuthForm({ variant }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const endpoint = variant === "login" ? "/api/auth/login" : "/api/auth/signup";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        <h1 className="hf-auth-title">
          {variant === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="hf-auth-sub">
          {variant === "login"
            ? "Sign in to keep writing content that sounds human."
            : "Free to start — 2,000 words a month, no card required."}
        </p>

        <form className="hf-auth-form" onSubmit={handleSubmit}>
          {variant === "signup" && (
            <div className="hf-auth-field">
              <label className="hf-auth-label" htmlFor="name">
                Name
              </label>
              <input className="hf-auth-input" id="name" name="name" type="text" required autoComplete="name" />
            </div>
          )}
          <div className="hf-auth-field">
            <label className="hf-auth-label" htmlFor="email">
              Email
            </label>
            <input className="hf-auth-input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="hf-auth-field">
            <label className="hf-auth-label" htmlFor="password">
              Password
            </label>
            <input
              className="hf-auth-input"
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={variant === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && <div className="hf-auth-error">{error}</div>}

          <button className="hf-auth-submit" type="submit" disabled={pending}>
            {pending ? "One moment…" : variant === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="hf-auth-switch">
          {variant === "login" ? (
            <>
              No account yet? <Link href="/signup">Sign up free</Link>
            </>
          ) : (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
