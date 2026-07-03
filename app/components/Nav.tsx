import Link from "next/link";
import { Suspense } from "react";
import { navLinks } from "../lib/content";
import NavAuth from "./NavAuth";
import "./Nav.css";

function NavAuthFallback() {
  return (
    <div className="hf-nav-actions">
      <Link href="/login" className="hf-nav-login">
        Login
      </Link>
      <Link href="/signup" className="hf-nav-cta">
        Get Started
      </Link>
    </div>
  );
}

export default function Nav() {
  return (
    <header className="hf-nav-header">
      <nav className="hf-nav">
        <Link href="/" className="hf-nav-logo">
          <span className="hf-nav-logo-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18c4-9 12-9 16 0M8 12c2-4 6-4 8 0" />
            </svg>
          </span>
          HumanFlow
        </Link>
        <div className="hf-nav-links">
          {navLinks.map((link) => (
            <Link key={link.label} href={link.href} className="hf-nav-link">
              {link.label}
            </Link>
          ))}
        </div>
        <Suspense fallback={<NavAuthFallback />}>
          <NavAuth links={navLinks} />
        </Suspense>
      </nav>
    </header>
  );
}
