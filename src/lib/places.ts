/**
 * Places for the ride builder (docs/PRICING.md §2–3, build step 3).
 *
 * A ride's pickup and drop-off are either one of our 9 towns ("hubs", free to
 * price from the tables in catalog.ts) or any place the traveller typed (a
 * hotel, dock, restaurant or address found with Google Places). A typed place is
 * also linked to its nearest hub, which keeps the area factor, the stops on the
 * way and the "while you're there" suggestions working.
 *
 * Shared by the browser and the server. The server never trusts a place's
 * coordinates from the browser: it looks them up again by place id
 * (src/lib/googleMaps.ts) before pricing a trip.
 */
import { DRAKE_BOAT_MINUTES, HUB_IDS, HUBS, type ExtraAreaId, type HubId } from "./catalog";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RidePlace extends LatLng {
  /** "hub:SJO" for one of our towns, otherwise a Google place id. */
  id: string;
  /** What the traveller sees, e.g. "Arenas Del Mar Beachfront & Rainforest Resort". */
  label: string;
  /** Street address from Google (typed places only). */
  address?: string;
  /** Nearest of our towns: area factor, stops, suggestions. */
  hub: HubId;
  /** Extra pricing area the place is in, e.g. "SouthNicoya" (its factor applies at either end, on ferry routes). */
  area?: ExtraAreaId;
  /** A typed place that is the SJO or LIR airport itself (Google's place type), not a hotel nearby. */
  airport?: boolean;
}

/** Road distance and time for a ride between typed places (Google Routes). */
export interface RideRoute {
  /** Road km (to the Sierpe dock when one end is in Drake Bay). */
  km: number;
  /** Time at the wheel, priced per hour. */
  drivingMinutes: number;
  /** Door to door, including the Sierpe–Drake Bay boat. */
  totalMinutes: number;
  /** Car ferries on the way (Gulf of Nicoya), each charged at the ferry fares. */
  ferries: number;
  /** Extra pricing area at either end, only when the route takes a ferry (set by the server). */
  area?: ExtraAreaId;
}

/**
 * Where each hub sits on the map: the airport for SJO / LIR, the town centre or
 * the dock elsewhere. Used to route from a hub to a typed place and to find a
 * typed place's nearest hub.
 */
export const HUB_POINTS: Record<HubId, LatLng> = {
  SJO: { lat: 9.9939, lng: -84.2088 }, // Juan Santamaría airport
  LIR: { lat: 10.5933, lng: -85.5444 }, // Daniel Oduber airport
  Arenal: { lat: 10.4714, lng: -84.6453 }, // La Fortuna centre
  ManuelAntonio: { lat: 9.4075, lng: -84.1555 }, // Manuel Antonio road, between Quepos and the park
  Monteverde: { lat: 10.3126, lng: -84.8252 }, // Santa Elena
  Sierpe: { lat: 8.8593, lng: -83.4725 }, // Sierpe river dock
  DrakeBay: { lat: 8.6948, lng: -83.6683 }, // Agujitas beach
  PuertoViejo: { lat: 9.6559, lng: -82.7544 }, // Puerto Viejo de Talamanca
  Tamarindo: { lat: 10.2993, lng: -85.8371 },
};

/** Places this close to Drake Bay are reached by boat from Sierpe (there is no sensible road for our cars). */
export const DRAKE_BOAT_AREA_KM = 15;

/**
 * Southern Nicoya: the tip of the peninsula reached by the Puntarenas ferries
 * (Paquera, Playa Naranjo, Tambor, Montezuma, Cabuya, Santa Teresa, Mal País,
 * Manzanillo, Playa Coyote). A simple box: east of -84.88 is Puntarenas city,
 * west of -85.35 / north of 10.02 is the Nosara–Sámara–Nicoya road side.
 */
const SOUTH_NICOYA = { minLat: 9.55, maxLat: 10.02, minLng: -85.35, maxLng: -84.88 };

/** Extra pricing area for a map point (none for most of the country). */
export function areaOf(p: LatLng): ExtraAreaId | undefined {
  const b = SOUTH_NICOYA;
  return p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng ? "SouthNicoya" : undefined;
}

/** Rough box around Costa Rica: a typed place outside it is refused. */
const CR_BOUNDS = { minLat: 7.9, maxLat: 11.3, minLng: -86.1, maxLng: -82.4 };

export const PLACE_LABEL_MAX = 120;

const HUB_PREFIX = "hub:";

export function hubPlaceId(hub: HubId): string {
  return `${HUB_PREFIX}${hub}`;
}

/** The hub behind a "hub:X" id, or null for a typed place. */
export function hubOfPlaceId(id: string): HubId | null {
  if (!id.startsWith(HUB_PREFIX)) return null;
  const h = id.slice(HUB_PREFIX.length);
  return (HUB_IDS as readonly string[]).includes(h) ? (h as HubId) : null;
}

export function hubPlace(hub: HubId): RidePlace {
  return { id: hubPlaceId(hub), label: HUBS.find((h) => h.id === hub)!.name, hub, ...HUB_POINTS[hub] };
}

export function isHubPlace(p: Pick<RidePlace, "id">): boolean {
  return hubOfPlaceId(p.id) !== null;
}

/**
 * The pickup / drop-off part of a ride's request (ItemSpec in ./tripRequest): our town for each
 * end, plus the typed place (Google id + name) when it isn't one of our towns. The website's ride
 * builder and the team's manual booking form both use this, so a typed hotel reaches the server
 * the same way from both and is priced the same (the server looks the place up again by id).
 */
export function placeSpecFields(origin: RidePlace, destination: RidePlace) {
  return {
    origin: origin.hub,
    destination: destination.hub,
    ...(isHubPlace(origin) ? {} : { originPlace: { id: origin.id, label: origin.label } }),
    ...(isHubPlace(destination) ? {} : { destinationPlace: { id: destination.id, label: destination.label } }),
  };
}

/** Booking text for one end: "Arenas Del Mar Resort, Rd to Arenas Del Mar, Manuel Antonio…" or our town's name. */
export function bookingPlaceText(p: RidePlace): string {
  return p.address && p.address !== p.label ? `${p.label}, ${p.address}` : p.label;
}

/** bookings.origin_coords / destination_coords for one end (origin_coords also gets `route`). */
export function bookingPlaceCoords(p: RidePlace): { lat: number; lng: number; place_id: string; town: HubId } {
  return { lat: p.lat, lng: p.lng, place_id: p.id, town: p.hub };
}

/**
 * One end of a saved ride as a ride place (the team's edit form, src/lib/bookingEdit.ts): our town
 * from "hub:X", else the stored Google point with the booking's text as its name. Null when the
 * booking has no map point (rides saved before 2026-11-09).
 */
export function storedRidePlace(text: string | null | undefined, coords: Record<string, unknown> | null | undefined): RidePlace | null {
  if (!coords) return null;
  const id = typeof coords.place_id === "string" ? coords.place_id : "";
  const hub = hubOfPlaceId(id);
  if (hub) return hubPlace(hub);
  const town = typeof coords.town === "string" && (HUB_IDS as readonly string[]).includes(coords.town) ? (coords.town as HubId) : null;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!isGooglePlaceId(id) || !town || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const area = areaOf({ lat, lng });
  return { id, label: cleanPlaceLabel(text) || id, lat, lng, hub: town, ...(area ? { area } : {}) };
}

/** Google place ids are long URL-safe strings. */
export function isGooglePlaceId(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{10,300}$/.test(v);
}

export function cleanPlaceLabel(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, PLACE_LABEL_MAX) : "";
}

export function inCostaRica(p: LatLng): boolean {
  return p.lat >= CR_BOUNDS.minLat && p.lat <= CR_BOUNDS.maxLat && p.lng >= CR_BOUNDS.minLng && p.lng <= CR_BOUNDS.maxLng;
}

/** Straight-line km (only to pick the nearest hub, never for prices). */
export function straightKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The hub a typed place belongs to: Drake Bay only inside the boat area, otherwise the closest hub. */
export function nearestHub(p: LatLng): HubId {
  if (straightKm(p, HUB_POINTS.DrakeBay) <= DRAKE_BOAT_AREA_KM) return "DrakeBay";
  // Across the gulf from Monteverde in a straight line, but a Guanacaste beach area:
  // no Route 34 stops, Guanacaste suggestions.
  if (areaOf(p) === "SouthNicoya") return "Tamarindo";
  let best: HubId = "SJO";
  let bestKm = Infinity;
  for (const id of HUB_IDS) {
    if (id === "DrakeBay") continue;
    const km = straightKm(p, HUB_POINTS[id]);
    if (km < bestKm) {
      best = id;
      bestKm = km;
    }
  }
  return best;
}

/** How far from the SJO / LIR terminal a place Google lists as an airport may be (terminals, gates, arrivals hall). */
export const AIRPORT_RADIUS_KM = 2.5;

export function isNearMainAirport(p: LatLng): boolean {
  return straightKm(p, HUB_POINTS.SJO) <= AIRPORT_RADIUS_KM || straightKm(p, HUB_POINTS.LIR) <= AIRPORT_RADIUS_KM;
}

/**
 * Is this pickup at one of the two international airports? True for our SJO / LIR
 * towns and for a typed place that Google itself lists as an airport there
 * (`airport`, set by the server). Distance alone is not enough: the hotels and
 * car-rental offices next to the terminals are ordinary pickups with no flight to track.
 */
export function isAirportPickup(p: Pick<RidePlace, "id" | "airport">): boolean {
  const hub = hubOfPlaceId(p.id);
  if (hub) return hub === "SJO" || hub === "LIR";
  return p.airport === true;
}

/** Where the car actually goes: places in Drake Bay are reached from the Sierpe dock. */
export function roadEnd(p: RidePlace): LatLng {
  return p.hub === "DrakeBay" ? HUB_POINTS.Sierpe : { lat: p.lat, lng: p.lng };
}

/** Boat legs on a ride (one if either end is in Drake Bay). */
export function boatMinutes(a: Pick<RidePlace, "hub">, b: Pick<RidePlace, "hub">): number {
  return (a.hub === "DrakeBay") !== (b.hub === "DrakeBay") ? DRAKE_BOAT_MINUTES : 0;
}

/** True when the price needs a Google route (at least one end is a typed place). */
export function needsRoute(a: Pick<RidePlace, "id">, b: Pick<RidePlace, "id">): boolean {
  return !isHubPlace(a) || !isHubPlace(b);
}

/** Free Google Maps link with the route, for the traveller to look at. */
export function mapsDirectionsUrl(a: LatLng, b: LatLng): string {
  const q = new URLSearchParams({
    api: "1",
    origin: `${a.lat},${a.lng}`,
    destination: `${b.lat},${b.lng}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${q}`;
}
