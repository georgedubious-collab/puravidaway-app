/**
 * Page address of each day tour, by catalog id (/tours/<slug> and /es/tours/<slug>).
 * Kept in this tiny file, apart from the page text in ./content.ts, so the booking app
 * (a browser component) can link a tour card to its page without loading the page text.
 * A tour added later in /admin/pricing has no page until it gets a slug here and its text
 * in ./content.ts (the build checks the two match).
 */
export const TOUR_SLUGS: Record<string, string> = {
  dt1: "arenal-volcano-waterfall-hot-springs",
  dt2: "manuel-antonio-park-catamaran",
  dt3: "sierpe-mangroves-cano-island",
  dt4: "monteverde-hanging-bridges-zipline-night-walk",
};

/** English path of the index of all day tours (Spanish: /es/tours). */
export const TOURS_PATH = "/tours";

/** English path of a tour's page, or null when the tour has none yet; localizedHref() gives the Spanish one. */
export function tourPathFor(id: string): string | null {
  const slug = TOUR_SLUGS[id];
  return slug ? `${TOURS_PATH}/${slug}` : null;
}

/** The booking app on the Day tours tab with this tour picked out (Storefront reads ?tour=). */
export function tourBookHref(id: string): string {
  return `/?tab=tours&tour=${encodeURIComponent(id)}`;
}
