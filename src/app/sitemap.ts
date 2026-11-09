import type { MetadataRoute } from "next";
import { ROUTE_PAGES } from "@/lib/routePages";
import { LEGAL_PATHS, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    ...ROUTE_PAGES.map((p) => ({
      url: `${SITE_URL}/transfers/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...LEGAL_PATHS.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
