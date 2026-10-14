/**
 * Trust content shown across the storefront and route pages.
 *
 * Rules (docs/PROJECT.md §10):
 * - Only real reviews of PuraVidaWay rides, each linked to where it was posted.
 *   Never reviews from Costa Rica Travel Planner, La Familia Mágica or Daytrip.
 * - Sections render nothing while their list is empty, so an empty list is the
 *   honest default until real reviews exist.
 * - Driver checks must describe what is actually done for EVERY partner driver.
 */

export interface Review {
  quote: string;
  /** First name + initial, e.g. "Sarah J." */
  name: string;
  country: string;
  /** e.g. "Nov 2026" */
  month: string;
  /** Route or service the review is about, e.g. "SJO → Manuel Antonio" */
  route: string;
  source: "Google" | "Tripadvisor";
  /** Link to the review on its source. */
  url: string;
}

export interface RatingSource {
  name: "Google" | "Tripadvisor";
  rating: number;
  count: number;
  url: string;
}

/** TODO(owner): add real PuraVidaWay reviews as they come in. */
export const REVIEWS: Review[] = [];

/**
 * Aggregate ratings. Leave empty until a source has at least
 * MIN_REVIEWS_FOR_RATING reviews: a "5.0 from 2 reviews" badge hurts more than it helps.
 */
export const RATING_SOURCES: RatingSource[] = [];
export const MIN_REVIEWS_FOR_RATING = 10;

export function visibleRatingSources(): RatingSource[] {
  return RATING_SOURCES.filter((s) => s.count >= MIN_REVIEWS_FOR_RATING);
}

/** Wording modelled on Daytrip's driver page; see docs/COMPETITORS.md. */
export const DRIVER_CHECKS: string[] = [
  "Is personally interviewed by our team, English level included",
  "Passes a background check of their criminal and driving records",
  "Submits vehicle information and proof of insurance",
  "Is trained in our service standards: meeting you, waiting with your luggage, keeping you updated",
];

export const ICT_BADGE_NOTE =
  "Drivers holding a Costa Rica Tourism Institute (ICT) transport permit show an ICT badge on their profile.";

/** Marketplace wording modelled on GetTransfer. Have a Costa Rican lawyer review before launch. */
export const CARRIER_NOTE =
  "Transportation is provided by independent partner drivers and transport companies, who are responsible for holding the licenses and permits required by applicable law.";

/**
 * Promises shown next to the pay button. Cancellation terms are deliberately
 * missing: that policy is still an open decision (docs/PROJECT.md §9 #7).
 */
export const GUARANTEES: { title: string; text: string }[] = [
  {
    title: "Price locked when you book",
    text: "No surge, no fuel surcharge, nothing extra at the hotel door.",
  },
  {
    title: "Your driver waits with your bags",
    text: "Luggage stays locked in the vehicle while you enjoy each stop.",
  },
  {
    title: "Pay 20% now",
    text: "Hold your drivers and permits with a deposit, pay the rest before you travel.",
  },
  {
    title: "A real person on WhatsApp",
    text: "Our team in Costa Rica answers, not a call center.",
  },
];
