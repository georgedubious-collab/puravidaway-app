import "server-only";
import { createSupabaseServerClient } from "./supabase/server";

export interface AdminCounts {
  /** New requests waiting for payment + bookings open for drivers (not confirmed yet). */
  bookingsToAct: number;
  /** On the road, or confirmed with a pickup in the next 3 hours (the live-trips window). */
  live: number;
  /** New driver applications, and approved drivers with changes or vehicles to check. */
  driversToReview: number;
  /** Flagged chat messages / notes not marked reviewed. */
  flagged: number;
}

const HOUR = 3600_000;

/**
 * The side menu's counters, read with the admin's own session (RLS applies). A failed count
 * shows as 0 rather than breaking every admin page.
 */
export async function adminCounts(): Promise<AdminCounts> {
  const db = await createSupabaseServerClient();
  if (!db) return { bookingsToAct: 0, live: 0, driversToReview: 0, flagged: 0 };
  const now = Date.now();
  const [act, road, soon, drivers, flags] = await Promise.all([
    db.from("bookings").select("id", { count: "exact", head: true }).in("status", ["pending_payment", "pending_bids"]),
    db.from("bookings").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .not("assigned_driver_id", "is", null)
      .gte("scheduled_at", new Date(now - 12 * HOUR).toISOString())
      .lte("scheduled_at", new Date(now + 3 * HOUR).toISOString()),
    db
      .from("drivers")
      .select("kyc_status, needs_review, driver_vehicles(status, needs_review)")
      .in("kyc_status", ["pending", "approved"])
      .returns<{ kyc_status: string; needs_review: boolean; driver_vehicles: { status: string; needs_review: boolean }[] }[]>(),
    db.from("contact_flags").select("id", { count: "exact", head: true }).is("reviewed_at", null),
  ]);
  const driversToReview = (drivers.data ?? []).filter(
    (d) =>
      d.kyc_status === "pending" ||
      d.needs_review ||
      (d.kyc_status === "approved" && d.driver_vehicles.some((v) => v.status === "pending" || v.needs_review)),
  ).length;
  return {
    bookingsToAct: act.count ?? 0,
    live: (road.count ?? 0) + (soon.count ?? 0),
    driversToReview,
    flagged: flags.error ? 0 : (flags.count ?? 0),
  };
}
