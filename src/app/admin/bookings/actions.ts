"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireRole } from "@/lib/auth";
import { shouldNotifyAssignment } from "@/lib/assignmentMessages";
import { prepareAssignmentNotices } from "@/lib/assignmentNotices";
import { BOOKING_STATUSES } from "@/lib/bookings";
import { notifyDriversOfJobs } from "@/lib/jobAlerts";
import { requestDriverReview } from "@/lib/reviewRequest";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { alertTeamDriverRemoved, emailRemovedDriver, logBookingEvent } from "@/lib/crmNotices";
import { driverChange } from "@/lib/driverChange";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_IDS = new Set<string>(BOOKING_STATUSES.map(([s]) => s));

/**
 * Accept one driver's offer from the job board: the database function assigns the
 * driver + vehicle, confirms the booking, makes the offer the payout and declines
 * the other offers. Then the driver and the traveller are told.
 */
export async function acceptOffer(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    await requireRole("admin", "/admin/bookings");
    const bidId = String(fd.get("bid_id") ?? "");
    const bookingId = String(fd.get("booking_id") ?? "");
    if (!UUID.test(bidId) || !UUID.test(bookingId))
      throw new InputError(t("Esa oferta ya no está abierta.", "That offer isn't open any more."));
    const supabase = (await createSupabaseServerClient())!;
    const { error } = await supabase.rpc("accept_offer", { p_bid: bidId });
    if (error) {
      if (/^(That offer|This booking|The offer|Only the team)/.test(error.message)) throw new InputError(error.message);
      throw new Error(error.message);
    }
    const { data: offer } = await supabase.from("bids").select("driver_id, bid_amount").eq("id", bidId).maybeSingle();
    // The traveller ("your ride is confirmed") and the driver ("you've got the ride"): the same
    // messages as a manual assignment (src/lib/assignmentMessages.ts).
    if (offer) {
      const send = await prepareAssignmentNotices({ bookingId, driverId: offer.driver_id, payout: offer.bid_amount, viaOffer: true });
      after(send);
    }
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath("/driver/jobs");
    revalidatePath("/driver/trips");
    revalidatePath("/admin/dispatch");
  }, t("No pudimos aceptar esta oferta. Recargue la página e inténtelo de nuevo.", "We couldn't accept this offer. Please reload and try again."));
}

/** Status, assigned driver + vehicle, money received and internal notes for one booking. */
export async function updateBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    const me = await requireRole("admin", "/admin/bookings");
    const id = String(fd.get("id") ?? "");
    if (!UUID.test(id)) throw new InputError(t("No se encontró la reserva.", "Booking not found."));
    let status = String(fd.get("status") ?? "");
    if (!STATUS_IDS.has(status)) throw new InputError(t("Elija un estado.", "Pick a status."));

    // "driverId:vehicleId", or empty for nobody yet.
    const assignment = String(fd.get("assignment") ?? "");
    let driverId: string | null = null;
    let vehicleId: string | null = null;
    if (assignment) {
      const [d, v] = assignment.split(":");
      if (!UUID.test(d) || !UUID.test(v))
        throw new InputError(t("Elija un conductor y un vehículo de la lista.", "Pick a driver and vehicle from the list."));
      driverId = d;
      vehicleId = v;
    }
    // (The "assign a driver before confirming" check runs below, after the driver-removal rules.)

    // The dispatch calendar (/admin/dispatch) sends only status + assignment: a field that isn't
    // sent keeps its value (amount received, internal notes).
    const hasPaid = fd.has("amount_paid");
    const hasNotes = fd.has("admin_notes");
    const paidRaw = String(fd.get("amount_paid") ?? "").trim() || "0";
    if (hasPaid && !/^\d{1,7}(\.\d{1,2})?$/.test(paidRaw))
      throw new InputError(t("El monto recibido debe escribirse como 45 o 45.50.", "Amount received must look like 45 or 45.50."));
    const notes = String(fd.get("admin_notes") ?? "").trim().slice(0, 2000) || null;

    const supabase = (await createSupabaseServerClient())!;
    const { data: before } = await supabase
      .from("bookings")
      .select("status, assigned_driver_id, assigned_vehicle_id, trip_id, booking_ref, review_requested_at, service_type, origin, destination")
      .eq("id", id)
      .maybeSingle();

    // CRM part 3 (Jorge, 2026-11-12): cancelling goes through "Cancelar reserva" (refund by the policy).
    if (status === "cancelled" && before && before.status !== "cancelled")
      throw new InputError(
        t("Para cancelar use la tarjeta «Cancelar reserva» (calcula el reembolso).", "To cancel, use the \"Cancel booking\" card (it works out the refund)."),
      );
    // Removing or replacing the assigned driver (src/lib/driverChange.ts): say why; the traveller
    // is not told now; a confirmed booking left without a driver goes back to "Open for drivers".
    // A form without the reason box (the dispatch calendar) counts as a team decision.
    const removalReason = fd.has("removal_reason") ? String(fd.get("removal_reason") ?? "") : "team";
    const beforeDriver = (before?.assigned_driver_id as string | null) ?? null;
    const change = driverChange({
      beforeDriver,
      newDriver: driverId,
      status,
      reason: removalReason,
    });
    if (change.needsReason)
      throw new InputError(
        t("Diga por qué quita o cambia al conductor (debajo de «Conductor y vehículo»).", "Say why you're removing or changing the driver (below \"Driver and vehicle\")."),
      );
    const removedDriver = change.removed;
    const reopened = change.reopened;
    status = change.status;

    if ((status === "confirmed" || status === "in_progress" || status === "completed") && !driverId) {
      throw new InputError(
        t("Asigne un conductor antes de marcar la reserva como confirmada.", "Assign a driver before marking the booking confirmed."),
      );
    }
    const { data, error } = await supabase
      .from("bookings")
      .update({
        status,
        assigned_driver_id: driverId,
        assigned_vehicle_id: vehicleId,
        ...(hasPaid ? { amount_paid: Number(paidRaw) } : {}),
      })
      .eq("id", id)
      .select("id");
    if (error) {
      if (/vehicle must belong/.test(error.message))
        throw new InputError(t("Ese vehículo no pertenece a ese conductor.", "That vehicle doesn't belong to that driver."));
      throw error;
    }
    if (!data?.length) throw new InputError(t("No se encontró la reserva.", "Booking not found."));

    // A new driver (none → driver, or another driver): the traveller and the driver get the same
    // messages as when an offer is accepted, once per assignment (re-saving sends nothing).
    if (before && driverId && shouldNotifyAssignment(before.assigned_driver_id, driverId)) {
      const send = await prepareAssignmentNotices({ bookingId: id, driverId, viaOffer: false });
      after(send);
    }

    // Just opened for drivers: email approved drivers about the job.
    if (status === "pending_bids" && before && before.status !== "pending_bids") {
      after(() => notifyDriversOfJobs([id]));
    }

    // Trip just completed: ask the traveller to rate the driver (once per booking).
    if (status === "completed" && before && before.status !== "completed") {
      after(() => requestDriverReview(id));
    }

    // CRM part 3 (src/lib/driverChange.ts): a driver was removed or replaced. Recorded in the
    // history, the team is emailed, the traveller hears nothing about the removal; the removed
    // driver gets a neutral "reassigned" email only on a team decision. A new driver's messages
    // come from the one assignment sender above (never a second "driver confirmed").
    if (removedDriver) {
      const reason = removalReason as "driver_dropped" | "team";
      const tellDriver = change.emailRemovedDriver;
      after(async () => {
        const alerted = await alertTeamDriverRemoved(id, removedDriver, reason, driverId, reopened, me.id);
        const driverEmailed = tellDriver ? await emailRemovedDriver(id, removedDriver) : false;
        await logBookingEvent(
          id,
          me.id,
          "driver_removed",
          { reason, replaced_by: driverId, reopened, team_alerted: alerted, driver_emailed: driverEmailed },
          { driver_id: removedDriver, vehicle_id: before?.assigned_vehicle_id ?? null },
        );
      });
    }
    if (hasNotes) {
      const n = await supabase
        .from("booking_admin_notes")
        .upsert({ booking_id: id, notes: notes ?? "", updated_at: new Date().toISOString() });
      if (n.error) throw n.error;
    }
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath("/admin");
    revalidatePath("/admin/dispatch");
  }, t("No se pudo guardar la reserva. Inténtelo de nuevo.", "Couldn't save the booking. Please try again."));
}
