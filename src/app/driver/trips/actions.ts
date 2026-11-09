"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "@/lib/email";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { requestDriverReview } from "@/lib/reviewRequest";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The driver starts or completes their own trip. The database function
 * `driver_set_trip_status` checks it is their trip and the step is allowed.
 * Completing it asks the traveller for a rating straight away.
 */
export async function setTripStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver/trips");
    const id = String(fd.get("booking_id") ?? "");
    const step = String(fd.get("step") ?? "");
    if (!UUID.test(id) || (step !== "in_progress" && step !== "completed")) throw new InputError("That step isn't available.");
    const supabase = (await createSupabaseServerClient())!;
    const { data: ref, error } = await supabase.rpc("driver_set_trip_status", { p_booking: id, p_status: step });
    if (error) {
      if (/^(Your driver account|This trip|You can start|Start the trip)/.test(error.message)) throw new InputError(error.message);
      throw new Error(error.message);
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
