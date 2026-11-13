/**
 * "Add your own stop" on a ride (Jorge, 2026-11-12; docs/PRICING.md §5.1).
 *
 * Besides the catalog's sightseeing stops, a traveller can add any place found with the place
 * search (a waterfall, a garden, a restaurant) and say how long they stay. The price follows the
 * same rule as the driver's part of a catalog stop (stopPriceCents in ./catalog):
 *
 *   waiting time × the hourly wait rate
 *   + extra road km × the ride formula's per-km rate + extra driving minutes × its per-hour rate
 *   rounded to whole dollars, per stop; then the season multiplier like every other stop.
 *
 * "Extra" = the road route through the stops in the traveller's order minus the direct route,
 * both from Google Routes (src/lib/googleMaps.ts, resolveCustomStops). Stop n's extra is what it
 * adds on top of the stops before it. No tour part and no guide: entrance tickets are paid by
 * the traveller at the place. Not multiplied by the vehicle or area factor and not by the night
 * premium, exactly like catalog stops. The whole amount is shared with the driver by the usual
 * commission (no company-paid costs), and a promo code discounts it like the ride.
 *
 * Shared by the browser, the server and the tests: no Google, no database here. The server
 * never trusts minutes of detour, km or prices from the browser: it looks every place up again
 * by its Google id and works the detours out itself.
 */
import { RIDE_FORMULA_DEFAULT, WAIT_PER_HOUR_CENTS_DEFAULT, stopPriceCents, type RideFormula } from "./catalog";
import { cleanPlaceLabel, isGooglePlaceId } from "./places";

/** How long a traveller can stay at their own stop, in minutes (the choices offered). */
export const CUSTOM_STOP_MINUTES = [30, 60, 90, 120, 180] as const;

/** Limits for own stops (pricing_settings, /admin/pricing; assumed values, docs/PROJECT.md §9). */
export interface CustomStopLimits {
  /** Most own stops on one ride. 0 switches the feature off. */
  maxStops: number;
  /** Most minutes at stops in total on a ride with an own stop (own + catalog stops together). */
  maxWaitMinutes: number;
  /** Most extra driving minutes all own stops may add together. */
  maxDetourMinutes: number;
}

export const CUSTOM_STOP_LIMITS_DEFAULT: CustomStopLimits = { maxStops: 3, maxWaitMinutes: 240, maxDetourMinutes: 90 };

/** An own stop as the traveller chose it (part of a ride's ItemSpec). */
export interface CustomStopSpec {
  /** Google place id. */
  id: string;
  /** The place's name as the traveller saw it. */
  label: string;
  /** Minutes at the stop. */
  minutes: number;
}

/** An own stop the server has looked up: where it is and what it adds to the drive. */
export interface PricedCustomStop extends CustomStopSpec {
  address?: string;
  lat: number;
  lng: number;
  /** Extra road km / driving minutes this stop adds on top of the stops before it (never negative). */
  detourKm: number;
  detourMin: number;
}

/** The three numbers the price needs. */
export type CustomStopInputs = Pick<PricedCustomStop, "minutes" | "detourKm" | "detourMin">;

/** Hard cap on the list length a request may carry, whatever the limits say. */
const MAX_LIST = 10;

/**
 * Validate the own stops of untrusted input. undefined / [] = none; null = malformed.
 * The friendly limits (how many, how long) are checked later, with a readable message.
 */
export function parseCustomStops(raw: unknown): CustomStopSpec[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_LIST) return null;
  const out: CustomStopSpec[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const label = cleanPlaceLabel(o.label);
    if (!isGooglePlaceId(o.id) || !label) return null;
    if (!Number.isInteger(o.minutes) || !(CUSTOM_STOP_MINUTES as readonly number[]).includes(o.minutes as number)) return null;
    out.push({ id: o.id, label, minutes: o.minutes as number });
  }
  return out;
}

/** The price of one own stop before the season, in cents: the same sum as a catalog stop's driver part. */
export function customStopCents(
  stop: CustomStopInputs,
  rates?: { rideFormula?: RideFormula; waitPerHourCents?: number },
): number {
  return stopPriceCents(
    { durationMin: stop.minutes, detourKm: stop.detourKm, detourMin: stop.detourMin },
    rates?.rideFormula ?? RIDE_FORMULA_DEFAULT,
    rates?.waitPerHourCents ?? WAIT_PER_HOUR_CENTS_DEFAULT,
  );
}

/** The parts of one own stop's price in cents, unrounded, for the price breakdown (they add up to customStopCents before rounding). */
export function customStopParts(
  stop: CustomStopInputs,
  rates?: { rideFormula?: RideFormula; waitPerHourCents?: number },
): { waitCents: number; kmCents: number; driveCents: number } {
  const f = rates?.rideFormula ?? RIDE_FORMULA_DEFAULT;
  const wait = rates?.waitPerHourCents ?? WAIT_PER_HOUR_CENTS_DEFAULT;
  return {
    waitCents: (wait * stop.minutes) / 60,
    kmCents: f.perKmCents * stop.detourKm,
    driveCents: (f.perHourCents * stop.detourMin) / 60,
  };
}

/** Where to go when the limits say no: our team quotes it by hand. Never names a person or promises hours. */
export const CUSTOM_STOP_ASK_US = "For a longer route, message us and we'll quote it.";

export const customStopErrors = {
  tooMany: (max: number) => `You can add up to ${max} stops of your own. ${CUSTOM_STOP_ASK_US}`,
  tooLong: (maxMinutes: number) =>
    `Stops can add up to ${hoursText(maxMinutes)} in total. ${CUSTOM_STOP_ASK_US}`,
  tooFar: `Those stops add more driving than we can price online. ${CUSTOM_STOP_ASK_US}`,
  off: `We can't add your own stops online right now. ${CUSTOM_STOP_ASK_US}`,
  twice: "That place is already on this ride. Pick a different stop.",
  boat: `That stop can't be reached by road on this ride. ${CUSTOM_STOP_ASK_US}`,
  unchecked: "We couldn't check the road distance for your stops. Please try again.",
} as const;

/** "4 hours", "1.5 hours", "45 minutes". */
function hoursText(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${h} hour${h === 1 ? "" : "s"}`;
}

/** True for a refusal that ends with "message us": the page shows the contact link next to it. */
export function isAskUsError(message: string | null | undefined): boolean {
  return typeof message === "string" && message.endsWith(CUSTOM_STOP_ASK_US);
}

/**
 * Why these own stops can't be booked online (a message for the traveller), or null when they
 * are fine. `catalogStopMinutes` is the time at the catalog stops chosen on the same ride: the
 * total-time limit counts both, but only when the ride has an own stop (a ride with catalog
 * stops alone is never refused by it). Pass stops without detours (the browser, before the
 * server has answered) to check the count and the time only.
 */
export function customStopsProblem(
  stops: readonly (Pick<CustomStopSpec, "minutes"> & Partial<Pick<PricedCustomStop, "detourMin">>)[],
  catalogStopMinutes: number,
  limits: CustomStopLimits = CUSTOM_STOP_LIMITS_DEFAULT,
): string | null {
  if (stops.length === 0) return null;
  if (limits.maxStops <= 0) return customStopErrors.off;
  if (stops.length > limits.maxStops) return customStopErrors.tooMany(limits.maxStops);
  const wait = stops.reduce((n, s) => n + s.minutes, 0) + Math.max(0, catalogStopMinutes);
  if (wait > limits.maxWaitMinutes) return customStopErrors.tooLong(limits.maxWaitMinutes);
  const detour = stops.reduce((n, s) => n + (s.detourMin ?? 0), 0);
  if (detour > limits.maxDetourMinutes) return customStopErrors.tooFar;
  return null;
}

/** Road totals of one route (Google Routes). */
export interface RoadTotals {
  km: number;
  drivingMinutes: number;
  ferries: number;
}

/**
 * What each own stop adds: `cumulative[i]` is the route pickup → stops 1..i+1 → drop-off, and
 * stop i+1's detour is that route minus the one before it (the direct route for the first stop).
 * Never negative. Null when the stops change the number of ferry crossings: that isn't priced online.
 */
export function detoursFromRoads(direct: RoadTotals, cumulative: readonly RoadTotals[]): { detourKm: number; detourMin: number }[] | null {
  const out: { detourKm: number; detourMin: number }[] = [];
  let prev = direct;
  for (const r of cumulative) {
    if (r.ferries !== direct.ferries) return null;
    out.push({
      detourKm: Math.max(0, Math.round((r.km - prev.km) * 10) / 10),
      detourMin: Math.max(0, Math.round(r.drivingMinutes - prev.drivingMinutes)),
    });
    prev = r;
  }
  return out;
}

/** Extra driving minutes all own stops add (they are part of the ride's drive time). */
export function customDetourMinutes(stops: readonly Pick<PricedCustomStop, "detourMin">[] | null | undefined): number {
  return (stops ?? []).reduce((n, s) => n + s.detourMin, 0);
}

/** Minutes spent at the own stops. */
export function customWaitMinutes(stops: readonly Pick<CustomStopSpec, "minutes">[] | null | undefined): number {
  return (stops ?? []).reduce((n, s) => n + s.minutes, 0);
}

// ---------------------------------------------------------------------------
// As stored on a booking (bookings.sightseeing_stops, next to the catalog stops)
// ---------------------------------------------------------------------------

/**
 * One own stop inside bookings.sightseeing_stops. `price` (USD, before the season, like a
 * catalog stop's) is the only money in it: the driver functions remove every "price"
 * (stops_for_driver(), migration 0036), so drivers get the name, the place and the time only.
 */
export interface StoredCustomStop {
  /** "custom-1", "custom-2"… in the traveller's order. */
  id: string;
  custom: true;
  name: string;
  address?: string;
  place_id: string;
  lat: number;
  lng: number;
  /** Minutes at the stop. */
  minutes: number;
  detour_km: number;
  detour_min: number;
  price?: number;
}

/** The entries to save for a ride's own stops (after the catalog stops). */
export function storedCustomStops(stops: readonly PricedCustomStop[], rates?: { rideFormula?: RideFormula; waitPerHourCents?: number }): StoredCustomStop[] {
  return stops.map((s, i) => ({
    id: `custom-${i + 1}`,
    custom: true as const,
    name: s.label,
    ...(s.address ? { address: s.address } : {}),
    place_id: s.id,
    lat: s.lat,
    lng: s.lng,
    minutes: s.minutes,
    detour_km: s.detourKm,
    detour_min: s.detourMin,
    price: customStopCents(s, rates) / 100,
  }));
}

/** Is this entry of bookings.sightseeing_stops an own stop? */
export function isStoredCustomStop(v: unknown): v is StoredCustomStop {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.custom === true && typeof o.name === "string" && o.name.length > 0 && Number.isFinite(Number(o.minutes));
}

/** The own stops saved on a booking, in order (anything malformed is left out). */
export function customStopsOf(stops: readonly unknown[] | null | undefined): StoredCustomStop[] {
  return (Array.isArray(stops) ? stops : []).filter(isStoredCustomStop).map((s) => ({
    ...s,
    minutes: Math.max(0, Math.round(Number(s.minutes))),
    detour_km: Math.max(0, Number(s.detour_km) || 0),
    detour_min: Math.max(0, Math.round(Number(s.detour_min) || 0)),
  }));
}

/** A saved own stop back in the shape the price needs (the team's trip edit, when the route is unchanged). */
export function pricedFromStored(s: StoredCustomStop): PricedCustomStop {
  return {
    id: s.place_id,
    label: s.name,
    ...(s.address ? { address: s.address } : {}),
    lat: Number(s.lat),
    lng: Number(s.lng),
    minutes: s.minutes,
    detourKm: s.detour_km,
    detourMin: s.detour_min,
  };
}

/** "1 h 30 min", "45 min" (the same in English and Spanish). */
export function stopTimeText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * The name of any saved stop for the team's and the driver's lists: an own stop as
 * "La Fortuna Waterfall (1 h 30 min)", a catalog stop by its catalog name, anything else by its id.
 */
export function savedStopLabel(
  s: { id: string } | StoredCustomStop,
  catalogStops: readonly { id: string; name: string }[],
): string {
  if (isStoredCustomStop(s)) return `${s.name} (${stopTimeText(Math.round(Number(s.minutes)))})`;
  if (s.id === "en_route_upgrade") return "Smart En-Route Transfer";
  return catalogStops.find((x) => x.id === s.id)?.name ?? s.id;
}

/** Shown on every own-stop card. */
export const CUSTOM_STOP_ENTRANCE = {
  en: "Entrance tickets not included; paid at the place",
  es: "Entradas no incluidas; se pagan en el lugar",
} as const;
