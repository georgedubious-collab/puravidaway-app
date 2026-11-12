import "server-only";
import { usd } from "./bookings";
import { bookedItemName } from "./catalog";
import { placeNameFor } from "./catalogEs";
import { getCatalog } from "./catalogSource";
import { driverCancelEmail, driverRemovedTeamEmail, travellerCancelEmail } from "./cancellationMessages";
import { formatScheduledAt, formatScheduledAtFor } from "./dates";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "./email";
import { parsePublicLang } from "./publicLang";
import { sendPush, sendPushToEmail } from "./push";
import { createSupabaseAdminClient } from "./supabase/admin";
import { clientLanguageNote, driverFirstName, rideConfirmedEmail, rideConfirmedPush } from "./travellerMessages";

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

/** A driver was removed or replaced: email the team (Spanish). The traveller is NOT told here. */
export async function alertTeamDriverRemoved(
  bookingId: string,
  removedDriverId: string,
  reason: "driver_dropped" | "team",
  newDriverId: string | null,
  reopened: boolean,
): Promise<boolean> {
  try {
    const db = createSupabaseAdminClient();
    if (!db || !ADMIN_EMAIL) return false;
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
    return await sendEmail({ to: ADMIN_EMAIL, subject: mail.subject, lines: mail.lines, button: mail.button });
  } catch (e) {
    console.error("[crm] team alert", e);
    return false;
  }
}

/**
 * A new driver was assigned after the previous one dropped out or was replaced: the traveller gets
 * the existing "driver confirmed" email + push (src/lib/travellerMessages.ts, the same one sent when
 * an offer is accepted), and the new driver the same "You've got the ride" message as acceptOffer.
 */
export async function sendDriverConfirmed(bookingId: string, driverId: string): Promise<void> {
  try {
    const db = createSupabaseAdminClient();
    if (!db) return;
    const { data: b } = await db.from("bookings").select(`${BOOKING_COLS}, driver_payout`).eq("id", bookingId).maybeSingle<Booking & { driver_payout: number | null }>();
    if (!b) return;
    const [{ data: who }, { data: guest }] = await Promise.all([
      db.from("profiles").select("full_name, email").eq("id", driverId).maybeSingle(),
      b.trip_id ? db.from("trips").select("guest_name, guest_email, access_token, language").eq("id", b.trip_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const guestLang = parsePublicLang(guest?.language);
    if (guest?.guest_email) {
      const driver = driverFirstName(guestLang, who?.full_name);
      const when = formatScheduledAtFor(b.scheduled_at, guestLang);
      await sendPushToEmail(guest.guest_email, { ...rideConfirmedPush(guestLang, { driver, when }), data: { screen: "trip", id: bookingId } });
      await sendEmail({
        to: guest.guest_email,
        ...rideConfirmedEmail(guestLang, {
          ride: b.service_type === "transfer",
          guestName: guest.guest_name,
          driver,
          ref: b.booking_ref,
          origin: placeNameFor(b.origin, guestLang),
          destination: placeNameFor(b.destination, guestLang),
          when,
          tripUrl: `${SITE_URL}/trip/${guest.access_token}`,
        }),
      });
    }
    const when = formatScheduledAt(b.scheduled_at);
    const payout = b.driver_payout != null ? ` · payout ${usd(b.driver_payout)}` : "";
    await sendPush([driverId], { title: `You've got the ride ${b.booking_ref}`, body: `${b.origin ?? ""} → ${b.destination ?? ""} · ${when}${payout}`, data: { screen: "trip", id: bookingId } }, "driver");
    if (who?.email) {
      await sendEmail({
        to: who.email,
        subject: `You've got the ride ${b.booking_ref} · ${when}`,
        lines: [
          `Hi ${(who.full_name ?? "").split(" ")[0] || "there"},`,
          `Our team assigned you ${b.booking_ref}, ${b.origin ?? ""} → ${b.destination ?? ""}, pickup ${when} (Costa Rica time).`,
          b.driver_payout != null ? `Your payout: ${usd(b.driver_payout)}.` : "",
          guest ? clientLanguageNote(guestLang) : "",
          "Open the trip for the exact pickup place, the traveller's requests and the chat. Please introduce yourself there today.",
        ].filter(Boolean),
        button: { label: "Open the trip", url: `${SITE_URL}/driver/trips/${bookingId}` },
      });
    }
  } catch (e) {
    console.error("[crm] driver confirmed", e);
  }
}
