import "server-only";
import {
  LIST_STATUSES,
  TO_ACT_STATUSES,
  dateWindow,
  pageRange,
  searchOrFilter,
  windowBounds,
  type BookingFilters,
  type ListStatus,
  type StatusFilter,
} from "./adminBookings";
import type { createSupabaseServerClient } from "./supabase/server";

type Db = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/** The parts of a database query the list's filters use. */
interface Filterable<Q> {
  or(filters: string): Q;
  eq(column: string, value: string): Q;
  in(column: string, values: string[]): Q;
  is(column: string, value: null): Q;
  gte(column: string, value: string): Q;
  lt(column: string, value: string): Q;
}

export interface SearchIds {
  /** False when the search text matched no traveller and no driver (only the booking code is searched). */
  tripIds: string[];
  driverIds: string[];
}

/** Trips whose traveller name or email, and drivers whose name, contain the search text. */
export async function searchIds(db: Db, q: string): Promise<SearchIds> {
  if (!q) return { tripIds: [], driverIds: [] };
  const like = `"*${q}*"`;
  const [trips, people] = await Promise.all([
    db.from("trips").select("id").or(`guest_name.ilike.${like},guest_email.ilike.${like}`).limit(200),
    db.from("profiles").select("id").in("role", ["driver", "admin"]).ilike("full_name", `%${q}%`).limit(200),
  ]);
  return {
    tripIds: (trips.data ?? []).map((r) => r.id as string),
    driverIds: (people.data ?? []).map((r) => r.id as string),
  };
}

/** Apply every filter except the page and the sort. `status` overrides the tab (for the tab counts). */
export function applyFilters<Q extends Filterable<Q>>(
  q: Q,
  f: BookingFilters,
  today: string,
  ids: SearchIds,
  status: StatusFilter = f.status,
): Q {
  let out = q;
  if (f.q) out = out.or(searchOrFilter(f.q, ids.tripIds, ids.driverIds));
  if (status === "to_act") out = out.in("status", [...TO_ACT_STATUSES]);
  else if (status !== "all") out = out.eq("status", status);
  if (f.type !== "all") out = out.eq("service_type", f.type);
  if (f.driver === "none") out = out.is("assigned_driver_id", null);
  else if (f.driver !== "all") out = out.eq("assigned_driver_id", f.driver);
  const { gte, lt } = windowBounds(dateWindow(f, today));
  if (gte) out = out.gte("scheduled_at", gte);
  if (lt) out = out.lt("scheduled_at", lt);
  return out;
}

/** A bookings query with a select chosen at run time (kept loosely typed: the rows are cast by the caller). */
interface LooseQuery
  extends Filterable<LooseQuery>,
    PromiseLike<{ data: unknown[] | null; error: { message: string } | null; count: number | null }> {
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): LooseQuery;
  range(from: number, to: number): LooseQuery;
}
const bookingsQuery = (db: Db, select: string, count: boolean, head = false) =>
  (db.from("bookings") as unknown as { select(s: string, o?: { count: "exact"; head?: boolean }): LooseQuery }).select(
    select,
    count ? { count: "exact", head } : undefined,
  );

/** How many bookings each status tab would show with the other filters as they are. */
export async function statusCounts(db: Db, f: BookingFilters, today: string, ids: SearchIds): Promise<Record<ListStatus | "all", number>> {
  const keys = ["all", ...LIST_STATUSES] as const;
  const res = await Promise.all(
    keys.map((s) => applyFilters(bookingsQuery(db, "id", true, true), f, today, ids, s)),
  );
  return Object.fromEntries(keys.map((k, i) => [k, res[i].count ?? 0])) as Record<ListStatus | "all", number>;
}

/** One page of bookings (25), sorted by pickup time, with the total for "1–25 of N". */
export async function bookingsPage<T>(db: Db, select: string, f: BookingFilters, today: string, ids: SearchIds) {
  const { from, to } = pageRange(f.page);
  const res = await applyFilters(bookingsQuery(db, select, true), f, today, ids)
    .order("scheduled_at", { ascending: f.sort === "asc", nullsFirst: false })
    .order("created_at", { ascending: f.sort === "asc" })
    .range(from, to);
  return { data: (res.data ?? []) as T[], error: res.error, count: res.count ?? 0 };
}

/** Every booking that matches (for the CSV), read 1,000 at a time, up to `max`. */
export async function allBookings<T>(db: Db, select: string, f: BookingFilters, today: string, ids: SearchIds, max = 20000) {
  const out: T[] = [];
  for (let start = 0; start < max; start += 1000) {
    const res = await applyFilters(bookingsQuery(db, select, false), f, today, ids)
      .order("scheduled_at", { ascending: f.sort === "asc", nullsFirst: false })
      .order("id", { ascending: true })
      .range(start, Math.min(start + 999, max - 1));
    const data = res.data as T[] | null;
    if (res.error) return { data: out, error: res.error };
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { data: out, error: null };
}
