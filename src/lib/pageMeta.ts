import type { Metadata, ResolvingMetadata } from "next";
import { bilingualAlternates, ES_PATHS, type PublicLang } from "./publicLang";
import { SITE_NAME } from "./site";

/**
 * Metadata for a public page that exists in English and Spanish: title,
 * description, canonical + hreflang, and link previews. Setting openGraph
 * replaces the root one, so the site-wide preview image
 * (src/app/opengraph-image.tsx) is carried over from the parent.
 */
export async function bilingualMetadata(
  parent: ResolvingMetadata,
  { enPath, lang, title, description }: { enPath: string; lang: PublicLang; title: string; description: string },
): Promise<Metadata> {
  const inherited = await parent;
  const fullTitle = `${title} | ${SITE_NAME}`;
  const url = lang === "es" ? (ES_PATHS[enPath] ?? enPath) : enPath;
  return {
    title: fullTitle,
    description,
    alternates: bilingualAlternates(enPath, lang),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url,
      locale: lang === "es" ? "es_CR" : "en_US",
      alternateLocale: lang === "es" ? ["en_US"] : ["es_CR"],
      images: inherited.openGraph?.images,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: inherited.twitter?.images,
    },
  };
}
