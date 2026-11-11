/**
 * Route pages (/transfers/<slug> and /es/traslados/<slug>) are DATA, like the guides
 * (src/lib/guides/types.ts, whose writing rules apply here too):
 *
 *   hubs.ts       one block per town or airport: names, the pickup and arrival FAQ
 *   corridors.ts  one block per pair of towns: the road, the other ways to travel, FAQs,
 *                 and a few lines for each direction
 *   ../routePages.ts  puts them together: every corridor becomes two pages (A → B and B → A)
 *
 * To add a route, add one corridor to corridors.ts. Titles, slugs, the dated direct answer,
 * prices, drive times, stops, links, the index page, sitemap and llms.txt follow from it.
 *
 * Numbers are never typed: use the guide tokens ({time:SJO>Arenal}, {km:SJO>Arenal},
 * {price:SJO>Arenal}, {pax:SJO>Arenal}, {boat}, {cashFee}, {night}); a mistyped token fails
 * the build. Never state boat timetables, bus timetables, fares or terminals.
 */
import type { HubId } from "../catalog";
import type { L, OtherWay } from "../guides/types";

export interface RouteFaq {
  q: L;
  a: L;
}

export interface HubBlock {
  /** Part of the page slug: "sjo-airport", "la-fortuna". */
  slug: string;
  /** Name in titles: "SJO Airport", "La Fortuna (Arenal)". Spanish titles use esFrom / esTo. */
  name: L;
  /** Spanish with its preposition: "del aeropuerto SJO" / "al aeropuerto SJO". */
  esFrom: string;
  esTo: string;
  /** Longer name for descriptions: "San José airport (SJO)"; Spanish again with prepositions. */
  long: string;
  esFromLong: string;
  esToLong: string;
  /** Where the ride starts or ends there: "your hotel in Manuel Antonio or Quepos". */
  place: L;
  /** FAQ shown when the ride STARTS here. */
  pickupFaq: (origin: HubId, destination: HubId) => RouteFaq;
  /** FAQ shown when the ride ENDS here. */
  arrivalFaq: (origin: HubId, destination: HubId) => RouteFaq;
}

/** What is different in one direction of a corridor. */
export interface Direction {
  /** One or two sentences after the direct answer. */
  lead: L;
  faq: RouteFaq;
}

export interface Corridor {
  a: HubId;
  b: HubId;
  /** Only for pages that existed before 2026-11-11 under another slug (a → b). */
  legacySlug?: string;
  /** ISO date the facts were last checked. */
  updated: string;
  /** Short phrase for the meta description: what is special about this ride. */
  hook: L;
  /** The road between the two, written so it reads right in both directions. */
  road: L;
  /** Shown above the stop list, when the stops offered need explaining. */
  stopsNote?: L;
  /** Bus, shared shuttle, flight, rental car: general facts only, nothing that goes out of date. */
  ways: OtherWay[];
  /** Questions about this pair, shown in both directions. */
  faqs: RouteFaq[];
  /** a → b and b → a. */
  ab: Direction;
  ba: Direction;
}
