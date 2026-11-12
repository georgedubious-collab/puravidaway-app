/**
 * Day tour pages: list, paths, look-ups, the token filler and the build-time check.
 * Text lives in ./content.ts (rules in ./types.ts); slugs in ./slugs.ts.
 * Everything about the tour itself (name, region, duration, highlights, prices) is read from
 * the catalog the page is given, so the pages, the booking app and /admin/pricing always agree.
 */
import { DAY_TOURS, HUB_IDS, HUB_REGION, perPersonTierCents, type DayTour, type HubId, type Region } from "../catalog";
import { BUILT_IN_CATALOG, type CatalogData } from "../catalogModel";
import { DESTINATION_GUIDES, FORBIDDEN_PUBLIC_WORDS, fillGuideText, type DestinationGuide } from "../guides/index";
import { applyMultiplier, formatUSDWhole } from "../pricing";
import type { PublicLang } from "../publicLang";
import { TOUR_CONTENT, TOURS_UPDATED } from "./content";
import { TOUR_SLUGS, TOURS_PATH, tourBookHref, tourPathFor } from "./slugs";
import type { L, TourPageContent } from "./types";

export { TOURS_PATH, TOURS_UPDATED, TOUR_SLUGS, tourBookHref, tourPathFor };
export type { TourPageContent };

export interface TourPage extends TourPageContent {
  slug: string;
}

/** Every tour page, in the catalog's built-in order. */
export const TOUR_PAGES: TourPage[] = TOUR_CONTENT.map((c) => ({ ...c, slug: TOUR_SLUGS[c.id] }));

export const tourPath = (p: Pick<TourPage, "slug">) => `${TOURS_PATH}/${p.slug}`;

export function tourPage(slug: string): TourPage | undefined {
  return TOUR_PAGES.find((p) => p.slug === slug);
}

export function tourPageFor(id: string): TourPage | undefined {
  return TOUR_PAGES.find((p) => p.id === id);
}

/** The live tour behind a page, or undefined when it is not (or no longer) active in the catalog. */
export function catalogTour(page: Pick<TourPage, "id">, catalog: CatalogData): DayTour | undefined {
  return catalog.dayTours.find((t) => t.id === page.id);
}

/** Pages whose tour is active in this catalog (an inactive tour's page is not listed or linked). */
export function activeTourPages(catalog: CatalogData): TourPage[] {
  return TOUR_PAGES.filter((p) => catalogTour(p, catalog));
}

/** Our towns in a tour region (Osa → Sierpe and Drake Bay), in the catalog's order. */
export function regionHubs(region: Region): HubId[] {
  return HUB_IDS.filter((h) => HUB_REGION[h] === region);
}

/** The destination guide of a tour region (La Fortuna, Manuel Antonio, Monteverde, Drake Bay & Sierpe). */
export function regionGuide(region: Region): DestinationGuide | undefined {
  return DESTINATION_GUIDES.find((g) => g.region === region);
}

/** The default (green) season's multiplier, in basis points. */
export function defaultSeasonBps(catalog: CatalogData): number {
  return catalog.seasons.find((s) => s.isDefault)?.multiplierBps ?? 10000;
}

/** Price per person for a group of `pax` at a season, whole dollars like the booking app's tour cards. */
export function tourPerPersonCents(tour: Pick<DayTour, "perPerson">, pax: number, seasonBps: number): number {
  return applyMultiplier(perPersonTierCents(tour.perPerson, pax), seasonBps);
}

/** "8 hours" / "8 horas", "7.5 hours" / "7,5 horas" (the booking app's wording). */
export function tourHours(hours: number, lang: PublicLang): string {
  return lang === "es" ? `${String(hours).replace(".", ",")} horas` : `${hours} hours`;
}

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function monthYear(iso: string, lang: PublicLang): string {
  const [y, m] = iso.split("-").map(Number);
  return lang === "es" ? `${MONTHS_ES[m - 1]} de ${y}` : `${MONTHS_EN[m - 1]} ${y}`;
}

/**
 * Fills a tour text: the tour tokens ({pp1}, {pp2}, {pp4}, {hours}, {enRoute}, {asof}) from the
 * live tour and season, then every guide token through fillGuideText(), which throws on
 * anything unknown.
 */
export function fillTourText(text: string, page: Pick<TourPage, "updated">, tour: DayTour, catalog: CatalogData, lang: PublicLang): string {
  const bps = defaultSeasonBps(catalog);
  const own = text.replace(/\{(pp1|pp2|pp4|hours|enRoute|asof)\}/g, (_token, kind: string) => {
    if (kind === "asof") return monthYear(page.updated, lang);
    if (kind === "hours") return tourHours(tour.durationHours, lang);
    if (kind === "enRoute") return formatUSDWhole(applyMultiplier(tour.enRouteUpgradeCents ?? 0, bps));
    return formatUSDWhole(tourPerPersonCents(tour, kind === "pp1" ? 1 : kind === "pp2" ? 2 : 4, bps));
  });
  return fillGuideText(own, catalog, lang);
}

/** Every text of a tour page, both languages, for the checks. */
export function tourTexts(p: TourPageContent): { where: string; en: string; es: string }[] {
  const out: { where: string; en: string; es: string }[] = [];
  const add = (where: string, t: L) => out.push({ where, en: t.en, es: t.es });
  for (const k of ["metaDescription", "answer", "intro", "start"] as const) add(k, p[k]);
  if (p.partsNote) add("partsNote", p.partsNote);
  p.parts.forEach((x, i) => {
    add(`part${i}.title`, x.title);
    add(`part${i}.text`, x.text);
  });
  p.bring.forEach((x, i) => add(`bring${i}`, x));
  p.goodToKnow.forEach((x, i) => add(`goodToKnow${i}`, x));
  p.faqs.forEach((f, i) => {
    add(`faq${i}.q`, f.q);
    add(`faq${i}.a`, f.a);
  });
  return out;
}

/** A clock time ("8:00", "7 am", "2 p.m.", "14 h"): the catalog has no timetable, so the pages never print one. */
const CLOCK_TIME = /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?(?:a\.?m\.?|p\.?m\.?)(?![a-z])/i;

/**
 * Build-time check: every page belongs to a tour of the built-in catalog and every built-in
 * tour has a page; unique slugs; a dated answer; 5–8 FAQs; a destination guide for the
 * region; no forbidden words, no clock times, and every token filled (with the catalog passed
 * in). Anything wrong throws, which fails `npm run build`.
 */
export function assertTourPages(pages: TourPage[], catalog: CatalogData): void {
  const slugs = new Set<string>();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  for (const p of pages) {
    const name = `Tour page ${p.id}`;
    const tour = catalog.dayTours.find((t) => t.id === p.id);
    if (!tour) throw new Error(`${name}: no tour with this id in the catalog`);
    if (!p.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) throw new Error(`${name}: missing or bad slug (src/lib/tours/slugs.ts)`);
    if (slugs.has(p.slug)) throw new Error(`${name}: duplicate slug`);
    slugs.add(p.slug);
    if (!iso.test(p.updated)) throw new Error(`${name}: bad date`);
    if (!p.answer.en.includes("{asof}") || !p.answer.es.includes("{asof}")) throw new Error(`${name}: the answer must be dated ({asof})`);
    if (p.faqs.length < 5 || p.faqs.length > 8) throw new Error(`${name}: ${p.faqs.length} FAQs (5 to 8 expected)`);
    if (p.parts.length < 2) throw new Error(`${name}: at least 2 parts of the day expected`);
    if (p.bring.length < 2) throw new Error(`${name}: "what to bring" needs at least 2 items`);
    if (!regionGuide(tour.region)) throw new Error(`${name}: no destination guide for region ${tour.region}`);
    if (regionHubs(tour.region).length === 0) throw new Error(`${name}: no town of ours in region ${tour.region}`);
    for (const t of tourTexts(p)) {
      for (const lang of ["en", "es"] as const) {
        const raw = t[lang];
        if (!raw.trim()) throw new Error(`${name}: empty ${lang} text at ${t.where}`);
        if (FORBIDDEN_PUBLIC_WORDS.test(raw)) throw new Error(`${name}: forbidden word in ${lang} text at ${t.where}`);
        if (CLOCK_TIME.test(raw)) throw new Error(`${name}: clock time in ${lang} text at ${t.where} (the catalog has no timetable)`);
        const filled = fillTourText(raw, p, tour, catalog, lang);
        if (/[{}]/.test(filled)) throw new Error(`${name}: unfilled token in ${lang} text at ${t.where}`);
      }
    }
  }
  for (const t of DAY_TOURS) {
    if (!pages.some((p) => p.id === t.id)) throw new Error(`Day tour ${t.id} has no page: add its slug (src/lib/tours/slugs.ts) and text (src/lib/tours/content.ts)`);
  }
  for (const id of Object.keys(TOUR_SLUGS)) {
    if (!pages.some((p) => p.id === id)) throw new Error(`Tour slug for ${id} has no page text in src/lib/tours/content.ts`);
  }
}

// Runs when the module loads, so a broken page fails `npm run build` (built-in catalog prices).
assertTourPages(TOUR_PAGES, BUILT_IN_CATALOG);
