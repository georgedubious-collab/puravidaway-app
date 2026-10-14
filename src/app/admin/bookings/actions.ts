"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { BOOKING_STATUSES } from "@/lib/bookings";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_IDS = new Set<string>(BOOKING_STATUSES.map(([s]) => s));

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
    const n = await supabase
      .from("booking_admin_notes")
      .upsert({ booking_id: id, notes: notes ?? "", updated_at: new Date().toISOString() });
    if (n.error) throw n.error;
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath("/admin");
  }, "Couldn't save the booking. Please try again.");
}
