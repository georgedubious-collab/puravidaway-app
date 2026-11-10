/**
 * Language of the PUBLIC website (not /admin or /driver, which use src/lib/teamLang.ts).
 *
 * English lives at the normal URLs; Spanish pages live under /es with their own
 * Spanish slugs. A page has a Spanish version only when it is listed in ES_PATHS,
 * so the language switch, hreflang links and the sitemap all read from one list.
 * Spanish copy: neutral Latin American Spanish, "usted", and "conductor" for driver.
 */
import type { Metadata } from "next";

export type PublicLang = "en" | "es";

/** Pick the English or Spanish text. */
export function t<T>(lang: PublicLang, en: T, es: T): T {
  return lang === "es" ? es : en;
}

/**
 * English path → Spanish path, for every page that exists in both languages.
 * Add a pair here when a page gets its Spanish version (later: destinations, guides, blog).
 */
export const ES_PATHS: Record<string, string> = {
  "/about": "/es/nosotros",
  "/how-it-works": "/es/como-funciona",
  "/our-drivers": "/es/nuestros-conductores",
  "/faq": "/es/preguntas-frecuentes",
  "/contact": "/es/contacto",
};

const EN_PATHS: Record<string, string> = Object.fromEntries(
  Object.entries(ES_PATHS).map(([en, es]) => [es, en]),
);

/** English paths that have a Spanish version (for the sitemap). */
export const BILINGUAL_PATHS = Object.keys(ES_PATHS);

function splitPath(href: string): { path: string; rest: string } {
  const i = href.search(/[?#]/);
  const path = i === -1 ? href : href.slice(0, i);
  return { path: path.length > 1 ? path.replace(/\/+$/, "") : path, rest: i === -1 ? "" : href.slice(i) };
}

/** Which language a path is in. */
export function langOfPath(pathname: string): PublicLang {
  return pathname === "/es" || pathname.startsWith("/es/") ? "es" : "en";
}

/**
 * The link to use for an English page in `lang`: its Spanish version when one
 * exists, otherwise the English page (e.g. the booking app, which is English only).
 */
export function localizedHref(enHref: string, lang: PublicLang): string {
  if (lang === "en") return enHref;
  const { path, rest } = splitPath(enHref);
  const es = ES_PATHS[path];
  return es ? es + rest : enHref;
}

/** The same page in the other language, or null when it doesn't exist (the switch is then hidden). */
export function switchHref(pathname: string, to: PublicLang): string | null {
  const { path } = splitPath(pathname);
  const from = langOfPath(path);
  if (from === to) return path;
  return (to === "es" ? ES_PATHS[path] : EN_PATHS[path]) ?? null;
}

/**
 * canonical + hreflang (en, es, x-default) for a page that exists in both languages.
 * Pass the ENGLISH path; `lang` is the version being rendered.
 */
export function bilingualAlternates(enPath: string, lang: PublicLang): Metadata["alternates"] {
  const esPath = ES_PATHS[enPath];
  if (!esPath) return { canonical: enPath };
  return {
    canonical: lang === "es" ? esPath : enPath,
    languages: { en: enPath, es: esPath, "x-default": enPath },
  };
}
