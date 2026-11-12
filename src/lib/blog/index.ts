/**
 * Travel guides (the blog): list, paths, look-ups, the token filler and the build-time check.
 * Content lives in ./articles*.ts (rules in ./types.ts).
 */
import { HUB_IDS, routeMinutes, type HubId } from "../catalog";
import { BUILT_IN_CATALOG, type CatalogData } from "../catalogModel";
import {
  AIRPORT_GUIDES,
  AIRPORTS_PATH,
  DESTINATION_GUIDES,
  DESTINATIONS_PATH,
  FORBIDDEN_PUBLIC_WORDS,
  airportPath,
  destinationPath,
  fillGuideText,
} from "../guides/index";
import { formatUSD } from "../pricing";
import { BILINGUAL_PATHS, type PublicLang } from "../publicLang";
import { ROUTE_PAGES, TRANSFERS_PATH, routePath } from "../routePages";
import { pageFromPrices } from "../routePrices";
import { LEGAL_PATHS } from "../site";
import { ARTICLES_PLANNING } from "./articlesPlanning";
import { ARTICLES_ROUTES } from "./articlesRoutes";
import type { Article, ArticleBlock } from "./types";

export type { Article, ArticleBlock, ArticleSection } from "./types";

/** Every article, in the order of the index page (docs/SEO.md §5 priority). */
export const ARTICLES: Article[] = [...ARTICLES_ROUTES, ...ARTICLES_PLANNING];

/** English paths; localizedHref() (src/lib/publicLang.ts) gives the Spanish ones (/es/guias…). */
export const BLOG_PATH = "/guides";
export const articlePath = (a: Pick<Article, "slug">) => `${BLOG_PATH}/${a.slug}`;

export function article(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/** Articles about the ride between these two towns (either direction). */
export function articlesForPair(a: HubId, b: HubId): Article[] {
  return ARTICLES.filter((x) => x.about.hubPairs.some(([p, q]) => (p === a && q === b) || (p === b && q === a)));
}

/** Articles about any of these towns (for the destination and airport guides). */
export function articlesForHubs(hubs: HubId[]): Article[] {
  return ARTICLES.filter((x) => x.about.hubs.some((h) => hubs.includes(h)));
}

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "November 2026" / "noviembre de 2026". */
export function monthYear(iso: string, lang: PublicLang): string {
  const [y, m] = iso.split("-").map(Number);
  return lang === "es" ? `${MONTHS_ES[m - 1]} de ${y}` : `${MONTHS_EN[m - 1]} ${y}`;
}

const isHub = (v: string): v is HubId => (HUB_IDS as readonly string[]).includes(v);

/**
 * Fills an article text: the article tokens ({pp}, {ppPax}, {class}, {asof}) here, then
 * every guide token through fillGuideText(), which throws on anything unknown.
 */
export function fillArticleText(text: string, art: Pick<Article, "updated">, catalog: CatalogData, lang: PublicLang): string {
  const own = text.replace(/\{(pp|ppPax|ppClass|class|asof)(?::([A-Za-z]+)>([A-Za-z]+))?\}/g, (token, kind: string, a?: string, b?: string) => {
    if (kind === "asof") return monthYear(art.updated, lang);
    if (!a || !b || !isHub(a) || !isHub(b)) throw new Error(`Article text: unknown token ${token}`);
    const price = pageFromPrices(a, b, catalog);
    if (kind === "pp") return formatUSD(price.perPersonCents);
    if (kind === "ppPax") return String(price.share);
    if (kind === "ppClass") return price.perPersonVehicle.name;
    return price.cheapest.name;
  });
  return fillGuideText(own, catalog, lang);
}

/** A text split into plain parts and [label](/path) links. */
export type TextPart = { text: string } | { label: string; href: string };

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ label: m[1], href: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Every public English path an article may link to. */
export function knownPaths(): Set<string> {
  return new Set([
    "/",
    "/?tab=transfers",
    "/?tab=tours",
    ...BILINGUAL_PATHS,
    ...LEGAL_PATHS,
    TRANSFERS_PATH,
    ...ROUTE_PAGES.map((p) => routePath(p)),
    DESTINATIONS_PATH,
    ...DESTINATION_GUIDES.map((g) => destinationPath(g)),
    AIRPORTS_PATH,
    ...AIRPORT_GUIDES.map((g) => airportPath(g)),
    BLOG_PATH,
    ...ARTICLES.map((a) => articlePath(a)),
  ]);
}

/** Every text of an article, both languages, for the checks. */
export function articleTexts(a: Article): { where: string; en: string; es: string }[] {
  const out: { where: string; en: string; es: string }[] = [];
  const add = (where: string, t: { en: string; es: string }) => out.push({ where, en: t.en, es: t.es });
  for (const k of ["title", "short", "metaDescription", "teaser", "answer"] as const) add(k, a[k]);
  const blockTexts = (where: string, b: ArticleBlock) => {
    if (b.kind === "p" || b.kind === "note") add(where, b.text);
    else if (b.kind === "list") b.items.forEach((x, i) => add(`${where}.${i}`, x));
    else if (b.kind === "table") {
      add(`${where}.caption`, b.caption);
      b.head.forEach((x, i) => add(`${where}.head${i}`, x));
      b.rows.forEach((r, i) => r.forEach((x, j) => add(`${where}.r${i}c${j}`, x)));
    } else if (b.kind === "rides") {
      add(`${where}.caption`, b.caption);
      b.rows.forEach((r, i) => r.note && add(`${where}.note${i}`, r.note));
    } else if (b.kind === "ways") b.ways.forEach((w, i) => add(`${where}.way${i}`, w.text));
  };
  a.sections.forEach((s) => {
    add(`${s.id}.title`, s.title);
    s.blocks.forEach((b, i) => blockTexts(`${s.id}.${i}`, b));
  });
  a.faqs.forEach((f, i) => {
    add(`faq${i}.q`, f.q);
    add(`faq${i}.a`, f.a);
  });
  return out;
}

/**
 * Build-time check, like the route pages': unique slugs, required fields, a dated answer,
 * 5–8 FAQs, every ride between two of our towns with a drive time, every link to a page
 * that exists, no forbidden words, and every token filled (with the built-in catalog,
 * passed in by the caller). Anything wrong throws, which fails `npm run build`.
 */
export function assertArticles(articles: Article[], catalog: CatalogData): void {
  const slugs = new Set<string>();
  const paths = knownPaths();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  for (const a of articles) {
    const name = `Article ${a.slug}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) throw new Error(`${name}: bad slug`);
    if (slugs.has(a.slug)) throw new Error(`${name}: duplicate slug`);
    slugs.add(a.slug);
    if (!iso.test(a.published) || !iso.test(a.updated) || a.updated < a.published) throw new Error(`${name}: bad dates`);
    if (!a.answer.en.includes("{asof}") || !a.answer.es.includes("{asof}")) throw new Error(`${name}: the answer must be dated ({asof})`);
    if (a.faqs.length < 5 || a.faqs.length > 8) throw new Error(`${name}: ${a.faqs.length} FAQs (5 to 8 expected)`);
    if (a.sections.length < 3) throw new Error(`${name}: at least 3 sections expected`);
    const ids = new Set<string>();
    for (const s of a.sections) {
      if (ids.has(s.id)) throw new Error(`${name}: duplicate section id ${s.id}`);
      ids.add(s.id);
      for (const b of s.blocks) {
        const pairs =
          b.kind === "rides" ? b.rows.map((r) => [r.origin, r.destination] as const) : b.kind === "classes" ? [[b.origin, b.destination] as const] : [];
        for (const [o, d] of pairs) if (o === d || !(routeMinutes(o, d) > 0)) throw new Error(`${name}: no drive time for ${o} → ${d}`);
        if (b.kind === "table" && b.rows.some((r) => r.length !== b.head.length)) throw new Error(`${name}: table row length differs from its head`);
      }
    }
    if (a.book.origin === a.book.destination) throw new Error(`${name}: booking ride has the same pickup and drop-off`);
    for (const p of a.related) if (!paths.has(p)) throw new Error(`${name}: related link to unknown page ${p}`);
    for (const t of articleTexts(a)) {
      for (const lang of ["en", "es"] as const) {
        const raw = t[lang];
        if (!raw.trim()) throw new Error(`${name}: empty ${lang} text at ${t.where}`);
        if (FORBIDDEN_PUBLIC_WORDS.test(raw)) throw new Error(`${name}: forbidden word in ${lang} text at ${t.where}`);
        for (const part of splitLinks(raw)) {
          if ("href" in part && !paths.has(part.href)) throw new Error(`${name}: link to unknown page ${part.href} (${lang}, ${t.where})`);
        }
        const filled = fillArticleText(raw, a, catalog, lang);
        if (/[{}]/.test(filled)) throw new Error(`${name}: unfilled token in ${lang} text at ${t.where}`);
      }
    }
  }
}

// Runs when the module loads, so a broken article fails `npm run build` (built-in catalog prices).
assertArticles(ARTICLES, BUILT_IN_CATALOG);
