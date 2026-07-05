/**
 * The canonical public URL of the site, used for metadata, sitemap, robots,
 * and Open Graph tags. Set NEXT_PUBLIC_SITE_URL to the deployed origin
 * (e.g. https://humanflow.app); falls back to localhost for local dev.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/+$/, "");
