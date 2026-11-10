"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireRole } from "@/lib/auth";
import { BOOKING_STATUSES, usd } from "@/lib/bookings";
import { formatScheduledAt } from "@/lib/dates";
import { SITE_URL, sendEmail } from "@/lib/email";
import { notifyDriversOfJobs } from "@/lib/jobAlerts";
import { sendPush, sendPushToEmail } from "@/lib/push";
import { requestDriverReview } from "@/lib/reviewRequest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_IDS = new Set<string>(BOOKING_STATUSES.map(([s]) => s));

/**
 * Accept one driver's offer from the job board: the database function assigns the
 * driver + vehicle, confirms the booking, makes the offer the payout and declines
 * the other offers. Then the driver is emailed.
 */
export async function acceptOffer(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    await requireRole("admin", "/admin/bookings");
    const bidId = String(fd.get("bid_id") ?? "");
    const bookingId = String(fd.get("booking_id") ?? "");
    if (!UUID.test(bidId) || !UUID.test(bookingId)) throw new InputError("That offer isn't open any more.");
    const supabase = (await createSupabaseServerClient())!;
    const { data: ref, error } = await supabase.rpc("accept_offer", { p_bid: bidId });
    if (error) {
      if (/^(That offer|This booking|The offer|Only the team)/.test(error.message)) throw new InputError(error.message);
      throw new Error(error.message);
    }
    const { data: offer } = await supabase.from("bids").select("driver_id, bid_amount").eq("id", bidId).maybeSingle();
    const { data: who } = offer
      ? await supabase.from("profiles").select("full_name, email").eq("id", offer.driver_id).maybeSingle()
      : { data: null };
    const { data: b } = await supabase.from("bookings").select("origin, destination, scheduled_at, trip_id").eq("id", bookingId).maybeSingle();
    // The traveller's contact lives in the server-only trips table.
    const admin = createSupabaseAdminClient();
    const { data: guest } =
      admin && b?.trip_id
        ? await admin.from("trips").select("guest_name, guest_email, access_token").eq("id", b.trip_id).maybeSingle()
        : { data: null };
    after(async () => {
      const when = b?.scheduled_at ? formatScheduledAt(b.scheduled_at) : "";
      if (guest?.guest_email) {
        const first = (who?.full_name ?? "Your driver").split(" ")[0];
        await sendPushToEmail(guest.guest_email, { title: "Your ride is confirmed", body: `${first} will drive you · ${when}`, data: { screen: "trip", id: bookingId } });
        await sendEmail({
          to: guest.guest_email,
          subject: `Your ride is confirmed (${ref}) · ${when}`,
          lines: [
            `Hi ${(guest.guest_name ?? "").split(" ")[0] || "there"},`,
            `Good news: ${first} will drive you, ${b?.origin ?? ""} → ${b?.destination ?? ""}, pickup ${when} (Costa Rica time).`,
            "Your trip page shows your driver's profile and car photos, and has a chat with them and our team.",
          ],
          button: { label: "Open your trip page", url: `${SITE_URL}/trip/${guest.access_token}` },
        });
      }
      if (offer) {
        await sendPush(
          [offer.driver_id],
          { title: `You've got the ride ${ref}`, body: `${b?.origin ?? ""} → ${b?.destination ?? ""} · ${when} · payout ${usd(offer.bid_amount)}`, data: { screen: "trip", id: bookingId } },
          "driver",
        );
      }
      if (!who?.email) return;
      await sendEmail({
        to: who.email,
        subject: `You've got the ride ${ref} · ${when}`,
        lines: [
          `Hi ${(who.full_name ?? "").split(" ")[0] || "there"},`,
          `Your offer was accepted: ${ref}, ${b?.origin ?? ""} → ${b?.destination ?? ""}, pickup ${when} (Costa Rica time).`,
          offer ? `Your payout: ${usd(offer.bid_amount)}.` : "",
          "Open the trip for the exact pickup place, the traveller's requests and the chat. Please introduce yourself there today.",
        ].filter(Boolean),
        button: { label: "Open the trip", url: `${SITE_URL}/driver/trips/${bookingId}` },
      });
    });
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath("/driver/jobs");
    revalidatePath("/driver/trips");
  }, "We couldn't accept this offer. Please reload and try again.");
}

/** Status, assigned driver + vehicle, money received and internal notes for one booking. */
export async function updateBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    await requireRole("admin", "/admin/bookings");
    const id = String(fd.get("id") ?? "");
    if (!UUID.test(id)) throw new InputError("Booking not found.");
    const status = String(fd.get("status") ?? "");
    if (!STATUS_IDS.has(status)) throw new InputError("Pick a status.");

    // "driverId:vehicleId", or empty for nobody yet.
    const assignment = String(fd.get("assignment") ?? "");
    let driverId: string | null = null;
    let vehicleId: string | null = null;
    if (assignment) {
      const [d, v] = assignment.split(":");
      if (!UUID.test(d) || !UUID.test(v)) throw new InputError("Pick a driver and vehicle from the list.");
      driverId = d;
      vehicleId = v;
    }
    if ((status === "confirmed" || status === "in_progress" || status === "completed") && !driverId) {
      throw new InputError("Assign a driver before marking the booking confirmed.");
    }

    const paidRaw = String(fd.get("amount_paid") ?? "").trim() || "0";
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(paidRaw)) throw new InputError("Amount received must look like 45 or 45.50.");
    const notes = String(fd.get("admin_notes") ?? "").trim().slice(0, 2000) || null;

    const supabase = (await createSupabaseServerClient())!;
    const { data: before } = await supabase
      .from("bookings")
      .select("status, trip_id, booking_ref, review_requested_at, service_type, origin, destination")
      .eq("id", id)
      .maybeSingle();
    const { data, error } = await supabase
      .from("bookings")
      .update({
        status,
        assigned_driver_id: driverId,
        assigned_vehicle_id: vehicleId,
        amount_paid: Number(paidRaw),
      })
      .eq("id", id)
      .select("id");
    if (error) {
      if (/vehicle must belong/.test(error.message)) throw new InputError("That vehicle doesn't belong to that driver.");
      throw error;
    }
    if (!data?.length) throw new InputError("Booking not found.");

    // Just opened for drivers: email approved drivers about the job.
    if (status === "pending_bids" && before && before.status !== "pending_bids") {
      after(() => notifyDriversOfJobs([id]));
    }

    // Trip just completed: ask the traveller to rate the driver (once per booking).
    if (status === "completed" && before && before.status !== "completed") {
      after(() => requestDriverReview(id));
    }
    const n = await supabase
      .from("booking_admin_notes")
      .upsert({ booking_id: id, notes: notes ?? "", updated_at: new Date().toISOString() });
    if (n.error) throw n.error;
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath("/admin");
  }, "Couldn't save the booking. Please try again.");
}
