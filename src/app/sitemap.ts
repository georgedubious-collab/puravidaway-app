import type { MetadataRoute } from "next";
import { BILINGUAL_PATHS, ES_PATHS } from "@/lib/publicLang";
import { ROUTE_PAGES } from "@/lib/routePages";
import { LEGAL_PATHS, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // Pages in English and Spanish: one entry per language, each listing both (hreflang).
  const bilingual = BILINGUAL_PATHS.flatMap((en) => {
    const languages = { en: `${SITE_URL}${en}`, es: `${SITE_URL}${ES_PATHS[en]}`, "x-default": `${SITE_URL}${en}` };
    return [en, ES_PATHS[en]].map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      alternates: { languages },
    }));
  });
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    ...ROUTE_PAGES.map((p) => ({
      url: `${SITE_URL}/transfers/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...bilingual,
    ...LEGAL_PATHS.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
