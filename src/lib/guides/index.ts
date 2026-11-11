/**
 * Destination and airport guides: look-ups, links and the token filler.
 * Content lives in ./destinations.ts and ./airports.ts (rules in ./types.ts).
 */
import { nightSentence } from "../nightPremium";
import { DRAKE_BOAT_MINUTES, HUB_IDS, routeMinutes, type HubId } from "../catalog";
import type { CatalogData } from "../catalogModel";
import { formatBpsPercent, formatDuration, formatUSD } from "../pricing";
import type { PublicLang } from "../publicLang";
import { routeFromPrices } from "../routePrices";
import { AIRPORT_GUIDES } from "./airports";
import { DESTINATION_GUIDES } from "./destinations";
import type { AirportGuide, DestinationGuide } from "./types";

export { AIRPORT_GUIDES, DESTINATION_GUIDES };
export type { AirportGuide, DestinationGuide, GuideFaq, L, OtherWay } from "./types";

/** English paths; localizedHref() (src/lib/publicLang.ts) gives the Spanish ones. */
export const DESTINATIONS_PATH = "/destinations";
export const AIRPORTS_PATH = "/airports";
export const destinationPath = (g: Pick<DestinationGuide, "slug">) => `${DESTINATIONS_PATH}/${g.slug}`;
export const airportPath = (g: Pick<AirportGuide, "code">) => `${AIRPORTS_PATH}/${g.code}`;

export function destinationGuide(slug: string): DestinationGuide | undefined {
  return DESTINATION_GUIDES.find((g) => g.slug === slug);
}

export function airportGuide(code: string): AirportGuide | undefined {
  return AIRPORT_GUIDES.find((g) => g.code === code);
}

/** The destination guide that covers one of our towns (Sierpe → the Drake Bay guide), if any. */
export function destinationGuideForHub(hub: HubId): DestinationGuide | undefined {
  return DESTINATION_GUIDES.find((g) => g.hub === hub || g.alsoHubs?.includes(hub));
}

/** The airport guide of an airport hub, if any. */
export function airportGuideForHub(hub: HubId): AirportGuide | undefined {
  return AIRPORT_GUIDES.find((g) => g.hub === hub);
}

/**
 * "From" price of a ride between two of our towns, for the guides: the same
 * routeFromPrices() the route pages use. One difference, for honesty: a ride that
 * starts or ends in Drake Bay is priced with the vehicle option that includes the
 * river boat (the classes offered only on Sierpe / Drake Bay rides), because the
 * other classes end at the Sierpe dock.
 */
export function guideRidePrice(origin: HubId, destination: HubId, catalog: CatalogData) {
  const toDrake = origin === "DrakeBay" || destination === "DrakeBay";
  const withBoat = toDrake ? catalog.vehicles.filter((v) => v.onlyForHubs?.includes("DrakeBay")) : [];
  return routeFromPrices(origin, destination, withBoat.length ? { ...catalog, vehicles: withBoat } : catalog);
}

const isHub = (v: string): v is HubId => (HUB_IDS as readonly string[]).includes(v);

/**
 * Fills the tokens of a guide text from the live catalog (see ./types.ts):
 * {time:A>B}, {price:A>B}, {pax:A>B}, {boat}, {cashFee}, {night}. An unknown token or town
 * throws, so a typo fails the build instead of reaching a traveller.
 */
export function fillGuideText(text: string, catalog: CatalogData, lang: PublicLang): string {
  return text.replace(/\{([a-zA-Z]+)(?::([A-Za-z]+)>([A-Za-z]+))?\}/g, (token, kind: string, a?: string, b?: string) => {
    if (kind === "boat") return formatDuration(DRAKE_BOAT_MINUTES, lang);
    if (kind === "cashFee") return formatBpsPercent(catalog.cashFeeBps);
    if (kind === "night") return nightSentence(catalog.nightPremium, lang);
    if (!a || !b || !isHub(a) || !isHub(b)) throw new Error(`Guide text: unknown token ${token}`);
    if (kind === "time") return formatDuration(routeMinutes(a, b), lang);
    if (kind === "price") return formatUSD(guideRidePrice(a, b, catalog).fromCents);
    if (kind === "pax") return String(guideRidePrice(a, b, catalog).cheapest.maxPax);
    throw new Error(`Guide text: unknown token ${token}`);
  });
}
