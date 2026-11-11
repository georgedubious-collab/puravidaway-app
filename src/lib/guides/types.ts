/**
 * Destination guides (/destinations/<slug>) and airport guides (/airports/<code>).
 *
 * A guide is DATA: English and Spanish side by side in one object. The pages
 * (src/components/site/pages/DestinationGuidePage.tsx and AirportGuidePage.tsx)
 * draw every guide the same way, so adding a destination means adding one object
 * to src/lib/guides/destinations.ts, never a new component.
 *
 * Numbers are never typed into the text. Drive times and prices come from the
 * catalog (the same source as the route pages and the trip builder) through tokens:
 *   {time:SJO>Arenal}   door-to-door time between two of our towns ("2 hr 45 min")
 *   {price:SJO>Arenal}  cheapest private car on that ride at the default (green) season ("$162")
 *   {boat}              the Sierpe → Drake Bay boat time
 *   {cashFee}           the cash booking fee ("10%")
 * See fillGuideText() in src/lib/guides/index.ts.
 *
 * Writing rules (docs/PROJECT.md §10, docs/SEO.md §6):
 * - Only facts that are true and checked. Things that change often (bus timetables,
 *   fares, flight routes, park prices) are described in general, with "check current times".
 * - Nothing about our service that the rest of the site doesn't already say (src/lib/trust.ts,
 *   src/lib/faq.ts). No "24/7". ICT permits are a per-driver badge, never a site-wide promise.
 * - Never name the owner or his other businesses. No hotel names, no affiliate links.
 * - Spanish: neutral Latin American, "usted", "conductor"; written natively.
 */
import type { HubId, Region } from "../catalog";
import type { PhotoId } from "../photos";
import type { PublicLang } from "../publicLang";

/** A text in both languages. */
export type L = Record<PublicLang, string>;

export interface GuideFaq {
  q: L;
  a: L;
}

/** One way of travelling that isn't a private transfer. */
export interface OtherWay {
  kind: "bus" | "shuttle" | "flight" | "car" | "taxi" | "rideshare";
  /** Honest trade-offs; no timetables, fares or route lists that go out of date. */
  text: L;
}

export interface DestinationGuide {
  /** Same slug in both languages: /destinations/<slug> and /es/destinos/<slug>. */
  slug: string;
  /** Our town for this destination: drive times, prices and the booking link use it. */
  hub: HubId;
  /** Other towns of ours that belong to the same guide (Sierpe for Drake Bay). */
  alsoHubs?: HubId[];
  /** Region of our day tours and multi-day trips that start here, if any. */
  region?: Region;
  photo: PhotoId;
  /** ISO date the text was last checked; shown on the page and in the structured data. */
  updated: string;
  /** Short name for menus, cards and breadcrumbs. */
  name: L;
  /** H1 and <title>. */
  title: L;
  metaDescription: L;
  /** One line under the name on the index card. */
  teaser: L;
  /** The direct answer under the H1 (tokens allowed): how to get there, how long, from how much. */
  answer: L;
  /** Second paragraph: what the place is. */
  intro: L;
  /**
   * Rows of the "How to get there" table, as pickup → drop-off pairs of our towns.
   * The first rows are the two airports.
   */
  rides: { origin: HubId; destination: HubId; note?: L }[];
  /** Which airport to fly into, and what each drive is like. */
  airports: L;
  otherWays: OtherWay[];
  bestTime: { dry: L; green: L; note?: L };
  thingsToDo: { title: L; text: L }[];
  /** Permits, tickets and other rules worth knowing before going. */
  goodToKnow?: L[];
  /** Where to stay by area: neighbourhoods only, never hotel names. */
  areas: { name: L; text: L }[];
  faqs: GuideFaq[];
}

export interface AirportGuide {
  /** IATA code in lower case: /airports/<code> and /es/aeropuertos/<code>. */
  code: string;
  hub: Extract<HubId, "SJO" | "LIR">;
  iata: string;
  updated: string;
  /** Short name for menus and cards. */
  name: L;
  /** Official name, for the structured data. */
  officialName: string;
  /** Town the airport is in, for the structured data. */
  locality: string;
  title: L;
  metaDescription: L;
  teaser: L;
  answer: L;
  intro: L;
  /** Our towns shown in the "popular rides" table, in order. */
  rides: HubId[];
  /** How the pickup works. Generic until the exact meeting points are confirmed. */
  pickup: L[];
  otherWays: OtherWay[];
  tips: { title: L; text: L }[];
  faqs: GuideFaq[];
}
