"use client";

import { useState } from "react";
import Link from "next/link";
import type { NavLink } from "../lib/content";
import LogoutButton from "./LogoutButton";

type Props = {
  links: NavLink[];
  signedIn: boolean;
};

export default function MobileMenu({ links, signedIn }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="hf-mobile-menu">
      <button
        className="hf-mobile-menu-btn"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div className="hf-mobile-menu-panel">
          {links.map((link) => (
            <Link key={link.label} href={link.href} className="hf-mobile-menu-link" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <div className="hf-mobile-menu-divider" />
          {signedIn ? (
            <>
              <Link href="/dashboard" className="hf-mobile-menu-link" onClick={() => setOpen(false)}>
                Dashboard
              </Link>
              <LogoutButton className="hf-mobile-menu-link" />
            </>
          ) : (
            <>
              <Link href="/login" className="hf-mobile-menu-link" onClick={() => setOpen(false)}>
                Login
              </Link>
              <Link href="/signup" className="hf-mobile-menu-cta" onClick={() => setOpen(false)}>
                Get Started
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
