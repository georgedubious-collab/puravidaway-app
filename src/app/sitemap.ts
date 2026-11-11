import type { MetadataRoute } from "next";
import { BILINGUAL_PATHS, esPathOf } from "@/lib/publicLang";
import { AIRPORT_GUIDES, AIRPORTS_PATH, DESTINATION_GUIDES, DESTINATIONS_PATH, airportPath, destinationPath } from "@/lib/guides";
import { ROUTE_PAGES } from "@/lib/routePages";
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

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...bilingual("/", { changeFrequency: "weekly", priority: 1 }),
    ...ROUTE_PAGES.flatMap((p) => bilingual(`/transfers/${p.slug}`, { changeFrequency: "monthly", priority: 0.8 })),
    ...[DESTINATIONS_PATH, AIRPORTS_PATH].flatMap((p) => bilingual(p, { changeFrequency: "monthly", priority: 0.7 })),
    ...DESTINATION_GUIDES.flatMap((g) => bilingual(destinationPath(g), { changeFrequency: "monthly", priority: 0.7 })),
    ...AIRPORT_GUIDES.flatMap((g) => bilingual(airportPath(g), { changeFrequency: "monthly", priority: 0.7 })),
    ...BILINGUAL_PATHS.flatMap((p) => bilingual(p, { changeFrequency: "monthly", priority: 0.6 })),
    ...LEGAL_PATHS.flatMap((p) => bilingual(p, { changeFrequency: "yearly", priority: 0.3 })),
  ];
}
