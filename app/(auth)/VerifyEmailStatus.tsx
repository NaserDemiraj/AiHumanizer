"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import "./auth.css";

export default function VerifyEmailStatus() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<"pending" | "success" | "error">(
    token ? "pending" : "error",
  );
  const [error, setError] = useState<string | null>(
    token ? null : "This verification link is missing its token.",
  );

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "Verification failed.");
          setState("error");
        } else {
          setState("success");
        }
      })
      .catch(() => {
        setError("Network error. Try the link again.");
        setState("error");
      });
  }, [token]);

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
          {state === "success" ? "Email verified" : state === "error" ? "Verification failed" : "Verifying…"}
        </h1>

        {state === "success" && (
          <div className="hf-auth-success" style={{ marginTop: 22 }}>
            Your email is confirmed. You&apos;re all set.
          </div>
        )}
        {state === "error" && (
          <div className="hf-auth-error" style={{ marginTop: 22 }}>
            {error}
          </div>
        )}

        <p className="hf-auth-switch">
          <Link href="/dashboard">Go to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
