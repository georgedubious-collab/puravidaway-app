import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, SITE_INDEXABLE, SITE_URL } from "@/lib/site";

/**
 * Search engines and AI answer engines we explicitly welcome on the public pages
 * once the site is indexable. They get the same rules as everyone else
 * (private areas stay blocked); naming them makes the permission unambiguous.
 */
const NAMED_CRAWLERS = ["Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
  // Pre-launch (or any preview): ask every crawler to stay out.
  if (!SITE_INDEXABLE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: [
      { userAgent: NAMED_CRAWLERS, allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
