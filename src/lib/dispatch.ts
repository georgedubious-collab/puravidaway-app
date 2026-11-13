/**
 * Dispatch calendar (/admin/dispatch, 2026-11-12): how long each booking keeps a driver busy, and
 * whether giving a driver one more booking clashes with what they already have. Pure functions,
 * no database: the calendar page and its "assign" side panel use them, and
 * `npm run test:dispatch` checks them.
 *
 * BUSY SPAN of a booking = pickup time → estimated end:
 *   - Ride: drive time + every sightseeing stop's (time at the stop + detour minutes). The drive
 *     time is bookings.drive_minutes when the booking has it (the door-to-door time the ride was
 *     priced with: Google's road route for typed places, which includes the Paquera ferry and the
 *     Sierpe → Drake Bay boat, or our town-to-town table); otherwise the catalog's town-to-town
 *     minutes (ROUTE_MINUTES, Drake Bay already includes the boat); otherwise the road route saved
 *     with the booking; otherwise UNKNOWN_DRIVE_MINUTES, marked "estimated". This is the same
 *     sum the driver app shows as "Arrives approx." (public.my_trips(), migration 0035).
 *   - Day tour: the tour's length in the catalog (durationHours), DEFAULT_TOUR_MINUTES if unknown.
 *     It starts and ends in its region's town; the Osa tour in Puerto Jiménez (Jorge, 2026-11-12;
 *     one of our towns since the same day, so travel to and from it is timed like any other town).
 *
 * CLASH between two bookings of one driver (warnings only; the team decides):
 *   - "overlap": the busy spans overlap.
 *   - "too_tight": they don't overlap, but the free time between the end of the earlier one and
 *     the start of the later one is shorter than the drive from the first drop-off to the second
 *     pickup (ROUTE_MINUTES, both ends must be one of our towns) + CLASH_BUFFER_MINUTES (2 h).
 *   - "check_travel": the drop-off or the next pickup is a place we can't map to one of our towns,
 *     so the drive between them is unknown: shown as "check the travel time" instead of a guess,
 *     only when the free time is short enough to matter (under CHECK_TRAVEL_WINDOW_MINUTES).
 *   Only the booking just before and the one just after are checked for travel time (the
 *   bookings around them are covered by those two); overlaps are checked against all.
 *   Cancelled bookings never clash.
 */
import { HUB_IDS, routeMinutes, type AreaId, type HubId } from "./catalog";
import { formatTime12h, scheduledParts } from "./dates";
import { townOf } from "./matching";

/**
 * Extra minutes a driver needs between two jobs on top of the drive between them, in case the
 * first trip runs late (traffic, a late flight, a long stop), plus parking and meeting the next
 * travellers. Jorge, 2026-11-12: 2 hours.
 */
export const CLASH_BUFFER_MINUTES = 120;
/** A ride whose drive time we can't work out counts as this long (the same default as src/lib/matching.ts). */
export const UNKNOWN_DRIVE_MINUTES = 240;
/** A day tour whose length we don't know counts as a full day out. */
export const DEFAULT_TOUR_MINUTES = 8 * 60;
/** A stop that is no longer in the catalog (the same per-stop time as src/lib/matching.ts). */
export const UNKNOWN_STOP_MINUTES = 45;

const isHub = (x: string | null | undefined): x is HubId => typeof x === "string" && (HUB_IDS as readonly string[]).includes(x);

/** The longest drive between two of our towns. */
export const LONGEST_ROUTE_MINUTES = Math.max(...HUB_IDS.flatMap((a) => HUB_IDS.map((b) => routeMinutes(a, b))));
/**
 * With an unknown place, "check the travel time" is shown only when the free time between the two
 * jobs is shorter than the longest drive in the country + the buffer: with more time than that,
 * any drive fits.
 */
export const CHECK_TRAVEL_WINDOW_MINUTES = LONGEST_ROUTE_MINUTES + CLASH_BUFFER_MINUTES;

/**
 * Day tours start and end in their region's town (hotel pickup there). The Osa tour (Sierpe
 * mangroves & Caño Island) starts and ends in Puerto Jiménez (Jorge, 2026-11-12), one of our towns.
 */
const TOUR_REGION_HUB: Record<string, HubId> = {
  Arenal: "Arenal",
  ManuelAntonio: "ManuelAntonio",
  Monteverde: "Monteverde",
  Osa: "PuertoJimenez",
};
/**
 * Day tours that start and end in a place that isn't one of our towns: the drive to or from it
 * can't come from the town table, so the calendar says "check the travel time" and names the
 * place. None today (Puerto Jiménez became one of our towns on 2026-11-12).
 */
const TOUR_REGION_PLACE: Record<string, string> = {};

/** The parts of a booking the calendar needs. */
export interface SpanBooking {
  id: string;
  booking_ref?: string | null;
  status?: string | null;
  service_type?: string | null;
  catalog_item_id?: string | null;
  scheduled_at: string | null;
  origin?: string | null;
  destination?: string | null;
  origin_coords?: Record<string, unknown> | null;
  destination_coords?: Record<string, unknown> | null;
  sightseeing_stops?: { id: string }[] | null;
  drive_minutes?: number | null;
}

/** The catalog bits used: stop times and tour lengths (from getCatalog() on the page). */
export interface SpanCatalog {
  stops: readonly { id: string; durationMin: number; detourMin: number }[];
  dayTours: readonly { id: string; durationHours: number; region?: string }[];
}

export interface BusySpan {
  /** Milliseconds since 1970 (UTC). */
  start: number;
  end: number;
  minutes: number;
  /** Part of the length is a default, not the real drive / tour time. */
  estimated: boolean;
  /** Our town at the pickup and at the drop-off; null when the place isn't mapped to one. */
  from: AreaId | null;
  to: AreaId | null;
  /** A named place outside our towns at the pickup / drop-off (e.g. "Puerto Jiménez"), else null. */
  fromPlace: string | null;
  toPlace: string | null;
}

/** When the driver is busy with this booking, or null without a pickup time. */
export function busySpan(b: SpanBooking, cat: SpanCatalog): BusySpan | null {
  if (!b.scheduled_at) return null;
  const start = new Date(b.scheduled_at).getTime();
  if (!Number.isFinite(start)) return null;
  let minutes: number;
  let estimated = false;
  let from: AreaId | null;
  let to: AreaId | null;
  let fromPlace: string | null = null;
  let toPlace: string | null = null;

  if (b.service_type === "transfer" || !b.service_type) {
    from = townOf(b.origin, b.origin_coords);
    to = townOf(b.destination, b.destination_coords);
    const saved = Number(b.drive_minutes);
    const route = Number((b.origin_coords as { route?: { totalMinutes?: unknown } } | null | undefined)?.route?.totalMinutes);
    let drive: number;
    if (b.drive_minutes != null && Number.isFinite(saved) && saved > 0) drive = saved;
    else if (isHub(from) && isHub(to)) drive = routeMinutes(from, to);
    else if (Number.isFinite(route) && route > 0) drive = route;
    else {
      drive = UNKNOWN_DRIVE_MINUTES;
      estimated = true;
    }
    const stops = (b.sightseeing_stops ?? []).reduce((sum, s) => {
      const c = cat.stops.find((x) => x.id === s.id);
      return sum + (c ? c.durationMin + c.detourMin : UNKNOWN_STOP_MINUTES);
    }, 0);
    minutes = Math.round(drive + stops);
  } else {
    const tour = cat.dayTours.find((t) => t.id === b.catalog_item_id);
    const hub = tour?.region ? (TOUR_REGION_HUB[tour.region] ?? null) : null;
    from = hub;
    // Smart En-Route: the tour is done on the way to another town we don't know here.
    const enRoute = (b.sightseeing_stops ?? []).some((s) => s.id === "en_route_upgrade");
    to = enRoute ? null : hub;
    const place = tour?.region ? (TOUR_REGION_PLACE[tour.region] ?? null) : null;
    fromPlace = place;
    toPlace = enRoute ? null : place;
    if (tour && tour.durationHours > 0) minutes = Math.round(tour.durationHours * 60);
    else {
      minutes = DEFAULT_TOUR_MINUTES;
      estimated = true;
    }
  }
  return { start, end: start + minutes * 60000, minutes, estimated, from, to, fromPlace, toPlace };
}

/** Realistic drive between a drop-off and the next pickup: 0 in the same town, null when unknown. */
export function travelMinutes(from: AreaId | null, to: AreaId | null): number | null {
  if (!from || !to) return null;
  if (from === to) return 0;
  if (!isHub(from) || !isHub(to)) return null;
  return routeMinutes(from, to);
}

export type ClashKind = "overlap" | "too_tight" | "check_travel";

export interface Clash {
  kind: ClashKind;
  /** The driver's other booking. */
  other: { id: string; booking_ref: string | null };
  /** "before": the other booking comes first; "after": it comes after this one. */
  side: "before" | "after";
  /** Free minutes between the two (negative or 0 on an overlap). */
  gapMinutes: number;
  /** Drive minutes between them + buffer, when known ("too_tight"). */
  neededMinutes: number | null;
  /** "check_travel": the named place outside our towns, when we know it (e.g. "Puerto Jiménez"). */
  place?: string | null;
}

const ACTIVE = (s: string | null | undefined) => s !== "cancelled";

/**
 * Clashes between `target` and a driver's other bookings (any status but cancelled). `target`
 * itself (same id) is skipped, so a page can pass all of the driver's bookings.
 */
export function findClashes(target: SpanBooking, others: readonly SpanBooking[], cat: SpanCatalog): Clash[] {
  const t = busySpan(target, cat);
  if (!t || !ACTIVE(target.status)) return [];
  const spans = others
    .filter((o) => o.id !== target.id && ACTIVE(o.status))
    .map((o) => ({ o, s: busySpan(o, cat) }))
    .filter((x): x is { o: SpanBooking; s: BusySpan } => x.s !== null);
  const ref = (o: SpanBooking) => ({ id: o.id, booking_ref: o.booking_ref ?? null });
  const out: Clash[] = [];

  for (const { o, s } of spans) {
    if (s.start < t.end && t.start < s.end) {
      out.push({ kind: "overlap", other: ref(o), side: s.start <= t.start ? "before" : "after", gapMinutes: -Math.round((Math.min(s.end, t.end) - Math.max(s.start, t.start)) / 60000), neededMinutes: null });
    }
  }
  const apart = spans.filter(({ s }) => !(s.start < t.end && t.start < s.end));
  const prev = apart.filter(({ s }) => s.end <= t.start).sort((a, b) => b.s.end - a.s.end)[0];
  const next = apart.filter(({ s }) => s.start >= t.end).sort((a, b) => a.s.start - b.s.start)[0];

  const check = (first: BusySpan, second: BusySpan, other: SpanBooking, side: "before" | "after") => {
    const gap = Math.round((second.start - first.end) / 60000);
    const drive = travelMinutes(first.to, second.from);
    if (drive === null) {
      if (gap < CHECK_TRAVEL_WINDOW_MINUTES)
        out.push({ kind: "check_travel", other: ref(other), side, gapMinutes: gap, neededMinutes: null, place: first.toPlace ?? second.fromPlace ?? null });
      return;
    }
    const needed = drive + CLASH_BUFFER_MINUTES;
    if (gap < needed) out.push({ kind: "too_tight", other: ref(other), side, gapMinutes: gap, neededMinutes: needed });
  };
  if (prev) check(prev.s, t, prev.o, "before");
  if (next) check(t, next.s, next.o, "after");
  return out;
}

/* ---------- Warnings for one driver + vehicle on one booking ---------- */

export type WarningCode = ClashKind | "blocked_day" | "category" | "seats" | "documents" | "review_hold" | "preference";

export interface DispatchWarning {
  code: WarningCode;
  text: string;
}

const hhmm = (ms: number) => scheduledParts(new Date(ms).toISOString())?.time ?? "";
/** "2 h 05 min", "40 min". */
export function durationText(m: number): string {
  const a = Math.abs(Math.round(m));
  const h = Math.floor(a / 60);
  const r = a % 60;
  return h ? `${h} h${r ? ` ${String(r).padStart(2, "0")} min` : ""}` : `${r} min`;
}

/** One line per clash, in the team's language. */
export function clashText(c: Clash, lang: "es" | "en"): string {
  const es = lang === "es";
  const ref = c.other.booking_ref ?? "—";
  if (c.kind === "overlap")
    return es ? `Choca con ${ref}: los horarios se cruzan` : `Clashes with ${ref}: the times overlap`;
  if (c.kind === "too_tight") {
    const gap = durationText(c.gapMinutes);
    const need = durationText(c.neededMinutes ?? 0);
    return c.side === "before"
      ? es
        ? `Muy justo después de ${ref}: ${gap} libres, necesita ${need} (manejo + ${durationText(CLASH_BUFFER_MINUTES)} de margen)`
        : `Too tight after ${ref}: ${gap} free, needs ${need} (drive + ${durationText(CLASH_BUFFER_MINUTES)} margin)`
      : es
        ? `Muy justo antes de ${ref}: ${gap} libres, necesita ${need} (manejo + ${durationText(CLASH_BUFFER_MINUTES)} de margen)`
        : `Too tight before ${ref}: ${gap} free, needs ${need} (drive + ${durationText(CLASH_BUFFER_MINUTES)} margin)`;
  }
  const gap = durationText(c.gapMinutes);
  const where = c.place
    ? es
      ? `${c.place} está fuera de nuestras zonas`
      : `${c.place} is outside our towns`
    : es
      ? "lugar fuera de nuestras zonas"
      : "a place outside our towns";
  return c.side === "before"
    ? es
      ? `Revise el tiempo de traslado desde ${ref} (${gap} libres; ${where})`
      : `Check the travel time from ${ref} (${gap} free; ${where})`
    : es
      ? `Revise el tiempo de traslado hasta ${ref} (${gap} libres; ${where})`
      : `Check the travel time to ${ref} (${gap} free; ${where})`;
}

/** Costa Rica days a span touches (a late ride can end after midnight). */
export function spanDays(s: Pick<BusySpan, "start" | "end">): string[] {
  const first = scheduledParts(new Date(s.start).toISOString())?.ymd;
  const last = scheduledParts(new Date(Math.max(s.start, s.end - 1)).toISOString())?.ymd;
  if (!first) return [];
  return last && last !== first ? [first, last] : [first];
}

/**
 * "8:00–10:45 a. m." / "11:30 a. m.–2:15 p. m." in Costa Rica time, like the rest of the admin
 * (formatTime12h); "8:00–10:45 AM" in English. "+1 día" when it ends the next day.
 */
export function spanLabel(s: Pick<BusySpan, "start" | "end">, lang: "es" | "en" = "es"): string {
  const days = spanDays(s);
  const a = formatTime12h(hhmm(s.start), lang);
  const b = formatTime12h(hhmm(s.end), lang);
  const [aTime, ...aHalf] = a.split(" ");
  const [bTime, ...bHalf] = b.split(" ");
  const sameHalf = aHalf.join(" ") === bHalf.join(" ") && days.length === 1;
  const text = sameHalf ? `${aTime}–${bTime} ${bHalf.join(" ")}` : `${a}–${b}`;
  return `${text}${days.length > 1 ? (lang === "es" ? " (+1 día)" : " (+1 day)") : ""}`;
}

export interface CandidateInput {
  booking: SpanBooking & { vehicle_class?: string | null; passenger_count?: number | null };
  /** The driver's other bookings (any range around the booking; cancelled ones are ignored). */
  driverBookings: readonly SpanBooking[];
  /** Costa Rica days the driver blocked (driver_unavailable). */
  blockedDays: ReadonlySet<string>;
  /** Category / seats / documents / hold, worked out by the page with the existing rules. */
  categoryOk: boolean;
  seatsOk: boolean;
  documentsOk: boolean;
  onHold: boolean;
  /** The traveller's requests this vehicle doesn't meet (prefMismatches). */
  preferences?: string[];
}

/**
 * Everything the team should know before giving this booking to one driver + vehicle: clashes,
 * a blocked day, category, seats, documents, a review hold, the traveller's requests. Never blocks.
 */
export function candidateWarnings(c: CandidateInput, cat: SpanCatalog, lang: "es" | "en" = "es"): DispatchWarning[] {
  const es = lang === "es";
  const out: DispatchWarning[] = [];
  const span = busySpan(c.booking, cat);
  for (const k of findClashes(c.booking, c.driverBookings, cat)) out.push({ code: k.kind, text: clashText(k, lang) });
  if (span && spanDays(span).some((d) => c.blockedDays.has(d)))
    out.push({ code: "blocked_day", text: es ? "Marcó ese día como no disponible" : "Blocked that day as unavailable" });
  if (!c.categoryOk) out.push({ code: "category", text: es ? "La categoría del vehículo no cubre este viaje" : "The vehicle's category doesn't cover this trip" });
  if (!c.seatsOk) out.push({ code: "seats", text: es ? "No tiene asientos para todo el grupo" : "Not enough seats for the group" });
  if (!c.documentsOk) out.push({ code: "documents", text: es ? "Documentos vencidos para esa fecha (licencia, seguro, Dekra o Marchamo)" : "Documents expired for that date (licence, insurance, Dekra or Marchamo)" });
  if (c.onHold) out.push({ code: "review_hold", text: es ? "En pausa: documentos nuevos esperan su revisión" : "On hold: new documents wait for your review" });
  for (const p of c.preferences ?? []) out.push({ code: "preference", text: es ? `Pidió: ${p}` : `Asked: ${p}` });
  return out;
}

/** Short town names for the calendar blocks. */
const SHORT: Record<string, [string, string]> = {
  SJO: ["SJO", "SJO"],
  LIR: ["LIR", "LIR"],
  Arenal: ["La Fortuna", "La Fortuna"],
  ManuelAntonio: ["Manuel Antonio", "Manuel Antonio"],
  Monteverde: ["Monteverde", "Monteverde"],
  Sierpe: ["Sierpe", "Sierpe"],
  DrakeBay: ["Bahía Drake", "Drake Bay"],
  PuertoViejo: ["Puerto Viejo", "Puerto Viejo"],
  Tamarindo: ["Tamarindo", "Tamarindo"],
  PuertoJimenez: ["Puerto Jiménez", "Puerto Jiménez"],
  SouthNicoya: ["Sur de Nicoya", "Southern Nicoya"],
};

/** "La Fortuna", or the first part of a typed place ("Hotel Tabacón"). */
export function shortPlace(text: string | null | undefined, coords: Record<string, unknown> | null | undefined, lang: "es" | "en" = "es"): string {
  const town = townOf(text, coords);
  if (town && SHORT[town]) return SHORT[town][lang === "es" ? 0 : 1];
  const first = (text ?? "").split(",")[0].trim();
  if (!first) return "—";
  return first.length > 22 ? `${first.slice(0, 21)}…` : first;
}
