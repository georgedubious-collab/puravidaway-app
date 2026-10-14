/**
 * Route landing pages (/transfers/[slug]): the "website" layer that ranks on
 * Google and drops travelers into the trip builder with the ride pre-filled.
 * Prices, drive times and stops come from the catalog so they never drift.
 */
import type { HubId } from "./catalog";

export interface RoutePage {
  slug: string;
  origin: HubId;
  destination: HubId;
  /** H1 and <title> */
  title: string;
  metaDescription: string;
  intro: string;
  /** Hotel-area hint for the CTA, e.g. "Manuel Antonio or Quepos" */
  areaLabel: string;
  driveTitle: string;
  drive: string;
  faqs: { q: string; a: string }[];
  related: { label: string; origin: HubId; destination: HubId }[];
}

export const ROUTE_PAGES: RoutePage[] = [
  {
    slug: "sjo-airport-to-manuel-antonio",
    origin: "SJO",
    destination: "ManuelAntonio",
    title: "Private transfer from SJO Airport to Manuel Antonio",
    metaDescription:
      "Private door-to-door ride from San José airport (SJO) to Manuel Antonio and Quepos. Fixed price per vehicle, optional crocodile bridge and macaw stops, local partner drivers.",
    intro:
      "Your driver meets you at arrivals and takes you straight to your hotel door. Turn the drive into part of the trip with a stop at the Tárcoles crocodile bridge or a macaw walk in Carara.",
    areaLabel: "Manuel Antonio or Quepos",
    driveTitle: "What the drive is like",
    drive:
      "From the airport you take Route 27 west and down to the Pacific at Orotina, then follow the Costanera Sur along the coast past Jacó and the oil-palm plantations around Parrita into Quepos. The last stretch climbs the hill road to Manuel Antonio's hotels. Weekend and holiday traffic on Route 27 can add an hour, so plan pickups with that in mind.",
    faqs: [
      {
        q: "Private transfer or shared shuttle?",
        a: "Shared shuttles run fixed times and stop at other hotels. A private ride leaves when you are ready, carries only your group and stops only where you want.",
      },
      {
        q: "Is the price per person?",
        a: "No. The price is for the whole vehicle, so it stays the same whether you are one traveler or four.",
      },
      {
        q: "What happens to our luggage at the stops?",
        a: "It stays locked in the vehicle and your driver waits with it while you visit the stop.",
      },
      {
        q: "How do we pay?",
        a: "Pay 20% now to hold your ride and the rest before you travel, or pay in full. We confirm everything with you on WhatsApp.",
      },
    ],
    related: [
      { label: "SJO → La Fortuna / Arenal", origin: "SJO", destination: "Arenal" },
      { label: "SJO → Monteverde", origin: "SJO", destination: "Monteverde" },
      { label: "SJO → Puerto Viejo", origin: "SJO", destination: "PuertoViejo" },
      { label: "SJO → Sierpe (Drake Bay boat)", origin: "SJO", destination: "Sierpe" },
      { label: "Manuel Antonio → La Fortuna", origin: "ManuelAntonio", destination: "Arenal" },
    ],
  },
];

export function routePage(slug: string): RoutePage | undefined {
  return ROUTE_PAGES.find((p) => p.slug === slug);
}

export function builderHref(origin: HubId, destination: HubId): string {
  return `/?from=${origin}&to=${destination}`;
}
