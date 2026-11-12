import "server-only";
import { placeNameFor } from "./catalogEs";
import { SITE_URL, sendEmail } from "./email";
import { parsePublicLang } from "./publicLang";
import { sendPushToEmail } from "./push";
import { driverFirstName, reviewRequestEmail, reviewRequestPush } from "./travellerMessages";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * Ask the traveller to rate their driver, once per booking, as soon as a trip is
 * completed (by the driver or the team). Marks bookings.review_requested_at first
 * so the email can never go out twice; one reminder follows 24 hours later if they
 * haven't rated (src/lib/reviewReminder.ts, /api/cron/review-reminders). Tapping the
 * push opens the trip with the rating panel (`rate`; older app builds open the trip).
 * Never throws.
 */
export async function requestDriverReview(bookingId: string): Promise<void> {
  try {
    const db = createSupabaseAdminClient();
    if (!db) return;
    const { data: b } = await db
      .from("bookings")
      .select("id, status, trip_id, booking_ref, review_requested_at, service_type, origin, destination, assigned_driver_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (!b || b.status !== "completed" || b.review_requested_at || !b.trip_id || !b.assigned_driver_id) return;
    const [{ data: trip }, { data: who }] = await Promise.all([
      db.from("trips").select("guest_name, guest_email, access_token, language").eq("id", b.trip_id).maybeSingle(),
      db.from("profiles").select("full_name").eq("id", b.assigned_driver_id).maybeSingle(),
    ]);
    if (!trip?.guest_email) return;
    const marked = await db
      .from("bookings")
      .update({ review_requested_at: new Date().toISOString() })
      .eq("id", b.id)
      .is("review_requested_at", null)
      .select("id");
    if (!marked.data?.length) return;
    // In the language the traveller booked in.
    const lang = parsePublicLang(trip.language);
    const driver = driverFirstName(lang, who?.full_name, false);
    const ride = b.service_type === "transfer";
    await sendPushToEmail(trip.guest_email, { ...reviewRequestPush(lang, { driver, ride }), data: { screen: "trip", id: b.id, rate: "1" } });
    await sendEmail({
      to: trip.guest_email,
      ...reviewRequestEmail(lang, {
        guestName: trip.guest_name,
        driver,
        ref: b.booking_ref,
        ride,
        origin: placeNameFor(b.origin, lang),
        destination: placeNameFor(b.destination, lang),
        tripUrl: `${SITE_URL}/trip/${trip.access_token}`,
      }),
    });
  } catch (e) {
    console.error("[review request]", e);
  }
}
