import "server-only";
import { bookedItemName } from "./catalog";
import { placeNameFor } from "./catalogEs";
import { getCatalog } from "./catalogSource";
import { driverCancelEmail, driverReassignedEmail, driverRemovedTeamEmail, travellerCancelEmail } from "./cancellationMessages";
import { formatScheduledAt, formatScheduledAtFor } from "./dates";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "./email";
import { parsePublicLang } from "./publicLang";
import { createSupabaseAdminClient } from "./supabase/admin";
import { adminBookingPath, sendTeamAlert } from "./teamAlerts";
import { alertText } from "./teamAlertRules";

/**
 * Messages that go out from the booking page's CRM actions (CRM part 3, 2026-11-12). Every one is
 * built from booking data; nothing here ever sends the traveller's contact details or price to a
 * driver. Never throws: a failed email must not undo the team's change.
 */

type Booking = {
  id: string;
  booking_ref: string;
  service_type: string;
  catalog_item_id: string | null;
  origin: string | null;
  destination: string | null;
  scheduled_at: string | null;
  trip_id: string | null;
};
const BOOKING_COLS = "id, booking_ref, service_type, catalog_item_id, origin, destination, scheduled_at, trip_id";

async function whatFor(b: Booking, lang: "en" | "es"): Promise<string> {
  if (b.service_type === "transfer") return `${placeNameFor(b.origin, lang)} → ${placeNameFor(b.destination, lang)}`;
  const catalog = await getCatalog();
  return bookedItemName(catalog.dayTours, b.catalog_item_id, lang) ?? b.catalog_item_id ?? "";
}

/** Record something the server did on a booking (booking_events, service role). */
export async function logBookingEvent(bookingId: string, actorId: string | null, action: string, after: Record<string, unknown>, before: Record<string, unknown> = {}) {
  const db = createSupabaseAdminClient();
  if (!db) return;
  const { error } = await db.from("booking_events").insert({ booking_id: bookingId, actor_id: actorId, action, before, after });
  if (error) console.error("[crm] event", action, error.message);
}

/**
 * The team cancelled a booking with "Avisar al viajero y al conductor" ticked: an email to the
 * traveller (their language) and to the driver who was assigned (their language, Spanish by default).
 */
export async function sendCancellationNotices(
  bookingId: string,
  driverId: string | null,
  c: { by: "traveller" | "team" | "driver" | "weather"; amountReceived: number; refundDue: number },
  actorId: string,
): Promise<void> {
  try {
    const db = createSupabaseAdminClient();
    if (!db) return;
    const { data: b } = await db.from("bookings").select(BOOKING_COLS).eq("id", bookingId).maybeSingle<Booking>();
    if (!b) return;
    const { data: trip } = b.trip_id
      ? await db.from("trips").select("guest_name, guest_email, access_token, language").eq("id", b.trip_id).maybeSingle()
      : { data: null };
    let toTraveller = false;
    if (trip?.guest_email) {
      const lang = parsePublicLang(trip.language);
      const mail = travellerCancelEmail({
        lang,
        guestName: trip.guest_name,
        ref: b.booking_ref,
        what: await whatFor(b, lang),
        when: formatScheduledAtFor(b.scheduled_at, lang),
        by: c.by,
        amountReceived: c.amountReceived,
        refundDue: c.refundDue,
        tripUrl: trip.access_token ? `${SITE_URL}/trip/${trip.access_token}` : null,
      });
      toTraveller = await sendEmail({ to: trip.guest_email, ...mail });
    }
    let toDriver = false;
    if (driverId) {
      const { data: who } = await db.from("profiles").select("full_name, email, app_lang").eq("id", driverId).maybeSingle();
      if (who?.email) {
        const lang = who.app_lang === "en" ? "en" : "es";
        const mail = driverCancelEmail({
          lang,
          driverName: who.full_name,
          ref: b.booking_ref,
          route: await whatFor(b, lang),
          when: formatScheduledAt(b.scheduled_at, lang),
          tripsUrl: `${SITE_URL}/driver/trips`,
        });
        toDriver = await sendEmail({ to: who.email, ...mail });
      }
    }
    await logBookingEvent(bookingId, actorId, "notified", { traveller: toTraveller, driver: toDriver });
  } catch (e) {
    console.error("[crm] cancellation notices", e);
  }
}

/**
 * A driver was removed or replaced: email the team (Spanish) and push the team's phones, except
 * the admin who made the change (src/lib/teamAlerts.ts). The traveller is NOT told here.
 */
export async function alertTeamDriverRemoved(
  bookingId: string,
  removedDriverId: string,
  reason: "driver_dropped" | "team",
  newDriverId: string | null,
  reopened: boolean,
  actorId: string | null = null,
): Promise<boolean> {
  try {
    const db = createSupabaseAdminClient();
    if (!db) return false;
    const { data: b } = await db.from("bookings").select(BOOKING_COLS).eq("id", bookingId).maybeSingle<Booking>();
    if (!b) return false;
    const ids = [removedDriverId, newDriverId].filter((x): x is string => Boolean(x));
    const { data: names } = await db.from("profiles").select("id, full_name").in("id", ids);
    const nameOf = (id: string | null) => (id ? (names?.find((p) => p.id === id)?.full_name ?? "Conductor") : null);
    const mail = driverRemovedTeamEmail({
      ref: b.booking_ref,
      route: await whatFor(b, "es"),
      when: formatScheduledAt(b.scheduled_at, "es"),
      driver: nameOf(removedDriverId) ?? "El conductor",
      reason,
      reopened,
      replacedBy: nameOf(newDriverId),
      bookingUrl: `${SITE_URL}/admin/bookings/${bookingId}`,
    });
    const { data: trip } = b.trip_id ? await db.from("trips").select("guest_name").eq("id", b.trip_id).maybeSingle() : { data: null };
    const push = alertText("driver_removed", {
      ref: b.booking_ref,
      route: await whatFor(b, "es"),
      when: formatScheduledAt(b.scheduled_at, "es"),
      guestName: trip?.guest_name,
      driver: nameOf(removedDriverId),
      reason,
    });
    const r = await sendTeamAlert("driver_removed", {
      // One alert per removal; a double-submitted form within 10 minutes sends nothing more.
      dedupeKey: `${bookingId}:${removedDriverId}:${Math.floor(Date.now() / 600000)}`,
      push: { ...push, url: adminBookingPath(bookingId) },
      email: ADMIN_EMAIL ? { to: ADMIN_EMAIL, subject: mail.subject, lines: mail.lines, button: mail.button } : null,
      exceptAdminId: actorId,
    });
    return r.emailed || r.pushed > 0;
  } catch (e) {
    console.error("[crm] team alert", e);
    return false;
  }
}

/**
 * The team removed a driver (team decision): one short, neutral email to that driver in their
 * language (Spanish by default) saying the trip was reassigned. No reason, no traveller details,
 * no price. Returns whether it was sent.
 */
export async function emailRemovedDriver(bookingId: string, driverId: string): Promise<boolean> {
  try {
    const db = createSupabaseAdminClient();
    if (!db) return false;
    const [{ data: b }, { data: who }] = await Promise.all([
      db.from("bookings").select(BOOKING_COLS).eq("id", bookingId).maybeSingle<Booking>(),
      db.from("profiles").select("full_name, email, app_lang").eq("id", driverId).maybeSingle(),
    ]);
    if (!b || !who?.email) return false;
    const lang = who.app_lang === "en" ? "en" : "es";
    const mail = driverReassignedEmail({
      lang,
      driverName: who.full_name,
      ref: b.booking_ref,
      route: await whatFor(b, lang),
      when: formatScheduledAt(b.scheduled_at, lang),
      tripsUrl: `${SITE_URL}/driver/trips`,
    });
    return await sendEmail({ to: who.email, ...mail });
  } catch (e) {
    console.error("[crm] removed driver email", e);
    return false;
  }
}

