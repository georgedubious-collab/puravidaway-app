"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireRole } from "@/lib/auth";
import { BOOKING_STATUSES, usd } from "@/lib/bookings";
import { placeNameFor } from "@/lib/catalogEs";
import { formatScheduledAt, formatScheduledAtFor } from "@/lib/dates";
import { SITE_URL, sendEmail } from "@/lib/email";
import { notifyDriversOfJobs } from "@/lib/jobAlerts";
import { parsePublicLang } from "@/lib/publicLang";
import { sendPush, sendPushToEmail } from "@/lib/push";
import { requestDriverReview } from "@/lib/reviewRequest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { clientLanguageNote, driverFirstName, rideConfirmedEmail, rideConfirmedPush } from "@/lib/travellerMessages";
import { getTeamLang } from "@/lib/teamLangServer";
import { alertTeamDriverRemoved, logBookingEvent, sendDriverConfirmed } from "@/lib/crmNotices";
import { driverChange } from "@/lib/driverChange";

/** Did this booking lose a driver before (booking_events "driver_removed", CRM part 3)? */
async function hadDriverRemoved(bookingId: string): Promise<boolean> {
  const db = createSupabaseAdminClient();
  if (!db) return false;
  const { count } = await db.from("booking_events").select("id", { count: "exact", head: true }).eq("booking_id", bookingId).eq("action", "driver_removed");
  return (count ?? 0) > 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_IDS = new Set<string>(BOOKING_STATUSES.map(([s]) => s));

/**
 * Accept one driver's offer from the job board: the database function assigns the
 * driver + vehicle, confirms the booking, makes the offer the payout and declines
 * the other offers. Then the driver is emailed.
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
    const { data: ref, error } = await supabase.rpc("accept_offer", { p_bid: bidId });
    if (error) {
      if (/^(That offer|This booking|The offer|Only the team)/.test(error.message)) throw new InputError(error.message);
      throw new Error(error.message);
    }
    const { data: offer } = await supabase.from("bids").select("driver_id, bid_amount").eq("id", bidId).maybeSingle();
    const { data: who } = offer
      ? await supabase.from("profiles").select("full_name, email").eq("id", offer.driver_id).maybeSingle()
      : { data: null };
    const { data: b } = await supabase.from("bookings").select("origin, destination, scheduled_at, trip_id, service_type").eq("id", bookingId).maybeSingle();
    // The traveller's contact lives in the server-only trips table.
    const admin = createSupabaseAdminClient();
    const { data: guest } =
      admin && b?.trip_id
        ? await admin.from("trips").select("guest_name, guest_email, access_token, language").eq("id", b.trip_id).maybeSingle()
        : { data: null };
    // The traveller hears about it in the language they booked in.
    const guestLang = parsePublicLang(guest?.language);
    after(async () => {
      const when = b?.scheduled_at ? formatScheduledAt(b.scheduled_at) : "";
      if (guest?.guest_email) {
        const driver = driverFirstName(guestLang, who?.full_name);
        const guestWhen = b?.scheduled_at ? formatScheduledAtFor(b.scheduled_at, guestLang) : "";
        await sendPushToEmail(guest.guest_email, {
          ...rideConfirmedPush(guestLang, { driver, when: guestWhen }),
          data: { screen: "trip", id: bookingId },
        });
        await sendEmail({
          to: guest.guest_email,
          ...rideConfirmedEmail(guestLang, {
            ride: b?.service_type === "transfer",
            guestName: guest.guest_name,
            driver,
            ref: String(ref),
            origin: placeNameFor(b?.origin, guestLang),
            destination: placeNameFor(b?.destination, guestLang),
            when: guestWhen,
            tripUrl: `${SITE_URL}/trip/${guest.access_token}`,
          }),
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
          guest ? clientLanguageNote(guestLang) : "",
          "Open the trip for the exact pickup place, the traveller's requests and the chat. Please introduce yourself there today.",
        ].filter(Boolean),
        button: { label: "Open the trip", url: `${SITE_URL}/driver/trips/${bookingId}` },
      });
    });
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath("/driver/jobs");
    revalidatePath("/driver/trips");
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
    const paidRaw = String(fd.get("amount_paid") ?? "").trim() || "0";
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(paidRaw))
      throw new InputError(t("El monto recibido debe escribirse como 45 o 45.50.", "Amount received must look like 45 or 45.50."));
    const notes = String(fd.get("admin_notes") ?? "").trim().slice(0, 2000) || null;

    const supabase = (await createSupabaseServerClient())!;
    const { data: before } = await supabase
      .from("bookings")
      .select("status, trip_id, booking_ref, review_requested_at, service_type, origin, destination, assigned_driver_id, assigned_vehicle_id")
      .eq("id", id)
      .maybeSingle();

    // CRM part 3 (Jorge, 2026-11-12): cancelling goes through "Cancelar reserva" (refund by the policy).
    if (status === "cancelled" && before && before.status !== "cancelled")
      throw new InputError(
        t("Para cancelar use la tarjeta «Cancelar reserva» (calcula el reembolso).", "To cancel, use the \"Cancel booking\" card (it works out the refund)."),
      );
    // Removing or replacing the assigned driver (src/lib/driverChange.ts): say why; the traveller
    // is not told now; a confirmed booking left without a driver goes back to "Open for drivers".
    const removalReason = String(fd.get("removal_reason") ?? "");
    const beforeDriver = (before?.assigned_driver_id as string | null) ?? null;
    const change = driverChange({
      beforeDriver,
      newDriver: driverId,
      status,
      reason: removalReason,
      hadRemovalBefore: Boolean(driverId && driverId !== beforeDriver && status === "confirmed" && !beforeDriver) && (await hadDriverRemoved(id)),
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
        amount_paid: Number(paidRaw),
      })
      .eq("id", id)
      .select("id");
    if (error) {
      if (/vehicle must belong/.test(error.message))
        throw new InputError(t("Ese vehículo no pertenece a ese conductor.", "That vehicle doesn't belong to that driver."));
      throw error;
    }
    if (!data?.length) throw new InputError(t("No se encontró la reserva.", "Booking not found."));

    // Just opened for drivers: email approved drivers about the job.
    if (status === "pending_bids" && before && before.status !== "pending_bids") {
      after(() => notifyDriversOfJobs([id]));
    }

    // Trip just completed: ask the traveller to rate the driver (once per booking).
    if (status === "completed" && before && before.status !== "completed") {
      after(() => requestDriverReview(id));
    }

    // CRM part 3: a driver was removed or replaced. Recorded in the history, the team is emailed,
    // and the traveller hears nothing now. When a NEW driver is assigned on a confirmed booking
    // after a removal, the traveller gets the existing "driver confirmed" email (and the driver
    // "You've got the ride"), as when an offer is accepted.
    if (removedDriver) {
      const reason = removalReason as "driver_dropped" | "team";
      after(async () => {
        const alerted = await alertTeamDriverRemoved(id, removedDriver, reason, driverId, reopened);
        await logBookingEvent(
          id,
          me.id,
          "driver_removed",
          { reason, replaced_by: driverId, reopened, team_alerted: alerted },
          { driver_id: removedDriver, vehicle_id: before?.assigned_vehicle_id ?? null },
        );
      });
    }
    if (change.sendDriverConfirmed && driverId) {
      const newDriver = driverId;
      after(() => sendDriverConfirmed(id, newDriver));
    }
    const n = await supabase
      .from("booking_admin_notes")
      .upsert({ booking_id: id, notes: notes ?? "", updated_at: new Date().toISOString() });
    if (n.error) throw n.error;
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath("/admin");
  }, t("No se pudo guardar la reserva. Inténtelo de nuevo.", "Couldn't save the booking. Please try again."));
}
