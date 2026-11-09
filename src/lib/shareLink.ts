/**
 * Shareable ride links: the ride builder's choices live in the page address
 * (e.g. /?from=SJO&to=ManuelAntonio&date=2026-12-02&time=10:30&pax=3&vehicle=suv&stops=tarcoles),
 * so a link can be sent to a travel companion, a host or a hotel and opens the
 * same ride. Only route choices go in the URL: never names, contact details,
 * flight numbers, notes or offers.
 *
 * Everything read back is checked against the catalog; anything unknown is
 * ignored and the builder falls back to its defaults. The older ?from=&to=
 * links from route pages keep working.
 */
import { HUBS, type HubId } from "./catalog";
import type { CatalogData } from "./catalogModel";
import { isValidPickupTime, isValidYmd } from "./dates";

export const MAX_SHARED_PAX = 10;

export interface RideLinkState {
  origin: HubId;
  destination: HubId;
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
  const hub = (v: string | null) => (HUBS.some((h) => h.id === v) ? (v as HubId) : undefined);
  const from = hub(params.get("from"));
  const to = hub(params.get("to"));
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

/** The query string for a ride (without "?"). Other parameters on the page are kept. */
export function rideLinkQuery(state: RideLinkState, current: string): string {
  const q = new URLSearchParams(current);
  q.set("from", state.origin);
  q.set("to", state.destination);
  q.set("date", state.date);
  q.set("time", state.pickupTime);
  q.set("pax", String(state.pax));
  q.set("vehicle", state.vehicleId);
  if (state.stopIds.length) q.set("stops", state.stopIds.join(","));
  else q.delete("stops");
  // URLSearchParams encodes ":" and ","; keep the link readable.
  return q.toString().replace(/%3A/gi, ":").replace(/%2C/gi, ",");
}
