import Link from "next/link";
import { getCurrentUser } from "../lib/auth";
import type { NavLink } from "../lib/content";
import LogoutButton from "./LogoutButton";
import MobileMenu from "./MobileMenu";

/**
 * The only part of Nav that touches cookies()/the DB. Isolated so the rest
 * of Nav (and any page that renders it) can be part of the static shell —
 * this is the sole dynamic hole, wrapped in <Suspense> by Nav.tsx.
 */
export default async function NavAuth({ links }: { links: NavLink[] }) {
  const user = await getCurrentUser();

  return (
    <>
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
      <MobileMenu links={links} signedIn={Boolean(user)} />
    </>
  );
}
