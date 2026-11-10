"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { formatScheduledAt } from "@/lib/dates";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { sendPushToEmail } from "@/lib/push";
import { requestDriverReview } from "@/lib/reviewRequest";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The driver's three steps: "I'm on my way", "Client picked up", "Trip ended". The database function
 * `driver_set_trip_status` checks it is their trip and the step is allowed.
 * Completing it asks the traveller for a rating straight away.
 */
export async function setTripStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver/trips");
    const id = String(fd.get("booking_id") ?? "");
    const step = String(fd.get("step") ?? "");
    if (!UUID.test(id) || !["en_route", "in_progress", "completed"].includes(step)) throw new InputError("That step isn't available.");
    const supabase = (await createSupabaseServerClient())!;
    const { data: ref, error } = await supabase.rpc("driver_set_trip_status", { p_booking: id, p_status: step });
    if (error) {
      if (/^(Your driver account|This trip|You can start|Start the trip)/.test(error.message)) throw new InputError(error.message);
      throw new Error(error.message);
    }
    if (step === "en_route") {
      // Tell the traveller their driver has set off (once: the database keeps the first time).
      after(async () => {
        const db = createSupabaseAdminClient();
        if (!db) return;
        const { data: b } = await db.from("bookings").select("trip_id, scheduled_at, en_route_at").eq("id", id).maybeSingle();
        if (!b?.trip_id || !b.en_route_at || Date.now() - new Date(b.en_route_at).getTime() > 60000) return;
        const { data: trip } = await db.from("trips").select("guest_name, guest_email, access_token").eq("id", b.trip_id).maybeSingle();
        if (!trip?.guest_email) return;
        const first = (me.full_name ?? "Your driver").split(" ")[0];
        await sendPushToEmail(trip.guest_email, { title: `${first} is on the way`, body: `Pickup ${formatScheduledAt(b.scheduled_at)}`, data: { screen: "trip", id } });
        await sendEmail({
          to: trip.guest_email,
          subject: `${first} is on the way (${ref})`,
          lines: [
            `Hi ${(trip.guest_name ?? "").split(" ")[0] || "there"},`,
            `${first}, your driver, is on the way to your pickup at ${formatScheduledAt(b.scheduled_at)} (Costa Rica time).`,
            "Your trip page has their profile and car, and a chat with them and our team.",
          ],
          button: { label: "Open your trip page", url: `${SITE_URL}/trip/${trip.access_token}` },
        });
      });
    }
    if (step === "completed") {
      after(async () => {
        await requestDriverReview(id);
        if (ADMIN_EMAIL) {
          await sendEmail({
            to: ADMIN_EMAIL,
            subject: `Trip completed: ${ref} (${me.full_name ?? "driver"})`,
            lines: [`${me.full_name ?? "The driver"} marked ${ref} completed. The traveller has been asked for a rating.`],
            button: { label: "Open the booking", url: `${SITE_URL}/admin/bookings/${id}` },
          });
        }
      });
    }
    revalidatePath(`/driver/trips/${id}`);
    revalidatePath("/driver/trips");
    revalidatePath(`/admin/bookings/${id}`);
  }, "We couldn't update the trip. Please reload and try again.");
}
