/**
 * Day tour pages (/tours/<slug> and /es/tours/<slug>) are DATA, like the guides and the
 * route pages: English and Spanish side by side in one object per tour (./content.ts),
 * drawn by src/components/site/pages/TourPages.tsx.
 *
 * What comes from the CATALOG, never from this text (src/lib/catalog.ts defaults, the
 * database through catalogSource.ts, Spanish names in catalogEs.ts): the tour's name,
 * region, duration, highlights, the per-person prices for 1 / 2–3 / 4+ travellers, the
 * Smart En-Route Transfer price and the season multipliers. The text refers to them with
 * tokens, filled at build time:
 *   {pp1}      price per person for 1 traveller, default (green) season ("$350")
 *   {pp2}      price per person for 2–3 travellers ("$295")
 *   {pp4}      price per person for 4 or more travellers ("$275")
 *   {hours}    the tour's length ("8 hours" / "8 horas")
 *   {enRoute}  the Smart En-Route Transfer price per group, default season ("$65")
 *   {asof}     month and year the text was last checked ("November 2026"); required in `answer`
 * plus every guide token (src/lib/guides/types.ts): {time:A>B}, {price:A>B}, {cashFee}, {night}…
 * An unknown token fails the build.
 *
 * Writing rules (docs/PROJECT.md §10, docs/SEO.md §6, CLAUDE.md):
 * - Included items exactly as the site already states them: private vehicle with only your
 *   group, a local naturalist guide, entrances and lunch. Nothing else is promised.
 * - No clock times: the catalog has no timetable, so the day is described in parts.
 * - Park rules only as the destination guides already state them (reuse their wording through
 *   guideNote() in ./content.ts). Corcovado only as travel advice, never as something we sell.
 * - No "24/7"; never the owner or his other businesses; ICT permit only as a per-driver badge.
 * - Transfers and single-day tours only: no multi-day wording.
 * - Spanish: neutral Latin American, "usted", "conductor" / "guía"; written natively.
 */
import type { GuideFaq, L } from "../guides/types";

export type { GuideFaq, L };

export interface TourPageContent {
  /** Catalog id (DAY_TOURS in src/lib/catalog.ts / the day_tours table). */
  id: string;
  /** ISO date the text was last checked; shown on the page and in the structured data. */
  updated: string;
  /** <meta name="description">. */
  metaDescription: L;
  /** The dated direct answer under the H1 (first ~50 words). Must contain {asof}. */
  answer: L;
  /** A second paragraph: what the day is like. */
  intro: L;
  /** Where the day starts, in one or two sentences (honest: "tell us your hotel" when not fixed). */
  start: L;
  /** The parts of the day, in no promised order unless the catalog says so; no clock times. */
  parts: { title: L; text: L }[];
  /** One sentence under the parts (e.g. "the catamaran is in the afternoon"), optional. */
  partsNote?: L;
  /** Practical packing list. */
  bring: L[];
  /** Park rules and other facts worth knowing, reused word for word from the destination guides. */
  goodToKnow: L[];
  /** 5 to 8 questions about this tour, with FAQPage structured data. */
  faqs: GuideFaq[];
}
