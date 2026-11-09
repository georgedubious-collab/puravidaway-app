"use server";

import { revalidatePath } from "next/cache";
import { TRIP_TOKEN } from "@/lib/bookings";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { hasContactDetails } from "@/lib/preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The traveller rates their driver from the private trip page. No account: the
 * private link (token) proves it's them. One rating per booking, only once the
 * trip is completed and a driver was assigned. A written comment makes the
 * rating count double (database: driver_reviews.weight).
 */
export async function rateDriver(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const token = String(fd.get("token") ?? "");
    const bookingId = String(fd.get("booking_id") ?? "");
    const stars = Number(fd.get("stars"));
    const comment = String(fd.get("comment") ?? "").trim().slice(0, 1000);
    if (!TRIP_TOKEN.test(token) || !UUID.test(bookingId)) throw new InputError("This link isn't valid any more.");
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new InputError("Pick 1 to 5 stars.");
    if (comment && hasContactDetails(comment)) throw new InputError("Please keep phone numbers, emails and links out of the review.");

    const db = createSupabaseAdminClient();
    if (!db) throw new Error("Reviews aren't switched on.");
    const { data: trip } = await db.from("trips").select("id").eq("access_token", token).maybeSingle();
    if (!trip) throw new InputError("This link isn't valid any more.");
    const { data: b } = await db
      .from("bookings")
      .select("id, status, assigned_driver_id")
      .eq("id", bookingId)
      .eq("trip_id", trip.id)
      .maybeSingle();
    if (!b) throw new InputError("We couldn't find that booking on your trip.");
    if (b.status !== "completed" || !b.assigned_driver_id) throw new InputError("You can rate your driver once the trip is completed.");

    const { error } = await db.from("driver_reviews").insert({
      booking_id: b.id,
      driver_id: b.assigned_driver_id,
      trip_id: trip.id,
      stars,
      comment: comment || null,
    });
    if (error) {
      if (error.code === "23505") throw new InputError("Thank you, you've already rated this trip.");
      if (/contact details|phone numbers/.test(error.message)) throw new InputError("Please keep phone numbers, emails and links out of the review.");
      throw new Error(error.message);
    }
    revalidatePath(`/trip/${token}`);
  }, "We couldn't save your rating. Please try again.");
}
