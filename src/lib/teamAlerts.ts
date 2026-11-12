import "server-only";
import { formatScheduledAt } from "./dates";
import { ADMIN_EMAIL, SITE_URL, sendEmail, type Email } from "./email";
import { createSupabaseAdminClient } from "./supabase/admin";
import { deliverTeamAlert, type AlertInput, type AlertResult, type AlertStore, type Recipient } from "./teamAlertCore";
import { alertText, pickupsWithoutDriver, type AlertPrefs, type SendKind, type UnassignedRow } from "./teamAlertRules";
import { vapidFromEnv } from "./webPush";

/**
 * sendTeamAlert(kind, …): the one way to alert the team (CRM part 6, 2026-11-12). Email to
 * ADMIN_NOTIFY_EMAIL as before + Web Push to every admin phone that switched alerts on
 * (/admin/alerts), each alert once (team_alerts), per-admin kinds and quiet hours respected.
 * Push needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT in Vercel; without them only
 * the email goes. Never throws.
 */

type Db = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
/** After this many failed sends in a row (and no success), a phone is dropped. */
const MAX_FAILURES = 30;

function supabaseStore(db: Db): AlertStore {
  const failures = new Map<string, number>();
  return {
    async claim(kind, key, meta) {
      const { data, error } = await db
        .from("team_alerts")
        .upsert(
          { kind, dedupe_key: key.slice(0, 200), title: meta.title.slice(0, 120), body: meta.body.slice(0, 300), url: meta.url.slice(0, 300) },
          { onConflict: "kind,dedupe_key", ignoreDuplicates: true },
        )
        .select("id");
      if (error) {
        // The table isn't there yet (the minutes between a deploy and its migration): send anyway;
        // every alert that repeats on a schedule also has its own once-only mark on the booking.
        console.error("[team alert] claim", error.message);
        return true;
      }
      return (data?.length ?? 0) > 0;
    },
    async recipients() {
      const { data: subs, error } = await db.from("admin_push_subscriptions").select("admin_id, endpoint, p256dh, auth, failures");
      if (error || !subs?.length) return [];
      const ids = [...new Set(subs.map((s) => s.admin_id as string))];
      const [{ data: prefs }, { data: admins }] = await Promise.all([
        db.from("admin_alert_prefs").select("admin_id, muted_kinds, quiet_start, quiet_end").in("admin_id", ids),
        // Someone who is no longer an admin gets nothing, even if their phone is still listed.
        db.from("profiles").select("id").in("id", ids).eq("role", "admin"),
      ]);
      const stillAdmin = new Set((admins ?? []).map((a) => a.id as string));
      return subs
        .filter((s) => stillAdmin.has(s.admin_id as string))
        .map((s): Recipient => {
          failures.set(s.endpoint as string, Number(s.failures ?? 0));
          const p = prefs?.find((x) => x.admin_id === s.admin_id);
          return {
            admin_id: s.admin_id as string,
            endpoint: s.endpoint as string,
            p256dh: s.p256dh as string,
            auth: s.auth as string,
            prefs: p ? ({ muted_kinds: p.muted_kinds ?? [], quiet_start: p.quiet_start, quiet_end: p.quiet_end } as AlertPrefs) : null,
          };
        });
    },
    async markSent(endpoint) {
      await db.from("admin_push_subscriptions").update({ last_success_at: new Date().toISOString(), failures: 0 }).eq("endpoint", endpoint);
    },
    async markFailed(endpoint) {
      const n = (failures.get(endpoint) ?? 0) + 1;
      if (n >= MAX_FAILURES) await db.from("admin_push_subscriptions").delete().eq("endpoint", endpoint);
      else await db.from("admin_push_subscriptions").update({ failures: n }).eq("endpoint", endpoint);
    },
    async remove(endpoint) {
      await db.from("admin_push_subscriptions").delete().eq("endpoint", endpoint);
    },
  };
}

/** Email (when given and ADMIN_NOTIFY_EMAIL is set) + push to the team, once per kind + key. */
export async function sendTeamAlert(kind: SendKind, input: AlertInput<Email>): Promise<AlertResult> {
  const db = createSupabaseAdminClient();
  const email = input.email && input.email.to ? input.email : null;
  if (!db) {
    // No database: email only, without the once-only check (local runs without Supabase).
    return { duplicate: false, emailed: email ? await sendEmail(email) : false, pushed: 0 };
  }
  return deliverTeamAlert({ store: supabaseStore(db), vapid: vapidFromEnv(), sendEmail }, kind, { ...input, email });
}

/** Is there anyone to alert at all (a team email address, or push keys set up)? */
export function teamAlertsConfigured(): boolean {
  return Boolean(ADMIN_EMAIL || vapidFromEnv());
}

export const adminBookingPath = (bookingId: string) => `/admin/bookings/${bookingId}`;

/**
 * "Trip without a driver" (5-minute check, /api/cron/eta): a pickup within 12 hours that still
 * has no driver, booked at least 30 minutes ago. Once per booking: bookings.no_driver_alert_at
 * is claimed first, and only the run that claimed it sends.
 */
export async function alertTripsWithoutDriver(now = new Date()): Promise<number> {
  try {
    const db = createSupabaseAdminClient();
    if (!db || !teamAlertsConfigured()) return 0;
    const { data, error } = await db
      .from("bookings")
      .select("id, booking_ref, status, service_type, origin, destination, scheduled_at, created_at, trip_id, assigned_driver_id, no_driver_alert_at")
      .in("status", ["pending_payment", "pending_bids", "confirmed"])
      .is("assigned_driver_id", null)
      .is("no_driver_alert_at", null)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", new Date(now.getTime() + 12 * 3600000).toISOString())
      .limit(50);
    if (error) {
      // Before migration 0053 the column isn't there: nothing to do yet.
      if (!/no_driver_alert_at/.test(error.message)) console.error("[no driver alert]", error.message);
      return 0;
    }
    let sent = 0;
    type Row = UnassignedRow & { booking_ref: string; service_type: string; origin: string | null; destination: string | null; scheduled_at: string; trip_id: string | null };
    for (const row of pickupsWithoutDriver((data ?? []) as Row[], now)) {
      const claimed = await db
        .from("bookings")
        .update({ no_driver_alert_at: now.toISOString() })
        .eq("id", row.id)
        .is("no_driver_alert_at", null)
        .is("assigned_driver_id", null)
        .select("id");
      if (!claimed.data?.length) continue;
      const { data: trip } = row.trip_id ? await db.from("trips").select("guest_name").eq("id", row.trip_id).maybeSingle() : { data: null };
      const minutes = Math.round((new Date(row.scheduled_at).getTime() - now.getTime()) / 60000);
      const route = row.service_type === "transfer" ? `${row.origin ?? "—"} → ${row.destination ?? "—"}` : row.origin ? `Tour · ${row.origin}` : "Tour";
      const when = formatScheduledAt(row.scheduled_at, "es");
      const push = alertText("no_driver", { ref: row.booking_ref, route, when, minutes, guestName: trip?.guest_name });
      const r = await sendTeamAlert("no_driver", {
        dedupeKey: row.id,
        push: { ...push, url: adminBookingPath(row.id) },
        email: ADMIN_EMAIL
          ? {
              to: ADMIN_EMAIL,
              subject: `SIN CONDUCTOR: ${row.booking_ref} · recogida ${when}`,
              lines: [
                `Faltan unas ${Math.max(0, Math.round(minutes / 60))} horas para la recogida de ${row.booking_ref} y todavía no hay conductor asignado.`,
                `Viaje: ${route}, recogida ${when} (hora de Costa Rica).`,
                "Asigne un conductor en la reserva o en Despacho. Este aviso se envía una sola vez por reserva.",
              ],
              button: { label: "Abrir la reserva", url: `${SITE_URL}${adminBookingPath(row.id)}` },
            }
          : null,
      });
      if (r.emailed || r.pushed) sent++;
    }
    return sent;
  } catch (e) {
    console.error("[no driver alert]", e);
    return 0;
  }
}
