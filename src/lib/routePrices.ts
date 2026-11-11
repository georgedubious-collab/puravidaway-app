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

/**
 * The vehicle classes the public pages (route pages and guides) show for a ride. One rule,
 * for honesty: a ride that starts or ends in Drake Bay shows only the classes that include
 * the river boat (those offered only on Sierpe / Drake Bay rides), because the other classes
 * end at the Sierpe dock.
 */
export function pageVehicles(origin: HubId, destination: HubId, catalog: CatalogData): CatalogData["vehicles"] {
  const touches = (hubs?: string[]) => !hubs || hubs.includes(origin) || hubs.includes(destination);
  const fitting = catalog.vehicles.filter((v) => touches(v.onlyForHubs));
  const toDrake = origin === "DrakeBay" || destination === "DrakeBay";
  const withBoat = toDrake ? fitting.filter((v) => v.onlyForHubs?.includes("DrakeBay")) : [];
  if (withBoat.length) return withBoat;
  return fitting.length ? fitting : catalog.vehicles;
}

/** "From" prices of a ride as the public pages show them (see pageVehicles). */
export function pageFromPrices(origin: HubId, destination: HubId, catalog: CatalogData) {
  return routeFromPrices(origin, destination, { ...catalog, vehicles: pageVehicles(origin, destination, catalog) });
}

/** Every class shown for the ride with its price for the whole vehicle at the default (green) season, cheapest first. */
export function pageVehiclePrices(origin: HubId, destination: HubId, catalog: CatalogData) {
  const bps = catalog.seasons.find((x) => x.isDefault)?.multiplierBps ?? 10000;
  return pageVehicles(origin, destination, catalog)
    .map((vehicle) => ({ vehicle, cents: applyMultiplier(rideCents(origin, destination, vehicle, catalog), bps) }))
    .sort((a, b) => a.cents - b.cents);
}
