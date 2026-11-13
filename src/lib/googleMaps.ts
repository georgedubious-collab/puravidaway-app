import "server-only";
import { unstable_cache } from "next/cache";
import type { HubId } from "./catalog";
import {
  customStopErrors,
  detoursFromRoads,
  type CustomStopLimits,
  type CustomStopSpec,
  type PricedCustomStop,
} from "./customStops";
import { hasContactDetails } from "./preferences";
import {
  areaOf,
  boatMinutes,
  cleanPlaceLabel,
  hubOfPlaceId,
  hubPlace,
  inCostaRica,
  isNearMainAirport,
  isGooglePlaceId,
  nearestHub,
  needsRoute,
  roadEnd,
  straightKm,
  type LatLng,
  type RidePlace,
  type RideRoute,
} from "./places";

/**
 * Google Maps Platform, server side only (docs/PRICING.md §3). The key lives in
 * Vercel as GOOGLE_MAPS_API_KEY and is never sent to the browser.
 *
 * Cost control (Jorge's Google Cloud project "PuraVidaWay" also has daily caps
 * and a $10/month budget alert):
 * - Only the cheapest "Essentials" fields are requested.
 * - Suggestions + the place lookup share a session token, so typing is billed once.
 * - Place lookups and routes are cached for 30 days (Google allows caching
 *   coordinates for 30 days), so the server re-check when a trip is sent and
 *   repeat searches cost nothing.
 */

const KEY = () => process.env.GOOGLE_MAPS_API_KEY ?? "";
const CACHE_SECONDS = 30 * 24 * 3600;

/** Shown to travellers; never contains Google's raw error text. */
export class MapsError extends Error {}

export function mapsEnabled(): boolean {
  return KEY().length > 0;
}

async function google(url: string, init: { method?: string; body?: unknown; fieldMask?: string }) {
  if (!mapsEnabled()) throw new MapsError("Address search isn't switched on yet. Choose one of our towns from the list.");
  let res: Response;
  try {
    res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      "X-Goog-Api-Key": KEY(),
      "Content-Type": "application/json",
      ...(init.fieldMask ? { "X-Goog-FieldMask": init.fieldMask } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new MapsError("We couldn't reach the map service. Please try again in a moment.");
  }
  if (!res.ok) {
    // Log the status only (the body can echo the request); never the key.
    console.error("[google maps]", url.split("?")[0], res.status);
    throw new MapsError("We couldn't reach the map service. Please try again in a moment.");
  }
  return (await res.json()) as Record<string, unknown>;
}

export interface PlaceSuggestion {
  placeId: string;
  main: string;
  secondary: string;
}

/** Up to 5 suggestions in Costa Rica for what the traveller typed. */
export async function suggestPlaces(input: string, sessionToken: string): Promise<PlaceSuggestion[]> {
  const data = await google("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    body: { input, sessionToken, includedRegionCodes: ["cr"], languageCode: "en" },
  });
  const out: PlaceSuggestion[] = [];
  for (const s of (data.suggestions as { placePrediction?: Record<string, unknown> }[] | undefined) ?? []) {
    const p = s.placePrediction as
      | { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } }
      | undefined;
    if (!p || !isGooglePlaceId(p.placeId)) continue;
    out.push({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    });
    if (out.length === 5) break;
  }
  return out;
}

interface GooglePlace extends LatLng {
  address: string;
  /** Google lists the place itself as an airport (not a hotel or car rental next to one). */
  airport: boolean;
}

async function fetchPlace(id: string, sessionToken?: string): Promise<GooglePlace> {
  const q = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  const data = await google(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}${q}`, {
    fieldMask: "id,formattedAddress,location,types",
  });
  const loc = data.location as { latitude?: number; longitude?: number } | undefined;
  if (typeof loc?.latitude !== "number" || typeof loc?.longitude !== "number") {
    throw new MapsError("We couldn't find that place on the map. Please pick another.");
  }
  const types = Array.isArray(data.types) ? (data.types as unknown[]) : [];
  return {
    lat: loc.latitude,
    lng: loc.longitude,
    address: String(data.formattedAddress ?? ""),
    airport: types.includes("airport") || types.includes("international_airport"),
  };
}

/** A typed place's map point, cached. The session token (if any) closes the search session for billing. */
function lookupPlace(id: string, sessionToken?: string): Promise<GooglePlace> {
  return unstable_cache(() => fetchPlace(id, sessionToken), ["gmaps-place-v2", id], { revalidate: CACHE_SECONDS })();
}

/**
 * Turn a place id ("hub:SJO" or a Google id) into a ride place. Coordinates and
 * address always come from Google (or our hub list), never from the browser;
 * only the label is the traveller's.
 */
export async function resolvePlace(id: string, label?: string, sessionToken?: string): Promise<RidePlace> {
  const hub = hubOfPlaceId(id);
  if (hub) return hubPlace(hub);
  if (!isGooglePlaceId(id)) throw new MapsError("That place isn't valid. Please search for it again.");
  const g = await lookupPlace(id, sessionToken);
  if (!inCostaRica(g)) throw new MapsError("We only drive within Costa Rica. Please pick a place in Costa Rica.");
  const area = areaOf(g);
  return {
    id,
    label: cleanPlaceLabel(label) || g.address || "Selected place",
    address: g.address,
    lat: g.lat,
    lng: g.lng,
    hub: nearestHub(g),
    ...(area ? { area } : {}),
    // Only SJO and LIR get the airport promises (flight tracking, free waiting).
    ...(g.airport && isNearMainAirport(g) ? { airport: true } : {}),
  };
}

const round5 = (n: number) => n.toFixed(5);

interface Road {
  km: number;
  drivingMinutes: number;
  ferries: number;
}

async function fetchRoute(a: LatLng, b: LatLng, via: readonly LatLng[] = []): Promise<Road> {
  const data = await google("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    // Step maneuvers tell us where the route takes a car ferry (still the Essentials tier).
    fieldMask: "routes.distanceMeters,routes.duration,routes.legs.steps.navigationInstruction.maneuver",
    body: {
      origin: { location: { latLng: { latitude: a.lat, longitude: a.lng } } },
      destination: { location: { latLng: { latitude: b.lat, longitude: b.lng } } },
      // The traveller's own stops, in their order (totals cover every leg). Up to 10 stay in the Essentials tier.
      ...(via.length ? { intermediates: via.map((p) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } })) } : {}),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
    },
  });
  const r = (
    data.routes as
      | { distanceMeters?: number; duration?: string; legs?: { steps?: { navigationInstruction?: { maneuver?: string } }[] }[] }[]
      | undefined
  )?.[0];
  const seconds = Number(String(r?.duration ?? "").replace(/s$/, ""));
  if (!r || typeof r.distanceMeters !== "number" || !Number.isFinite(seconds)) {
    throw new MapsError("We couldn't find a road between those places. Please message us on WhatsApp.");
  }
  // One crossing per run of ferry steps.
  let ferries = 0;
  let onFerry = false;
  for (const leg of r.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const ferry = /^FERRY/.test(step.navigationInstruction?.maneuver ?? "");
      if (ferry && !onFerry) ferries++;
      onFerry = ferry;
    }
  }
  // Google's time includes the crossing, so it is charged per hour like the road.
  return { km: Math.round(r.distanceMeters / 100) / 10, drivingMinutes: Math.ceil(seconds / 60), ferries };
}

/** Road km + driving time between two points, cached (same answer for the quote and the server re-check). */
function roadBetween(a: LatLng, b: LatLng): Promise<Road> {
  if (straightKm(a, b) < 0.05) return Promise.resolve({ km: 0, drivingMinutes: 0, ferries: 0 });
  const key = `${round5(a.lat)},${round5(a.lng)}>${round5(b.lat)},${round5(b.lng)}`;
  return unstable_cache(() => fetchRoute(a, b), ["gmaps-route-v2", key], { revalidate: CACHE_SECONDS })();
}

/** The road route pickup, then the stops in order, then the drop-off; cached like every route. */
function roadVia(a: LatLng, via: readonly LatLng[], b: LatLng): Promise<Road> {
  if (via.length === 0) return roadBetween(a, b);
  const pt = (p: LatLng) => `${round5(p.lat)},${round5(p.lng)}`;
  const key = [a, ...via, b].map(pt).join(">");
  return unstable_cache(() => fetchRoute(a, b, via), ["gmaps-route-v2", key], { revalidate: CACHE_SECONDS })();
}

/**
 * A stop is never asked of Google when even a straight line to it is clearly too far: with this
 * many straight-line km per allowed detour minute (72 km/h as the crow flies, which no road in
 * Costa Rica gives), the detour limit can't be met. Keeps far-off or made-up stops from costing
 * route requests.
 */
const STRAIGHT_KM_PER_DETOUR_MINUTE = 1.2;

/**
 * The traveller's own stops for a ride (src/lib/customStops.ts), looked up on the server: each
 * place again by its Google id (cached, usually already looked up by the place search), then
 * what each stop adds to the drive: the route through stops 1..n minus the route through stops
 * 1..n-1, from Google Routes. One cached route request per stop, plus the direct route (also
 * needed between two of our towns, whose price comes from our own tables). Nothing but the
 * place id, the name and the minutes is taken from the browser.
 *
 * Throws a MapsError the traveller can read when the stops can't be priced online: too many,
 * a place twice, a stop only a boat reaches, one that adds a ferry, or clearly too far.
 * The time and detour limits themselves are checked by customStopsProblem() where the price is made.
 */
export async function resolveCustomStops(
  origin: RidePlace,
  destination: RidePlace,
  specs: readonly CustomStopSpec[],
  limits: CustomStopLimits,
): Promise<PricedCustomStop[]> {
  if (specs.length === 0) return [];
  if (limits.maxStops <= 0) throw new MapsError(customStopErrors.off);
  if (specs.length > limits.maxStops) throw new MapsError(customStopErrors.tooMany(limits.maxStops));
  const ids = specs.map((s) => s.id);
  if (new Set(ids).size !== ids.length || ids.includes(origin.id) || ids.includes(destination.id)) {
    throw new MapsError(customStopErrors.twice);
  }
  if (origin.hub === "DrakeBay" && destination.hub === "DrakeBay") throw new MapsError(customStopErrors.boat);
  const places = await Promise.all(specs.map((s) => resolvePlace(s.id, s.label)));
  // Around Drake Bay there is no road for our cars.
  if (places.some((p) => p.hub === "DrakeBay")) throw new MapsError(customStopErrors.boat);
  const a = roadEnd(origin);
  const b = roadEnd(destination);
  const points = places.map((p) => ({ lat: p.lat, lng: p.lng }));
  const line = [a, ...points, b];
  let straight = -straightKm(a, b);
  for (let i = 1; i < line.length; i++) straight += straightKm(line[i - 1], line[i]);
  if (straight > limits.maxDetourMinutes * STRAIGHT_KM_PER_DETOUR_MINUTE) throw new MapsError(customStopErrors.tooFar);
  const [direct, ...cumulative] = await Promise.all([roadBetween(a, b), ...points.map((_, i) => roadVia(a, points.slice(0, i + 1), b))]);
  if (cumulative[cumulative.length - 1].km > MAX_ROUTE_KM) throw new MapsError(customStopErrors.tooFar);
  const detours = detoursFromRoads(direct, cumulative);
  if (!detours) throw new MapsError(customStopErrors.boat);
  return specs.map((s, i) => ({
    id: s.id,
    // The name the traveller saw, unless it carries contact details (then Google's address): drivers read it.
    label: hasContactDetails(places[i].label) ? places[i].address || "Stop" : places[i].label,
    ...(places[i].address ? { address: places[i].address } : {}),
    lat: places[i].lat,
    lng: places[i].lng,
    minutes: s.minutes,
    ...detours[i],
  }));
}

/** Longest ride we quote automatically (Peñas Blancas → Panama border is ~650 km). */
const MAX_ROUTE_KM = 700;

/**
 * The road route for a ride, or null when both ends are our towns (those are
 * priced from the tables in catalog.ts, at no cost).
 */
export async function rideRoute(origin: RidePlace, destination: RidePlace): Promise<RideRoute | null> {
  if (!needsRoute(origin, destination)) return null;
  if (origin.hub === "DrakeBay" && destination.hub === "DrakeBay") {
    throw new MapsError("Getting around Drake Bay is by boat or on foot. Message us on WhatsApp and we'll help.");
  }
  const road = await roadBetween(roadEnd(origin), roadEnd(destination));
  if (road.km > MAX_ROUTE_KM) throw new MapsError("That ride is longer than we quote online. Please message us on WhatsApp.");
  // Southern Nicoya's factor is for the ferry queue and the crossing back (Jorge, 2026-11-09):
  // when Google drives around the gulf instead (e.g. from Liberia), no ferry, no factor.
  const area = road.ferries > 0 ? (origin.area ?? destination.area) : undefined;
  return { ...road, totalMinutes: road.drivingMinutes + boatMinutes(origin, destination), ...(area ? { area } : {}) };
}

/**
 * Server re-check of a ride before it's saved: looks up typed places again by id,
 * sets each end's town from the real map point, and gets the road route.
 * Rides between two of our towns pass through unchanged with no route.
 */
export async function resolveTransfer<
  S extends { origin: HubId; destination: HubId; originPlace?: { id: string; label: string }; destinationPlace?: { id: string; label: string } },
>(spec: S): Promise<{ spec: S; origin: RidePlace; destination: RidePlace; route: RideRoute | null }> {
  const [origin, destination] = await Promise.all([
    spec.originPlace ? resolvePlace(spec.originPlace.id, spec.originPlace.label) : Promise.resolve(hubPlace(spec.origin)),
    spec.destinationPlace
      ? resolvePlace(spec.destinationPlace.id, spec.destinationPlace.label)
      : Promise.resolve(hubPlace(spec.destination)),
  ]);
  const route = await rideRoute(origin, destination);
  return { spec: { ...spec, origin: origin.hub, destination: destination.hub }, origin, destination, route };
}

/**
 * Drive time in minutes between two points with live traffic, or null when Google
 * can't say. Used only for the lateness check (src/lib/eta.ts): never cached, and
 * billed at Google's traffic-aware rate, so callers must throttle.
 */
export async function trafficMinutes(a: LatLng, b: LatLng): Promise<number | null> {
  try {
    if (straightKm(a, b) < 0.15) return 0;
    const data = await google("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      fieldMask: "routes.duration",
      body: {
        origin: { location: { latLng: { latitude: a.lat, longitude: a.lng } } },
        destination: { location: { latLng: { latitude: b.lat, longitude: b.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      },
    });
    const seconds = Number(String((data.routes as { duration?: string }[] | undefined)?.[0]?.duration ?? "").replace(/s$/, ""));
    return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds / 60) : null;
  } catch {
    return null;
  }
}
