import type { HubId } from "./catalog";
import type { CatalogData } from "./catalogModel";
import { applyMultiplier, perPersonCents, perPersonShare, rideCents } from "./pricing";

/**
 * "From" prices of a ride between two of our towns, as shown on route pages and
 * on the home page's "Popular routes" cards: the cheapest vehicle offered on the
 * route at the default (green) season, and the lowest price per seat when a car
 * is shared by a full group (Daytrip-style "from $X per person").
 */
export function routeFromPrices(origin: HubId, destination: HubId, catalog: CatalogData) {
  const touches = (hubs?: string[]) => !hubs || hubs.includes(origin) || hubs.includes(destination);
  const fitting = catalog.vehicles.filter((v) => touches(v.onlyForHubs));
  const vehicles = fitting.length ? fitting : catalog.vehicles;
  const defaultSeason = catalog.seasons.find((x) => x.isDefault);
  const carCents = (v: (typeof vehicles)[number]) =>
    applyMultiplier(rideCents(origin, destination, v, catalog), defaultSeason?.multiplierBps ?? 10000);
  const cheapest = vehicles.reduce((a, b) => (carCents(b) < carCents(a) ? b : a));
  const perPerson = vehicles
    .map((v) => ({ v, cents: perPersonCents(carCents(v), v.maxPax) }))
    .reduce((a, b) => (b.cents < a.cents ? b : a));
  return {
    /** Cheapest vehicle class on this route. */
    cheapest,
    /** Its price for the whole car, in cents. */
    fromCents: carCents(cheapest),
    /** Lowest price per traveller, in cents, and the class and group size it is based on. */
    perPersonCents: perPerson.cents,
    perPersonVehicle: perPerson.v,
    share: perPersonShare(perPerson.v.maxPax),
    defaultSeason,
  };
}
