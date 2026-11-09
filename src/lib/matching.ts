/**
 * Driver ↔ job matching (Jorge, 2026-11-09): rank drivers' offers so the team can
 * give priority to (1) a driver whose assigned trip ends where this job starts the
 * same day, with time to spare ("return trip"), or who starts a trip where this
 * job ends; (2) a driver based near the pickup; then spread work (fewer trips
 * first) and prefer lower offers. Pure functions, used by the admin booking page
 * and the driver job board.
 */
import { AREA_IDS, HUBS, routeMinutes, type AreaId, type HubId } from "./catalog";
import { scheduledParts } from "./dates";

/** The bits of a booking the matching needs (works for BookingRow and DriverTrip). */
export interface TripLike {
  id: string;
  booking_ref?: string;
  scheduled_at: string | null;
  origin?: string | null;
  destination?: string | null;
  origin_coords?: Record<string, unknown> | null;
  destination_coords?: Record<string, unknown> | null;
  sightseeing_stops?: { id: string }[] | null;
  status?: string | null;
}

export interface JobLike {
  origin_town: string | null;
  destination_town: string | null;
  scheduled_at: string;
}

const HUB_NAME_TO_ID = new Map(HUBS.map((h) => [h.name, h.id]));

/** Town / area id of one end: from the saved map point, or an older booking's town name. */
export function townOf(text: string | null | undefined, coords: Record<string, unknown> | null | undefined): AreaId | null {
  const t = coords?.town;
  if (typeof t === "string" && (AREA_IDS as readonly string[]).includes(t)) return t as AreaId;
  return text ? (HUB_NAME_TO_ID.get(text) ?? null) : null;
}

/** When the car is free again: pickup + road time (Google's for typed places, our table for towns) + 45 min per stop. */
const DEFAULT_MINUTES = 240;
const STOP_MINUTES = 45;
export function tripDurationMinutes(b: TripLike): number {
  const route = (b.origin_coords as { route?: { totalMinutes?: unknown } } | null | undefined)?.route;
  const fromRoute = Number(route?.totalMinutes);
  const o = townOf(b.origin, b.origin_coords);
  const d = townOf(b.destination, b.destination_coords);
  const isHub = (x: AreaId | null): x is HubId => x !== null && HUBS.some((h) => h.id === x);
  const road = Number.isFinite(fromRoute) && fromRoute > 0 ? fromRoute : isHub(o) && isHub(d) ? routeMinutes(o, d) : DEFAULT_MINUTES;
  return road + (b.sightseeing_stops?.length ?? 0) * STOP_MINUTES;
}

export interface ReturnMatch {
  /** "after": the driver's trip ends where this job starts; "before": this job ends where their trip starts. */
  kind: "after" | "before";
  trip: TripLike;
  /** Free time between the two, in minutes. */
  gapMinutes: number;
}

/** Minimum turnaround and maximum sensible wait between the two trips. */
const MIN_GAP = 30;
const MAX_GAP = 8 * 60;
const ms = (iso: string) => new Date(iso).getTime();

/** The best same-day return-trip match between a job and a driver's assigned trips, if any. */
export function returnMatch(job: JobLike, trips: TripLike[]): ReturnMatch | null {
  const day = scheduledParts(job.scheduled_at)?.ymd;
  if (!day) return null;
  let best: ReturnMatch | null = null;
  for (const t of trips) {
    if (!t.scheduled_at || (t.status && !["confirmed", "in_progress"].includes(t.status))) continue;
    if (scheduledParts(t.scheduled_at)?.ymd !== day) continue;
    const tStart = ms(t.scheduled_at);
    const tEnd = tStart + tripDurationMinutes(t) * 60000;
    const jStart = ms(job.scheduled_at);
    // Their drop-off town is this job's pickup town, and they finish before it starts.
    if (job.origin_town && townOf(t.destination, t.destination_coords) === job.origin_town) {
      const gap = Math.round((jStart - tEnd) / 60000);
      if (gap >= MIN_GAP && gap <= MAX_GAP && (!best || gap < best.gapMinutes)) best = { kind: "after", trip: t, gapMinutes: gap };
    }
    // This job's drop-off town is where their next trip starts, with time to get there.
    if (job.destination_town && townOf(t.origin, t.origin_coords) === job.destination_town) {
      const jEnd = jStart + tripDurationMinutes({ ...job, id: "", origin_coords: null, destination_coords: null, origin: null, destination: null, sightseeing_stops: null } as TripLike & JobLike) * 60000;
      const gap = Math.round((tStart - jEnd) / 60000);
      if (gap >= MIN_GAP && gap <= MAX_GAP && (!best || gap < best.gapMinutes)) best = { kind: "before", trip: t, gapMinutes: gap };
    }
  }
  return best;
}

/** Is the driver based in the job's pickup town / area? */
export function nearHome(homeHub: string | null | undefined, job: JobLike): boolean {
  return Boolean(homeHub) && homeHub === job.origin_town;
}

/** Lower sorts first: return match, then based nearby, then fewer trips, then cheaper. */
export function offerRank(o: { match: ReturnMatch | null; home: boolean; trips: number; amount: number }): number[] {
  return [o.match ? 0 : o.home ? 1 : 2, o.trips, o.amount];
}

export function compareRanks(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export function townName(id: string | null | undefined): string {
  return HUBS.find((h) => h.id === id)?.name ?? (id === "SouthNicoya" ? "Southern Nicoya" : (id ?? "—"));
}
