"use server";

import { revalidatePath } from "next/cache";
import { TRIP_TOKEN } from "@/lib/bookings";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { hasContactDetails } from "@/lib/preferences";
import { parseRating } from "@/lib/reviewReminder";
import { cleanSignText, signEditable, signTextProblem, SIGN_ERROR_CONTACT } from "@/lib/sign";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The traveller rates their driver from the private trip page. No account: the
 * private link (token) proves it's them. One rating per booking, only once the
 * trip is completed and a driver was assigned. The stars are required; the words
 * are optional (parseRating). A written comment makes the rating count double
 * (database: driver_reviews.weight); travellers are not told that.
 */
export async function rateDriver(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const token = String(fd.get("token") ?? "");
    const bookingId = String(fd.get("booking_id") ?? "");
    if (!TRIP_TOKEN.test(token) || !UUID.test(bookingId)) throw new InputError("This link isn't valid any more.");
    const rating = parseRating(fd.get("stars"), fd.get("comment"), hasContactDetails);
    if (!rating.ok) throw new InputError(rating.error);
    const { stars, comment } = rating;

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
      comment,
    });
    if (error) {
      if (error.code === "23505") throw new InputError("Thank you, you've already rated this trip.");
      if (/contact details|phone numbers/.test(error.message)) throw new InputError("Please keep phone numbers, emails and links out of the review.");
      throw new Error(error.message);
    }
    revalidatePath(`/trip/${token}`);
  }, "We couldn't save your rating. Please try again.");
}

/**
 * The traveller changes what the driver's name sign says, from the private trip page or the
 * app (src/lib/sign.ts). Fields: token, booking_id, sign_text (empty = none), hide_name ("1" =
 * "Don't show my name"; it wins over a text). Allowed on rides until the driver has
 * tapped "I'm on my way"; after that the sign is read-only.
 */
export async function saveSign(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const token = String(fd.get("token") ?? "");
    const bookingId = String(fd.get("booking_id") ?? "");
    const hide = ["1", "true", "on"].includes(String(fd.get("hide_name") ?? ""));
    // "Don't show my name" wins over a text left in the box (the box is switched off while it is ticked).
    const text = hide ? "" : cleanSignText(String(fd.get("sign_text") ?? "").slice(0, 200));
    if (!TRIP_TOKEN.test(token) || !UUID.test(bookingId)) throw new InputError("This link isn't valid any more.");
    const problem = signTextProblem(text, hasContactDetails);
    if (problem) throw new InputError(problem);

    const db = createSupabaseAdminClient();
    if (!db) throw new Error("Trip pages aren't switched on.");
    const { data: trip } = await db.from("trips").select("id").eq("access_token", token).maybeSingle();
    if (!trip) throw new InputError("This link isn't valid any more.");
    const { data: b } = await db
      .from("bookings")
      .select("id, status, service_type, en_route_at")
      .eq("id", bookingId)
      .eq("trip_id", trip.id)
      .maybeSingle();
    if (!b) throw new InputError("We couldn't find that booking on your trip.");
    if (!signEditable(b)) throw new InputError("The name sign can't be changed any more: your driver is already on the way.");

    // The same condition again in the update, so a change that arrives at the same moment as
    // "I'm on my way" is not saved.
    const { data: saved, error } = await db
      .from("bookings")
      .update({ sign_text: text || null, sign_hide_name: hide })
      .eq("id", b.id)
      .is("en_route_at", null)
      .in("status", ["pending_payment", "pending_bids", "confirmed"])
      .select("id");
    if (error) {
      if (/name sign/.test(error.message)) throw new InputError(SIGN_ERROR_CONTACT);
      throw new Error(error.message);
    }
    if (!saved?.length) throw new InputError("The name sign can't be changed any more: your driver is already on the way.");
    revalidatePath(`/trip/${token}`);
  }, "We couldn't save the name sign. Please try again.");
}
