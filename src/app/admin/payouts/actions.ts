"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mark a driver's listed completed trips as settled (paid out, or cash balance received). */
export async function settleDriver(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    await requireRole("admin", "/admin/payouts");
    const driverId = String(fd.get("driver_id") ?? "");
    const ids = String(fd.get("booking_ids") ?? "").split(",").filter((x) => UUID.test(x));
    if (!UUID.test(driverId) || ids.length === 0) throw new InputError("Nothing to settle.");
    if (fd.get("confirm") !== "on") throw new InputError("Tick the box to confirm the money has changed hands.");
    const supabase = (await createSupabaseServerClient())!;
    const { data, error } = await supabase
      .from("bookings")
      .update({ driver_settled_at: new Date().toISOString() })
      .in("id", ids)
      .eq("assigned_driver_id", driverId)
      .eq("status", "completed")
      .is("driver_settled_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new InputError("Those trips were already settled. Reload the page.");
    revalidatePath("/admin/payouts");
  }, "Couldn't mark the trips settled. Please try again.");
}
