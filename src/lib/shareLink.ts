/**
 * Shareable ride links: the ride builder's choices live in the page address
 * (e.g. /?from=SJO&to=ManuelAntonio&date=2026-12-02&time=10:30&pax=3&vehicle=suv&stops=tarcoles),
 * so a link can be sent to a travel companion, a host or a hotel and opens the
 * same ride. Only route choices go in the URL: never names, contact details,
 * flight numbers, notes or offers.
 *
 * A typed place (hotel, dock, address) is shared as its Google place id, the
 * name the traveller saw and its map point:
 *   ?from=ChIJJ9uN…&fromName=Arenas+Del+Mar…&fromAt=9.39838,-84.16080
 * The map point only places it in the right town on screen; the price is always
 * worked out from the place id on the server.
 *
 * Everything read back is checked against the catalog; anything unknown is
 * ignored and the builder falls back to its defaults. The older ?from=&to=
 * links from route pages keep working.
 */
import { HUBS, type HubId } from "./catalog";
import { areaOf, cleanPlaceLabel, hubPlace, inCostaRica, isGooglePlaceId, isHubPlace, nearestHub, type RidePlace } from "./places";
import type { CatalogData } from "./catalogModel";
import { isValidPickupTime, isValidYmd } from "./dates";

export const MAX_SHARED_PAX = 10;

export interface RideLinkState {
  origin: RidePlace;
  destination: RidePlace;
  date: string;
  pickupTime: string;
  pax: number;
  vehicleId: string;
  stopIds: string[];
}

/** Read and validate ride choices from a URL. Fields that are missing or invalid are left out. */
export function parseRideLink(
  params: { get(name: string): string | null },
  catalog: CatalogData,
  today: string,
): Partial<RideLinkState> {
  const out: Partial<RideLinkState> = {};
  const from = readPlace(params, "from");
  const to = readPlace(params, "to");
  if (from) out.origin = from;
  if (to) out.destination = to;

  const date = params.get("date");
  if (date && isValidYmd(date) && date >= today) out.date = date;

  const time = params.get("time");
  if (isValidPickupTime(time)) out.pickupTime = time;

  const pax = Number(params.get("pax"));
  if (Number.isInteger(pax) && pax >= 1 && pax <= MAX_SHARED_PAX) out.pax = pax;

  const vehicle = params.get("vehicle");
  if (vehicle && catalog.vehicles.some((v) => v.id === vehicle)) out.vehicleId = vehicle;

  const stops = params.get("stops");
  if (stops) {
    const ids = [...new Set(stops.split(",").slice(0, 10))].filter((id) => catalog.stops.some((s) => s.id === id));
    if (ids.length) out.stopIds = ids;
  }
  return out;
}

function readPlace(params: { get(name: string): string | null }, key: "from" | "to"): RidePlace | undefined {
  const v = params.get(key);
  if (HUBS.some((h) => h.id === v)) return hubPlace(v as HubId);
  if (!isGooglePlaceId(v)) return undefined;
  const label = cleanPlaceLabel(params.get(`${key}Name`));
  const [lat, lng] = (params.get(`${key}At`) ?? "").split(",").map(Number);
  const point = { lat, lng };
  if (!label || !Number.isFinite(lat) || !Number.isFinite(lng) || !inCostaRica(point)) return undefined;
  const area = areaOf(point);
  return { id: v, label, ...point, hub: nearestHub(point), ...(area ? { area } : {}) };
}

function writePlace(q: URLSearchParams, key: "from" | "to", p: RidePlace) {
  if (isHubPlace(p)) {
    q.set(key, p.hub);
    q.delete(`${key}Name`);
    q.delete(`${key}At`);
  } else {
    q.set(key, p.id);
    q.set(`${key}Name`, p.label);
    q.set(`${key}At`, `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`);
  }
}

/** The query string for a ride (without "?"). Other parameters on the page are kept. */
export function rideLinkQuery(state: RideLinkState, current: string): string {
  const q = new URLSearchParams(current);
  writePlace(q, "from", state.origin);
  writePlace(q, "to", state.destination);
  q.set("date", state.date);
  q.set("time", state.pickupTime);
  q.set("pax", String(state.pax));
  q.set("vehicle", state.vehicleId);
  if (state.stopIds.length) q.set("stops", state.stopIds.join(","));
  else q.delete("stops");
  // URLSearchParams encodes ":" and ","; keep the link readable.
  return q.toString().replace(/%3A/gi, ":").replace(/%2C/gi, ",");
}
