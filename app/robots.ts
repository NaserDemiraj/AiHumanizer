import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private/authenticated surfaces out of search indexes
      disallow: ["/dashboard", "/editor", "/documents", "/trash", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
