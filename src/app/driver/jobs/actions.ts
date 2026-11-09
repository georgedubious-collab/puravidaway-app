"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { usd } from "@/lib/bookings";
import { formatScheduledAt } from "@/lib/dates";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "@/lib/email";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Claim an open job. The database function `claim_job` does the checks (approved
 * driver, own approved vehicle with current documents, enough seats, job still
 * open) and assigns + confirms in one step, so two drivers can't both get it.
 */
export async function claimJob(_prev: FormState, fd: FormData): Promise<FormState> {
  let tripId = "";
  const state = await runAction(async () => {
    const me = await requireUser("/driver/jobs");
    const bookingId = String(fd.get("booking_id") ?? "");
    const vehicleId = String(fd.get("vehicle_id") ?? "");
    if (!UUID.test(bookingId)) throw new InputError("This job is no longer listed.");
    if (!UUID.test(vehicleId)) throw new InputError("Pick which of your vehicles you'll drive.");
    const supabase = (await createSupabaseServerClient())!;
    const { data: ref, error } = await supabase.rpc("claim_job", { p_booking: bookingId, p_vehicle: vehicleId });
    if (error) {
      // The function raises plain-language messages; anything else is a real failure.
      if (/^(Your driver account|Pick one of|This job|That vehicle)/.test(error.message)) throw new InputError(error.message);
      throw new Error(error.message);
    }
    tripId = bookingId;

    // Tell the team and the driver. Never blocks the claim.
    const { data: t } = await supabase.rpc("my_trips");
    const trip = (t as { id: string; scheduled_at: string; origin: string | null; destination: string | null; driver_payout: number | null }[] | null)?.find((x) => x.id === bookingId);
    const when = trip ? formatScheduledAt(trip.scheduled_at) : "";
    const route = trip ? `${trip.origin ?? ""} → ${trip.destination ?? ""}` : String(ref);
    after(async () => {
      if (me.email) {
        await sendEmail({
          to: me.email,
          subject: `You've got the ride ${ref} · ${when}`,
          lines: [
            `Hi ${(me.full_name ?? "").split(" ")[0] || "there"},`,
            `The ride ${ref} is yours: ${route}, pickup ${when} (Costa Rica time).`,
            trip?.driver_payout != null ? `Your payout: ${usd(trip.driver_payout)}.` : "",
            "Open the trip for the exact pickup place, the traveller's requests and the chat. Please introduce yourself there today.",
          ].filter(Boolean),
          button: { label: "Open the trip", url: `${SITE_URL}/driver/trips/${bookingId}` },
        });
      }
      if (ADMIN_EMAIL) {
        await sendEmail({
          to: ADMIN_EMAIL,
          subject: `Job claimed: ${ref} by ${me.full_name ?? me.email ?? "a driver"}`,
          lines: [`${me.full_name ?? "A driver"} claimed ${ref} (${route}, ${when}) and it is now confirmed.`, "Reassign it from the booking page if needed."],
          button: { label: "Open the booking", url: `${SITE_URL}/admin/bookings/${bookingId}` },
        });
      }
    });
    revalidatePath("/driver/jobs");
    revalidatePath("/driver/trips");
    revalidatePath("/admin/bookings");
  }, "We couldn't claim this job. Please reload and try again.");
  if (state.ok && tripId) redirect(`/driver/trips/${tripId}?claimed=1`);
  return state;
}
