import type { MetadataRoute } from "next";
import { BILINGUAL_PATHS, esPathOf } from "@/lib/publicLang";
import { ARTICLES, BLOG_PATH, articlePath } from "@/lib/blog";
import { AIRPORT_GUIDES, AIRPORTS_PATH, DESTINATION_GUIDES, DESTINATIONS_PATH, airportPath, destinationPath } from "@/lib/guides";
import { getCatalog } from "@/lib/catalogSource";
import { ROUTE_PAGES, TRANSFERS_PATH, routePath } from "@/lib/routePages";
import { TOURS_PATH, activeTourPages, tourPath } from "@/lib/tours";
import { LEGAL_PATHS, SITE_URL } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Every public page exists in English and Spanish: one entry per language,
 * each listing both versions (hreflang) with English as x-default.
 */
function bilingual(enPath: string, rest: Pick<Entry, "changeFrequency" | "priority">): Entry[] {
  const esPath = esPathOf(enPath);
  const url = (p: string) => `${SITE_URL}${p}`;
  if (!esPath) return [{ url: url(enPath), ...rest }];
  const languages = { en: url(enPath), es: url(esPath), "x-default": url(enPath) };
  return [enPath, esPath].map((p) => ({ url: url(p), ...rest, alternates: { languages } }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Tour pages only for tours active in the catalog (a tour switched off in /admin/pricing has no page).
  const tours = activeTourPages(await getCatalog());
  return [
    ...bilingual("/", { changeFrequency: "weekly", priority: 1 }),
    ...bilingual(TRANSFERS_PATH, { changeFrequency: "monthly", priority: 0.8 }),
    ...ROUTE_PAGES.flatMap((p) => bilingual(routePath(p), { changeFrequency: "monthly", priority: 0.8 })),
    ...[DESTINATIONS_PATH, AIRPORTS_PATH].flatMap((p) => bilingual(p, { changeFrequency: "monthly", priority: 0.7 })),
    ...DESTINATION_GUIDES.flatMap((g) => bilingual(destinationPath(g), { changeFrequency: "monthly", priority: 0.7 })),
    ...AIRPORT_GUIDES.flatMap((g) => bilingual(airportPath(g), { changeFrequency: "monthly", priority: 0.7 })),
    ...bilingual(TOURS_PATH, { changeFrequency: "monthly", priority: 0.8 }),
    ...tours.flatMap((p) => bilingual(tourPath(p), { changeFrequency: "monthly", priority: 0.8 }).map((e) => ({ ...e, lastModified: p.updated }))),
    ...bilingual(BLOG_PATH, { changeFrequency: "weekly", priority: 0.7 }),
    ...ARTICLES.flatMap((a) => bilingual(articlePath(a), { changeFrequency: "monthly", priority: 0.7 }).map((e) => ({ ...e, lastModified: a.updated }))),
    ...BILINGUAL_PATHS.flatMap((p) => bilingual(p, { changeFrequency: "monthly", priority: 0.6 })),
    ...LEGAL_PATHS.flatMap((p) => bilingual(p, { changeFrequency: "yearly", priority: 0.3 })),
  ];
}
