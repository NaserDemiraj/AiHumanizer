import Link from "next/link";
import { navLinks } from "../lib/content";
import { getCurrentUser } from "../lib/auth";
import LogoutButton from "./LogoutButton";
import MobileMenu from "./MobileMenu";
import "./Nav.css";

export default async function Nav() {
  const user = await getCurrentUser();

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
        <div className="hf-nav-actions">
          {user ? (
            <>
              <LogoutButton className="hf-nav-login" />
              <Link href="/dashboard" className="hf-nav-cta">
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="hf-nav-login">
                Login
              </Link>
              <Link href="/signup" className="hf-nav-cta">
                Get Started
              </Link>
            </>
          )}
        </div>
        <MobileMenu links={navLinks} signedIn={Boolean(user)} />
      </nav>
    </header>
  );
}
