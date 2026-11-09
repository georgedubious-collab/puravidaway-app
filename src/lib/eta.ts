import "server-only";
import { formatScheduledAt } from "./dates";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "./email";
import { trafficMinutes } from "./googleMaps";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * Will the driver reach the pickup on time? (Jorge, 2026-11-09.)
 *
 * While a driver with a confirmed trip is sharing location, the driver app asks
 * the server to check every few minutes. The server takes the position it has
 * stored (never one sent with the request), asks Google for the drive time to
 * the pickup point with live traffic, and stores the estimated arrival for
 * /admin/live. If the driver would arrive more than LATE_ALERT_MIN after the
 * pickup time, the team is emailed once per booking so they can react.
 */
export const LATE_ALERT_MIN = 20;
/** A position older than this is too old to estimate from (a parked car's last position is still where it is). */
const MAX_POSITION_AGE_MS = 3 * 3600000;
/** This close to the pickup, a driver with no position at all is itself an emergency. */
const NO_SIGNAL_ALERT_MIN = 60;

type Db = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
interface AlertBooking {
  id: string;
  booking_ref: string;
  scheduled_at: string | null;
  origin: string | null;
  destination: string | null;
  trip_id: string | null;
  en_route_at: string | null;
  driverId: string;
}

/** Email the team about one booking, once (bookings.late_alert_at is claimed first). */
async function alertTeam(db: Db, b: AlertBooking, subject: string, what: string[]): Promise<void> {
  const claimed = await db
    .from("bookings")
    .update({ late_alert_at: new Date().toISOString() })
    .eq("id", b.id)
    .is("late_alert_at", null)
    .select("id");
  if (!claimed.data?.length || !ADMIN_EMAIL) return;
  const [{ data: who }, { data: guest }] = await Promise.all([
    db.from("profiles").select("full_name, phone").eq("id", b.driverId).maybeSingle(),
    b.trip_id ? db.from("trips").select("guest_name, guest_phone").eq("id", b.trip_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  await sendEmail({
    to: ADMIN_EMAIL,
    subject,
    lines: [
      ...what.filter(Boolean),
      `Trip: ${b.origin ?? ""} → ${b.destination ?? ""}, pickup ${formatScheduledAt(b.scheduled_at)} (Costa Rica time).`,
      `Driver: ${who?.full_name ?? "—"}${who?.phone ? `, ${who.phone}` : ""}${b.en_route_at ? "" : " (has NOT tapped \"I'm on my way\")"}.`,
      `Traveller: ${guest?.guest_name ?? "—"}${guest?.guest_phone ? `, ${guest.guest_phone}` : ""}.`,
      "This alert is sent once per booking. The live page keeps the estimate up to date.",
    ],
    button: { label: "Open live trips", url: `${SITE_URL}/admin/live` },
  });
}

/**
 * Check every upcoming pickup (scheduled job, every 5 minutes): estimate arrival for
 * drivers with a known position, and raise the alarm when a driver has shared no
 * position at all within NO_SIGNAL_ALERT_MIN minutes of the pickup.
 */
export async function checkAllEtas(): Promise<{ trips: number; checked: number; alerts: number }> {
  const out = { trips: 0, checked: 0, alerts: 0 };
  try {
    const db = createSupabaseAdminClient();
    if (!db) return out;
    const now = Date.now();
    const { data: rows } = await db
      .from("bookings")
      .select("id, booking_ref, scheduled_at, origin, destination, trip_id, en_route_at, late_alert_at, assigned_driver_id")
      .eq("status", "confirmed")
      .not("assigned_driver_id", "is", null)
      .gte("scheduled_at", new Date(now - 30 * 60000).toISOString())
      .lte("scheduled_at", new Date(now + 6 * 3600000).toISOString())
      .limit(200);
    const upcoming = (rows ?? []).filter((b) => b.en_route_at || new Date(b.scheduled_at as string).getTime() <= now + 3 * 3600000);
    out.trips = upcoming.length;
    if (!upcoming.length) return out;
    const { data: locs } = await db
      .from("driver_locations")
      .select("driver_id, booking_id")
      .in("driver_id", upcoming.map((b) => b.assigned_driver_id as string));
    for (const b of upcoming) {
      const driverId = b.assigned_driver_id as string;
      const hasPosition = (locs ?? []).some((l) => l.driver_id === driverId && l.booking_id === b.id);
      if (hasPosition) {
        const r = await checkDriverEta(driverId);
        if (r.checked) out.checked++;
        if (r.checked && (r.lateMin ?? 0) > LATE_ALERT_MIN && !b.late_alert_at) out.alerts++;
        continue;
      }
      const minutesToPickup = Math.round((new Date(b.scheduled_at as string).getTime() - now) / 60000);
      if (minutesToPickup <= NO_SIGNAL_ALERT_MIN && !b.late_alert_at) {
        await alertTeam(db, { ...b, driverId } as AlertBooking, `NO DRIVER LOCATION: ${b.booking_ref} · pickup in ${Math.max(0, minutesToPickup)} min`, [
          `We have no location from the driver and the pickup is in ${Math.max(0, minutesToPickup)} minutes. They may not have the app open, may not have agreed to share location, or may have no signal. Please call them.`,
        ]);
        out.alerts++;
      }
    }
  } catch (e) {
    console.error("[eta] sweep", e);
  }
  return out;
}

export interface EtaResult {
  checked: boolean;
  lateMin?: number;
}

export async function checkDriverEta(driverId: string): Promise<EtaResult> {
  try {
    const db = createSupabaseAdminClient();
    if (!db) return { checked: false };
    const { data: loc } = await db
      .from("driver_locations")
      .select("lat, lng, booking_id, recorded_at, eta_checked_at")
      .eq("driver_id", driverId)
      .maybeSingle();
    if (!loc?.booking_id) return { checked: false };
    const now = Date.now();
    if (now - new Date(loc.recorded_at).getTime() > MAX_POSITION_AGE_MS) return { checked: false };

    const { data: b } = await db
      .from("bookings")
      .select("id, booking_ref, status, scheduled_at, origin, destination, origin_coords, trip_id, late_alert_at, en_route_at")
      .eq("id", loc.booking_id)
      .maybeSingle();
    // Only before the pickup, and only when we know exactly where the pickup is.
    const pickup = b?.origin_coords as { lat?: number; lng?: number } | null;
    if (!b || b.status !== "confirmed" || !b.scheduled_at || typeof pickup?.lat !== "number" || typeof pickup?.lng !== "number") {
      return { checked: false };
    }
    const pickupMs = new Date(b.scheduled_at).getTime();
    // Each check costs a Google traffic request: every 5 minutes in the last hour, every 10 before that.
    const every = pickupMs - now <= 60 * 60000 ? 5 * 60000 : 10 * 60000;
    if (loc.eta_checked_at && now - new Date(loc.eta_checked_at).getTime() < every - 15000) return { checked: false };

    const minutes = await trafficMinutes({ lat: loc.lat, lng: loc.lng }, { lat: pickup.lat, lng: pickup.lng });
    if (minutes === null) {
      await db.from("driver_locations").update({ eta_checked_at: new Date(now).toISOString() }).eq("driver_id", driverId);
      return { checked: false };
    }
    const etaMs = now + minutes * 60000;
    const lateMin = Math.round((etaMs - pickupMs) / 60000);
    await db
      .from("driver_locations")
      .update({ eta_at: new Date(etaMs).toISOString(), late_min: lateMin, eta_checked_at: new Date(now).toISOString() })
      .eq("driver_id", driverId);

    if (lateMin > LATE_ALERT_MIN && !b.late_alert_at) {
      const positionAge = Math.round((now - new Date(loc.recorded_at).getTime()) / 60000);
      await alertTeam(db, { ...b, driverId }, `LATE DRIVER: ${b.booking_ref} · about ${lateMin} min late`, [
        `The driver is about ${minutes} minutes from the pickup with current traffic and would arrive about ${lateMin} minutes late.`,
        positionAge > 10 ? `Their last position is ${positionAge} minutes old (parked, no signal, or the app stopped sharing).` : "",
      ]);
    }
    return { checked: true, lateMin };
  } catch (e) {
    console.error("[eta]", e);
    return { checked: false };
  }
}
