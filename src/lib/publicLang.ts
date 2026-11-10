/**
 * Language of the PUBLIC website (not /admin or /driver, which use src/lib/teamLang.ts).
 *
 * English lives at the normal URLs; Spanish pages live under /es with their own
 * Spanish slugs. Every public page has a Spanish version: ES_PATHS (home, info and
 * legal pages) plus the route pages by prefix. The language switch, hreflang links
 * and the sitemap all read from here.
 * Spanish copy: neutral Latin American Spanish, "usted", and "conductor" for driver.
 */
import type { Metadata } from "next";

export type PublicLang = "en" | "es";

/** Pick the English or Spanish text. */
export function t<T>(lang: PublicLang, en: T, es: T): T {
  return lang === "es" ? es : en;
}

/**
 * English path → Spanish path, for every page that exists in both languages:
 * the booking app (home), the info pages and the legal pages. Route pages are
 * matched by prefix below (/transfers/<slug> ↔ /es/traslados/<slug>, same slug).
 * Add a pair here when a page gets its Spanish version (later: destinations, guides, blog).
 */
export const ES_PATHS: Record<string, string> = {
  "/": "/es",
  "/about": "/es/nosotros",
  "/how-it-works": "/es/como-funciona",
  "/our-drivers": "/es/nuestros-conductores",
  "/faq": "/es/preguntas-frecuentes",
  "/contact": "/es/contacto",
  "/terms": "/es/terminos",
  "/privacy": "/es/privacidad",
  "/cancellation": "/es/cancelacion",
};

const EN_PATHS: Record<string, string> = Object.fromEntries(
  Object.entries(ES_PATHS).map(([en, es]) => [es, en]),
);

/** Route landing pages: the same slug under each language's folder. */
export const EN_ROUTE_PREFIX = "/transfers/";
export const ES_ROUTE_PREFIX = "/es/traslados/";

/** English info pages with a Spanish version (the sitemap lists home, legal and route pages separately). */
export const BILINGUAL_PATHS = ["/about", "/how-it-works", "/our-drivers", "/faq", "/contact"];

function splitPath(href: string): { path: string; rest: string } {
  const i = href.search(/[?#]/);
  const path = i === -1 ? href : href.slice(0, i);
  return { path: path.length > 1 ? path.replace(/\/+$/, "") : path, rest: i === -1 ? "" : href.slice(i) };
}

/** Which language a path is in. */
export function langOfPath(pathname: string): PublicLang {
  return pathname === "/es" || pathname.startsWith("/es/") ? "es" : "en";
}

/** The Spanish path of an English path (no query), or null when the page has no Spanish version. */
export function esPathOf(enPath: string): string | null {
  if (ES_PATHS[enPath]) return ES_PATHS[enPath];
  if (enPath.startsWith(EN_ROUTE_PREFIX) && enPath.length > EN_ROUTE_PREFIX.length) {
    return ES_ROUTE_PREFIX + enPath.slice(EN_ROUTE_PREFIX.length);
  }
  return null;
}

/** The English path of a Spanish path (no query), or null. */
export function enPathOf(esPath: string): string | null {
  if (EN_PATHS[esPath]) return EN_PATHS[esPath];
  if (esPath.startsWith(ES_ROUTE_PREFIX) && esPath.length > ES_ROUTE_PREFIX.length) {
    return EN_ROUTE_PREFIX + esPath.slice(ES_ROUTE_PREFIX.length);
  }
  return null;
}

/**
 * The link to use for an English page in `lang`: its Spanish version when one
 * exists (the query string and #anchor are kept, e.g. /?tab=tours → /es?tab=tours),
 * otherwise the English page (e.g. /driver, /trip, /login).
 */
export function localizedHref(enHref: string, lang: PublicLang): string {
  if (lang === "en") return enHref;
  const { path, rest } = splitPath(enHref);
  const es = esPathOf(path);
  return es ? es + rest : enHref;
}

/**
 * The same page in the other language (query string and #anchor kept), or null
 * when it doesn't exist (the switch is then hidden).
 */
export function switchHref(href: string, to: PublicLang): string | null {
  const { path, rest } = splitPath(href);
  const from = langOfPath(path);
  if (from === to) return path + rest;
  const other = to === "es" ? esPathOf(path) : enPathOf(path);
  return other ? other + rest : null;
}

/**
 * canonical + hreflang (en, es, x-default) for a page that exists in both languages.
 * Pass the ENGLISH path; `lang` is the version being rendered.
 */
export function bilingualAlternates(enPath: string, lang: PublicLang): Metadata["alternates"] {
  const esPath = esPathOf(enPath);
  if (!esPath) return { canonical: enPath };
  return {
    canonical: lang === "es" ? esPath : enPath,
    languages: { en: enPath, es: esPath, "x-default": enPath },
  };
}
