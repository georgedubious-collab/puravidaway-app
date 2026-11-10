import "server-only";
import { SITE_URL, sendEmail } from "./email";
import { sendPushToEmail } from "./push";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * Ask the traveller to rate their driver, once per booking, as soon as a trip is
 * completed (by the driver or the team). Marks bookings.review_requested_at first
 * so the email can never go out twice; the daily job sends one reminder later.
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
      db.from("trips").select("guest_name, guest_email, access_token").eq("id", b.trip_id).maybeSingle(),
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
    const first = (who?.full_name ?? "your driver").split(" ")[0];
    const ride = b.service_type === "transfer";
    await sendPushToEmail(trip.guest_email, { title: `How was your ${ride ? "ride" : "trip"} with ${first}?`, body: "Tap to rate. It takes 10 seconds.", data: { screen: "trip", id: b.id } });
    await sendEmail({
      to: trip.guest_email,
      subject: `How was your ${ride ? "ride" : "trip"} with ${first}? (${b.booking_ref})`,
      lines: [
        `Hi ${(trip.guest_name ?? "").split(" ")[0] || "there"},`,
        `We hope you enjoyed your ${ride ? `ride ${b.origin ?? ""} → ${b.destination ?? ""}` : "trip"}. Could you take a moment to rate ${first}? It takes 10 seconds, and a few words help even more: our best-rated drivers get more trips.`,
      ],
      button: { label: `Rate ${first}`, url: `${SITE_URL}/trip/${trip.access_token}` },
    });
  } catch (e) {
    console.error("[review request]", e);
  }
}
