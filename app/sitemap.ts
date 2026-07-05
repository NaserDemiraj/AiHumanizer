import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/siteUrl";

/** Public, indexable pages. Authenticated app routes are intentionally omitted. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/tools", priority: 0.9, freq: "weekly" },
    { path: "/convert", priority: 0.8, freq: "monthly" },
    { path: "/login", priority: 0.4, freq: "yearly" },
    { path: "/signup", priority: 0.6, freq: "yearly" },
  ];
  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));
}
