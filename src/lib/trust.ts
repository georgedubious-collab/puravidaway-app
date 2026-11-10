/**
 * Trust content shown across the storefront and route pages.
 *
 * Rules (docs/PROJECT.md §10):
 * - Only real reviews of Costa Rica Private Transfers rides, each linked to where it was posted.
 *   Never reviews from Costa Rica Travel Planner, La Familia Mágica or Daytrip.
 * - Sections render nothing while their list is empty, so an empty list is the
 *   honest default until real reviews exist.
 * - Driver checks must describe what is actually done for EVERY partner driver.
 */
import { formatBpsPercent } from "./pricing";

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

/** TODO(owner): add real Costa Rica Private Transfers reviews as they come in. */
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
  "Drivers who hold a Costa Rica Tourism Institute (ICT) tourist-transport permit show an ICT badge on their profile, on your trip page once your driver is confirmed.";

/** Marketplace wording modelled on GetTransfer. Have a Costa Rican lawyer review before launch. */
export const CARRIER_NOTE =
  "Transportation is provided by independent partner drivers and transport companies, who are responsible for holding the licenses and permits required by applicable law.";

/** Spanish versions for the /es pages (same facts; keep in sync with the English ones). */
export const DRIVER_CHECKS_ES: string[] = [
  "Es entrevistado personalmente por nuestro equipo, incluido su nivel de inglés",
  "Pasa una verificación de antecedentes penales y de su historial de manejo",
  "Entrega la información del vehículo y el comprobante de su seguro",
  "Conoce nuestros estándares de servicio: recibirlo, esperar con su equipaje y mantenerlo informado",
];

export const ICT_BADGE_NOTE_ES =
  "Los conductores con permiso de transporte turístico del Instituto Costarricense de Turismo (ICT) muestran una insignia ICT en su perfil, en la página de su viaje cuando el conductor está confirmado.";

export const CARRIER_NOTE_ES =
  "El transporte lo brindan conductores y empresas de transporte asociados e independientes, responsables de contar con las licencias y permisos que exige la ley.";

export interface RidePromise {
  title: string;
  text: string;
  /** Only shown for pickups at an airport hub (AIRPORT_HUBS). */
  airportOnly?: boolean;
  href?: string;
}

/**
 * What every ride includes, shown on the ride builder and route pages.
 * ONLY promises the team confirmed it delivers (Jorge, 2026-11-08). Luggage
 * allowance is per vehicle (shown on each card). Never add a blanket
 * "English-speaking driver": a Spanish-speaking Economy class is planned, and
 * the driver's language is a per-ride request (docs/PROJECT.md §9 #10).
 */
export const RIDE_PROMISES: RidePromise[] = [
  {
    title: "Flight tracking",
    text: "On airport pickups we follow your flight, so a delay doesn't leave you stranded.",
    airportOnly: true,
  },
  {
    title: "60 min free waiting",
    text: "Your driver waits up to 60 minutes after your flight lands, or after your pickup time.",
  },
  {
    title: "Child seats free on request",
    text: "Tell us how many and the children's ages when you book.",
  },
  {
    title: "Free cancellation up to 24 h",
    text: "Cancel up to 24 hours before pickup at no cost.",
    href: "/cancellation",
  },
];

/** Promises for a ride from this pickup (flight tracking only at airports). */
export function ridePromises(pickupIsAirport: boolean): RidePromise[] {
  return RIDE_PROMISES.filter((p) => !p.airportOnly || pickupIsAirport);
}

export interface Guarantee {
  title: string;
  text: string;
  /** Optional "read more" link. */
  href?: string;
}

/**
 * Promises shown next to the send button and on route pages. Each must be true
 * today (docs/PROJECT.md §10):
 * - Cancellation (decided 2026-11-08): free up to 24 h before pickup for rides
 *   and day tours; full policy at /cancellation.
 * - Payment (decided 2026-11-08): online in full (link sent after the team
 *   confirms) or cash to the driver on rides and day tours, plus the cash
 *   booking fee from the database (pricing_settings, edited at /admin/pricing).
 *   Online payment isn't live yet, so never "pay now".
 */
export function guarantees(cashFeeBps: number): Guarantee[] {
  return [
    {
      title: "Price confirmed before you pay",
      text: "No surge, no fuel surcharge, nothing extra at the hotel door.",
    },
    {
      title: "Free cancellation up to 24 h before pickup",
      text: "On rides and day tours.",
      href: "/cancellation",
    },
    {
      title: "Your driver waits with your bags",
      text: "Luggage stays locked in the vehicle while you enjoy each stop.",
    },
    {
      title: "Pay online or in cash",
      text: `Pay online in full (we send a secure link once your trip is confirmed), or pay your driver in cash on rides and day tours with a ${formatBpsPercent(cashFeeBps)} cash booking fee.`,
    },
    {
      title: "A real person on WhatsApp",
      text: "Our team in Costa Rica answers, not a call center.",
    },
  ];
}
