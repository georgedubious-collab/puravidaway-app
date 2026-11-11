/**
 * Travel guides (the blog): /guides/<slug> (English) and /es/guias/<slug> (Spanish).
 *
 * An article is DATA: English and Spanish side by side in one object, drawn by
 * src/components/site/pages/BlogPages.tsx. Adding article 7 means adding one object to
 * src/lib/blog/articles*.ts and listing it in ARTICLES (src/lib/blog/index.ts); the page,
 * the index, the sitemap, llms.txt and the links from route pages and destination guides follow.
 *
 * Numbers are never typed into the text. They come from the catalog through the same tokens
 * as the destination guides (src/lib/guides/types.ts): {time:SJO>Arenal}, {km:SJO>Arenal},
 * {price:SJO>Arenal}, {pax:SJO>Arenal}, {boat}, {cashFee}, {night}; plus three for articles:
 *   {pp:A>B}     lowest price per traveller when a full vehicle is shared ("$47")
 *   {ppPax:A>B}  the group size that per-traveller price is based on ("7")
 *   {ppClass:A>B} the vehicle class that per-traveller price is based on ("Private Van")
 *   {class:A>B}  name of the cheapest vehicle class on that ride ("Economy Sedan")
 *   {asof}       month and year the article was last checked ("November 2026")
 * An unknown token or town fails the build (assertArticles in ./index.ts).
 *
 * Links inside a text: [label](/english/path). Always the ENGLISH path: the Spanish page
 * gets the Spanish address automatically. Every link must point to a page that exists
 * (checked at build time).
 *
 * Writing rules (docs/PROJECT.md §10, docs/SEO.md §6, CLAUDE.md):
 * - A dated direct answer first ({asof} is required in `answer`).
 * - Only facts that are true and checked. Timetables, fares, park prices, flight routes and
 *   entry rules change: describe them in general and say "check current times / prices".
 *   Never state Sierpe–Drake Bay boat times.
 * - Our service only as the site already states it (src/lib/trust.ts, src/lib/faq.ts): name sign
 *   at arrivals, flight tracking, 60 minutes of free waiting, pickups at any hour ({night}),
 *   child seats and boosters free on request, an electric vehicle "if available". No "24/7".
 *   ICT permit only as a per-driver badge.
 * - Never name the owner or his other businesses; no hotel names, no affiliate links.
 * - Transfers and single-day tours only: no multi-day trip content or links.
 * - Spanish: neutral Latin American, "usted", "conductor"; written natively.
 */
import type { HubId } from "../catalog";
import type { GuideFaq, L, OtherWay } from "../guides/types";
import type { PhotoId } from "../photos";

export type { GuideFaq, L, OtherWay };

/** One piece of an article section. Tokens and [links](/path) are allowed in every text. */
export type ArticleBlock =
  | { kind: "p"; text: L }
  | { kind: "list"; items: L[] }
  /** A comparison table: `head` is the first row; each row's first cell is its label. */
  | { kind: "table"; caption: L; head: L[]; rows: L[][] }
  /** Drive time + "from" price of rides between our towns (the guides' RidesTable). */
  | { kind: "rides"; caption: L; rows: { origin: HubId; destination: HubId; note?: L }[] }
  /** Every vehicle class on one ride: travellers, price per vehicle and per traveller. */
  | { kind: "classes"; origin: HubId; destination: HubId }
  /** Door-to-door drive times between the listed towns, as a grid. */
  | { kind: "matrix"; hubs: HubId[] }
  /** The honest alternatives, as cards (the guides' OtherWays). */
  | { kind: "ways"; ways: OtherWay[] }
  /** A highlighted "good to know" box. */
  | { kind: "note"; text: L };

export interface ArticleSection {
  /** Anchor id, unique within the article. */
  id: string;
  title: L;
  blocks: ArticleBlock[];
}

export interface Article {
  /** Same slug in both languages: /guides/<slug> and /es/guias/<slug>. */
  slug: string;
  /** ISO dates: first published, and last time the facts were checked. */
  published: string;
  updated: string;
  /** Optional picture from src/lib/photos.ts (our own photos or a placeholder; never stock). */
  photo?: PhotoId;
  /** H1, <title> and the schema headline. */
  title: L;
  /** Short label for cards, menus and the links from route pages ("San José to La Fortuna"). */
  short: L;
  metaDescription: L;
  /** One line on the index card. */
  teaser: L;
  /** The dated direct answer under the H1 (first ~50 words). Must contain {asof}. */
  answer: L;
  sections: ArticleSection[];
  /** 5 to 8 questions, shown at the end with FAQPage structured data. */
  faqs: GuideFaq[];
  /** The booking button: the trip builder pre-filled with this ride. */
  book: { origin: HubId; destination: HubId };
  /**
   * What the article is about, for the links back to it: route pages whose pickup and
   * drop-off are both in `hubPairs` (either direction) and destination / airport guides of
   * the towns in `hubs` show a link to it.
   */
  about: { hubPairs: [HubId, HubId][]; hubs: HubId[] };
  /** Related pages shown at the end as link pills (English paths). */
  related: string[];
}
