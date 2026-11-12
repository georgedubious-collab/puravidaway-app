import "server-only";
import { assignmentMessages, type AssignmentContext } from "./assignmentMessages";
import { SITE_URL, sendEmail } from "./email";
import { sendPush, sendPushToEmail } from "./push";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * Load what the "driver assigned" messages need (src/lib/assignmentMessages.ts) and return a
 * function that sends them. Load while the request is running, send in `after()` so the team's
 * page doesn't wait for email. Server only: the traveller's contact is read with the service role
 * (trips are server-only) and never goes to the driver.
 */
export async function prepareAssignmentNotices(a: {
  bookingId: string;
  driverId: string;
  /** The accepted offer's amount; null = the booking's suggested payout. */
  payout?: number | string | null;
  viaOffer: boolean;
}): Promise<() => Promise<void>> {
  const db = createSupabaseAdminClient();
  if (!db) return async () => {};
  const [{ data: b }, { data: who }] = await Promise.all([
    db.from("bookings").select("booking_ref, service_type, origin, destination, scheduled_at, driver_payout, trip_id").eq("id", a.bookingId).maybeSingle(),
    db.from("profiles").select("full_name, email, app_lang").eq("id", a.driverId).maybeSingle(),
  ]);
  if (!b) return async () => {};
  const { data: guest } = b.trip_id
    ? await db.from("trips").select("guest_name, guest_email, access_token, language").eq("id", b.trip_id).maybeSingle()
    : { data: null };
  const ctx: AssignmentContext = {
    bookingId: a.bookingId,
    ref: String(b.booking_ref ?? ""),
    serviceType: b.service_type,
    origin: b.origin,
    destination: b.destination,
    scheduledAt: b.scheduled_at,
    payout: a.payout ?? b.driver_payout,
    viaOffer: a.viaOffer,
    driver: { id: a.driverId, fullName: who?.full_name ?? null, email: who?.email ?? null, appLang: who?.app_lang ?? null },
    guest: guest ? { name: guest.guest_name, email: guest.guest_email, accessToken: guest.access_token, language: guest.language } : null,
    siteUrl: SITE_URL,
  };
  const messages = assignmentMessages(ctx);
  return async () => {
    for (const m of messages) {
      try {
        if (m.kind === "traveller_push") await sendPushToEmail(m.toEmail, m.message);
        else if (m.kind === "driver_push") await sendPush([m.userId], m.message, "driver");
        else await sendEmail(m.email);
      } catch (e) {
        console.error("[assignment notice]", m.kind, e);
      }
    }
  };
}
