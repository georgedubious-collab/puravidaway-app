/**
 * The rules of the three automatic messages (Jorge, 2026-11-12; docs/PROJECT.md §4.7), kept
 * apart from the database and the sending so they can be checked by `npm run test:automations`
 * (scripts/test-automations.mjs). No server-only imports.
 *
 *   1. Day-before reminder (src/lib/dayBeforeReminders.ts): one to the traveller and one to the
 *      driver when a confirmed pickup is 20 to 28 hours away. Never at night (9 PM–7 AM Costa
 *      Rica time): when the 20–28 h window opens at night and the morning comes after the 20 h
 *      mark, it goes out at the first check after 7 AM, still before the pickup. A booking
 *      confirmed less than 20 hours before its pickup gets none (the confirmation was just sent).
 *   2. Low-rating alert (src/lib/lowRatingAlert.ts): 1, 2 or 3 stars.
 *   3. "Book your return / a day tour" (src/lib/tripFollowup.ts): the morning after a completed
 *      ride (from 7 AM Costa Rica time, the next calendar day or the day after), with skip rules.
 */
import { HUBS, HUB_REGION, type DayTour, type HubId } from "./catalog";
import { cleanPlaceLabel, hubOfPlaceId, isGooglePlaceId } from "./places";
import { QUIET_UNTIL_HOUR, isQuietHour } from "./reviewReminder";

const H = 3600 * 1000;
/** Costa Rica is UTC−6 all year (no daylight saving). */
const CR_OFFSET_MS = 6 * H;

// --- 1. Day-before reminder ------------------------------------------------------------------

/** The reminder window opens this many hours before the pickup… */
export const REMIND_FROM_HOURS = 28;
/** …and normally closes this many hours before it. */
export const REMIND_UNTIL_HOURS = 20;

/** The same moment if it isn't night in Costa Rica, otherwise the next 7:00 AM Costa Rica time. */
export function nextSendable(t: Date): Date {
  if (!isQuietHour(t)) return t;
  const local = new Date(t.getTime() - CR_OFFSET_MS);
  const seven = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), QUIET_UNTIL_HOUR) + CR_OFFSET_MS;
  // After 9 PM: tomorrow's 7 AM. Before 7 AM: today's.
  return new Date(seven > t.getTime() ? seven : seven + 24 * H);
}

/**
 * Is the day-before reminder due now? `pickupIso` is bookings.scheduled_at; `confirmedIso` is
 * bookings.confirmed_at (null on bookings confirmed before the column existed: treated as
 * confirmed long ago).
 */
export function dayBeforeReminderDue(now: Date, pickupIso: string | null, confirmedIso: string | null): boolean {
  const pickup = pickupIso ? new Date(pickupIso).getTime() : NaN;
  if (!Number.isFinite(pickup)) return false;
  const opens = pickup - REMIND_FROM_HOURS * H;
  const closes = pickup - REMIND_UNTIL_HOURS * H;
  const confirmed = confirmedIso ? new Date(confirmedIso).getTime() : NaN;
  // Confirmed less than 20 hours before the pickup: the confirmation is the reminder.
  if (Number.isFinite(confirmed) && confirmed > closes) return false;
  const t = now.getTime();
  if (t < opens || t >= pickup || isQuietHour(now)) return false;
  if (t <= closes) return true;
  // Past the 20-hour mark: only when the whole window was at night (it opened at night and
  // the first 7 AM came after the 20-hour mark). Then it goes out that morning.
  return nextSendable(new Date(opens)).getTime() > closes;
}

export interface ReminderCandidate {
  id: string;
  status: string;
  scheduled_at: string | null;
  confirmed_at: string | null;
  assigned_driver_id: string | null;
  reminder_traveller_at: string | null;
  reminder_driver_at: string | null;
}

/** Which bookings get which reminder now (each at most once: the columns are set before sending). */
export function planDayBeforeReminders(now: Date, candidates: ReminderCandidate[]): { traveller: string[]; driver: string[] } {
  const due = candidates.filter(
    (b) => b.status === "confirmed" && b.assigned_driver_id && dayBeforeReminderDue(now, b.scheduled_at, b.confirmed_at),
  );
  return {
    traveller: due.filter((b) => !b.reminder_traveller_at).map((b) => b.id),
    driver: due.filter((b) => !b.reminder_driver_at).map((b) => b.id),
  };
}

// --- 2. Low-rating alert -------------------------------------------------------------------

/** Ratings at or below this alert the team. */
export const LOW_RATING_MAX_STARS = 3;

export function isLowRating(stars: number): boolean {
  return Number.isInteger(stars) && stars >= 1 && stars <= LOW_RATING_MAX_STARS;
}

// --- Places on a stored booking --------------------------------------------------------------

/** bookings.origin_coords / destination_coords as the trip request stores them. */
export interface StoredCoords {
  lat?: number;
  lng?: number;
  /** "hub:SJO" for one of our towns, otherwise a Google place id. */
  place_id?: string;
  /** Nearest of our towns. */
  town?: string;
}

/** One end of a ride: the text the traveller saw and its stored map point. */
export interface StoredEnd {
  text: string | null;
  coords: StoredCoords | null;
}

const AIRPORT_TOWNS: readonly string[] = ["SJO", "LIR"];
/** Same words the driver app uses to spot airport rides (apps/driver/src/screens/Trips.tsx). */
const AIRPORT_WORDS = /airport|aeropuerto|\bSJO\b|\bLIR\b/i;

/** Which of our towns this end is in: from its place id, its nearest town, or its text (older bookings). */
export function townOf(end: StoredEnd): HubId | null {
  const fromId = end.coords?.place_id ? hubOfPlaceId(end.coords.place_id) : null;
  if (fromId) return fromId;
  const town = end.coords?.town;
  if (town && HUBS.some((h) => h.id === town)) return town as HubId;
  return HUBS.find((h) => h.name === (end.text ?? ""))?.id ?? null;
}

/** Is this end at the SJO or LIR airport? Our airport towns, or a typed place there that names the airport. */
export function isAirportEnd(end: StoredEnd): boolean {
  const hub = end.coords?.place_id ? hubOfPlaceId(end.coords.place_id) : null;
  if (hub) return AIRPORT_TOWNS.includes(hub);
  const town = townOf(end);
  return Boolean(town && AIRPORT_TOWNS.includes(town) && AIRPORT_WORDS.test(end.text ?? ""));
}

/** Towns across the Gulf of Nicoya, reached by the car ferry unless the ride comes by road from Guanacaste. */
const FERRY_TOWNS: readonly string[] = ["SouthNicoya"];
const ROAD_TO_NICOYA: readonly string[] = ["LIR", "Tamarindo"];

/**
 * Airport / ferry / boat / cash flags for the driver's reminder: the same rules as the driver
 * app's trip card (tripFacts in apps/driver/src/screens/Trips.tsx), from the same fields.
 */
export function driverTripFacts(b: {
  service_type: string;
  origin: string | null;
  destination: string | null;
  origin_coords: StoredCoords | null;
  destination_coords: StoredCoords | null;
  flight_or_hotel_notes: string | null;
  vehicle_class: string | null;
  payment_mode: string | null;
  /** Still owed by the traveller (total + cash fee − paid); only whether it is above 0 is used. */
  owed: number;
}): { airport: boolean; ferry: boolean; boat: boolean; cash: boolean } {
  const ride = b.service_type === "transfer";
  const o = b.origin_coords?.town ?? "";
  const d = b.destination_coords?.town ?? "";
  const airport =
    ride &&
    ((AIRPORT_TOWNS.includes(o) && AIRPORT_WORDS.test(b.origin ?? "")) ||
      (AIRPORT_TOWNS.includes(d) && AIRPORT_WORDS.test(b.destination ?? "")) ||
      /flight|vuelo/i.test(b.flight_or_hotel_notes ?? ""));
  const boat = (ride && (o === "DrakeBay" || d === "DrakeBay")) || b.vehicle_class === "sierpe_combo";
  const ferry = ride && ((FERRY_TOWNS.includes(o) && !ROAD_TO_NICOYA.includes(d)) || (FERRY_TOWNS.includes(d) && !ROAD_TO_NICOYA.includes(o)));
  const cash = b.payment_mode === "cash_driver" && b.owed > 0;
  return { airport, ferry, boat, cash };
}

/** One end as ride-builder link parameters (src/lib/shareLink.ts): a town id, or a typed place. */
function linkEnd(end: StoredEnd, key: "from" | "to", q: URLSearchParams): boolean {
  const c = end.coords;
  const hub = c?.place_id ? hubOfPlaceId(c.place_id) : null;
  if (hub) {
    q.set(key, hub);
    return true;
  }
  const label = cleanPlaceLabel(end.text);
  if (c && isGooglePlaceId(c.place_id) && label && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
    q.set(key, c.place_id);
    q.set(`${key}Name`, label);
    q.set(`${key}At`, `${Number(c.lat).toFixed(5)},${Number(c.lng).toFixed(5)}`);
    return true;
  }
  const town = townOf(end);
  if (!town) return false;
  q.set(key, town);
  return true;
}

/**
 * The ride builder with the way back pre-filled (from ↔ to swapped), using the same shareable
 * links the site already reads (/?from=&to=…). Only places, never names or dates. Null when
 * the booking has no usable places. `home` is "/" or "/es".
 */
export function returnRideHref(origin: StoredEnd, destination: StoredEnd, home: "/" | "/es" = "/"): string | null {
  const q = new URLSearchParams();
  if (!linkEnd(destination, "from", q) || !linkEnd(origin, "to", q)) return null;
  return `${home}?${q.toString()}`;
}

// --- 3. "Book your return / a day tour" -------------------------------------------------------

/** The follow-up goes out from the morning after the ride, and no later than this many days after it. */
export const FOLLOWUP_LAST_DAY = 2;

/** "2026-11-20" in Costa Rica for this moment. */
function crDay(t: number): number {
  return Math.floor((t - CR_OFFSET_MS) / (24 * H));
}

/**
 * Due from 7 AM Costa Rica time the day after the ride ended (never the same day as the
 * rating request), until the end of the second day after it; never at night.
 */
export function followupDue(now: Date, completedIso: string | null): boolean {
  const done = completedIso ? new Date(completedIso).getTime() : NaN;
  if (!Number.isFinite(done) || isQuietHour(now)) return false;
  const days = crDay(now.getTime()) - crDay(done);
  return days >= 1 && days <= FOLLOWUP_LAST_DAY;
}

/** Too late to send (the job was down for days, or the feature arrived after the trip): mark and skip. */
export function followupExpired(now: Date, completedIso: string | null): boolean {
  const done = completedIso ? new Date(completedIso).getTime() : NaN;
  return !Number.isFinite(done) || crDay(now.getTime()) - crDay(done) > FOLLOWUP_LAST_DAY;
}

export type FollowupSkip = "not_a_ride" | "airport_dropoff" | "return_booked" | "opted_out" | "no_email" | "low_rating";

export interface FollowupBooking {
  id: string;
  service_type: string;
  scheduled_at: string | null;
  origin: StoredEnd;
  destination: StoredEnd;
}

/**
 * Why this completed booking gets no follow-up, or null when it should get one.
 * `others`: the traveller's other bookings (same email), not cancelled. `stars`: their rating
 * of this ride, if any (3 stars or less: our team gets in touch instead; no sales email).
 */
export function followupSkipReason(
  b: FollowupBooking,
  a: { email: string | null; optedOut: boolean; others: (FollowupBooking & { status: string })[]; stars: number | null },
): FollowupSkip | null {
  if (b.service_type !== "transfer") return "not_a_ride";
  if (!a.email) return "no_email";
  if (a.optedOut) return "opted_out";
  if (isAirportEnd(b.destination)) return "airport_dropoff";
  if (a.stars != null && isLowRating(a.stars)) return "low_rating";
  const from = townOf(b.origin);
  const to = townOf(b.destination);
  const after = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
  const returnBooked = a.others.some(
    (o) =>
      o.id !== b.id &&
      o.service_type === "transfer" &&
      o.status !== "cancelled" &&
      (o.scheduled_at ? new Date(o.scheduled_at).getTime() : 0) > after &&
      from !== null &&
      to !== null &&
      townOf(o.origin) === to &&
      townOf(o.destination) === from,
  );
  return returnBooked ? "return_booked" : null;
}

/** Up to two day tours in the region the ride ended in (none for towns without tours). */
export function toursNear(destination: StoredEnd, tours: readonly DayTour[], max = 2): DayTour[] {
  const town = townOf(destination);
  const region = town ? HUB_REGION[town] : undefined;
  return region ? tours.filter((t) => t.region === region).slice(0, max) : [];
}
