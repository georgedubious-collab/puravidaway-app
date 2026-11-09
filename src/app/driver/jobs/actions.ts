"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { usd } from "@/lib/bookings";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "@/lib/email";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Send (or change) an offer on an open job. The database function `offer_job`
 * does the checks: approved driver, own approved vehicle with current documents,
 * enough seats, job still open, amount within 70–130% of the suggested payout.
 * The team compares the offers and accepts one (accept_offer).
 */
export async function offerJob(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver/jobs");
    const bookingId = String(fd.get("booking_id") ?? "");
    const vehicleId = String(fd.get("vehicle_id") ?? "");
    const amountRaw = String(fd.get("amount") ?? "").trim().replace(/[$,\s]/g, "");
    const note = String(fd.get("note") ?? "").trim().slice(0, 300);
    if (!UUID.test(bookingId)) throw new InputError("This job is no longer listed.");
    if (!UUID.test(vehicleId)) throw new InputError("Pick which of your vehicles you'd drive.");
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(amountRaw)) throw new InputError("Enter your offer in dollars, e.g. 130.");
    const amount = Number(amountRaw);

    const supabase = (await createSupabaseServerClient())!;
    const { data: ref, error } = await supabase.rpc("offer_job", {
      p_booking: bookingId,
      p_vehicle: vehicleId,
      p_amount: amount,
      p_note: note || null,
    });
    if (error) {
      // The function raises plain-language messages; anything else is a real failure.
      if (/^(Your driver account|Pick one of|This job|That vehicle|Offers must|Please keep)/.test(error.message)) {
        throw new InputError(error.message);
      }
      throw new Error(error.message);
    }

    // Tell the team. Never blocks the offer.
    after(async () => {
      if (!ADMIN_EMAIL) return;
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `Offer on ${ref}: ${usd(amount)} from ${me.full_name ?? me.email ?? "a driver"}`,
        lines: [
          `${me.full_name ?? "A driver"} offers to drive ${ref} for ${usd(amount)}.`,
          note ? `Their note: ${note}` : "",
          "Compare the offers and accept one on the booking page.",
        ].filter(Boolean),
        button: { label: "Open the booking", url: `${SITE_URL}/admin/bookings/${bookingId}` },
      });
    });
    revalidatePath("/driver/jobs");
    revalidatePath(`/admin/bookings/${bookingId}`);
  }, "We couldn't send your offer. Please reload and try again.");
}

/** Take back an open offer. */
export async function withdrawOffer(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver/jobs");
    const bidId = String(fd.get("bid_id") ?? "");
    if (!UUID.test(bidId)) throw new InputError("That offer isn't open any more.");
    const supabase = (await createSupabaseServerClient())!;
    const { data, error } = await supabase
      .from("bids")
      .update({ status: "withdrawn", updated_at: new Date().toISOString() })
      .eq("id", bidId)
      .eq("driver_id", me.id)
      .eq("status", "submitted")
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new InputError("That offer isn't open any more.");
    revalidatePath("/driver/jobs");
  }, "We couldn't withdraw the offer. Please reload and try again.");
}
