"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireRole } from "@/lib/auth";
import { logBookingEvent, sendCancellationNotices } from "@/lib/crmNotices";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { hasContactDetails } from "@/lib/preferences";
import {
  CANCELLED_BY,
  REFUND_METHODS,
  crLocalToIso,
  parseMoney,
  refundByPolicy,
  refundProblem,
  type CancelledBy,
  type RefundMethod,
} from "@/lib/refundPolicy";
import { SIGN_ERROR_CONTACT, cleanSignText, signTextProblem } from "@/lib/sign";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { WA_KINDS, type WaKind } from "@/lib/whatsappMessages";

/*
 * Booking page actions added by CRM part 3 (2026-11-12): WhatsApp log, cancel with refund,
 * refund paid, the team's name-sign override. Kept apart from ./actions.ts to ease merging.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A one-tap WhatsApp message was opened (history only; nothing is sent by us). */
export async function logWhatsAppOpened(bookingId: string, kind: string): Promise<void> {
  const me = await requireRole("admin", "/admin/bookings");
  if (!UUID.test(bookingId) || !(WA_KINDS as readonly string[]).includes(kind)) return;
  await logBookingEvent(bookingId, me.id, "whatsapp_opened", { kind: kind as WaKind });
}

/**
 * Cancel a booking with the refund worked out from the policy (src/lib/refundPolicy.ts). The server
 * works the policy out again and never trusts the page's number; the team may change the refund
 * owed, with a reason. Status + refund row are written together (cancel_booking(), migration 0046).
 * With "notify" ticked, the traveller and the assigned driver are emailed.
 */
export async function cancelWithRefund(_prev: FormState, fd: FormData): Promise<FormState> {
  const lang = await getTeamLang();
  const t = makeT(lang);
  return runAction(async () => {
    const me = await requireRole("admin", "/admin/bookings");
    const id = String(fd.get("id") ?? "");
    if (!UUID.test(id)) throw new InputError(t("No se encontró la reserva.", "Booking not found."));
    const by = String(fd.get("by") ?? "") as CancelledBy;
    if (!CANCELLED_BY.includes(by)) throw new InputError(t("Elija quién cancela.", "Pick who cancels."));
    const nowIso = new Date().toISOString();
    const askedAt = by === "traveller" ? crLocalToIso(String(fd.get("asked_at") ?? "")) : nowIso;
    if (!askedAt) throw new InputError(t("Escriba cuándo llegó el mensaje del viajero.", "Enter when the traveller's message arrived."));
    if (Date.parse(askedAt) > Date.now() + 5 * 60_000)
      throw new InputError(t("La hora del mensaje no puede estar en el futuro.", "The message time can't be in the future."));

    const db = (await createSupabaseServerClient())!;
    const { data: b } = await db
      .from("bookings")
      .select("id, status, scheduled_at, amount_paid, assigned_driver_id")
      .eq("id", id)
      .maybeSingle();
    if (!b) throw new InputError(t("No se encontró la reserva.", "Booking not found."));
    if (b.status === "cancelled") throw new InputError(t("Esta reserva ya está cancelada.", "This booking is already cancelled."));
    const received = Number(b.amount_paid ?? 0);
    const policy = refundByPolicy({ by, pickupAt: b.scheduled_at, askedAt, amountReceived: received, noShow: fd.get("no_show") === "on" });
    const due = parseMoney(String(fd.get("refund_due") ?? ""));
    const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
    const problem = refundProblem(due, policy.refund, received, reason, lang);
    if (problem) throw new InputError(problem);

    const { error } = await db.rpc("cancel_booking", {
      p_booking: id,
      p_by: by,
      p_asked_at: by === "traveller" ? askedAt : null,
      p_hours_before: policy.hoursBefore,
      p_policy: policy.refund,
      p_rule: policy.rule,
      p_due: due,
      p_reason: reason.length >= 3 ? reason : null,
    });
    if (error) {
      if (/already cancelled/.test(error.message)) throw new InputError(t("Esta reserva ya está cancelada.", "This booking is already cancelled."));
      throw new Error(error.message);
    }
    if (fd.get("notify") === "on") {
      const driverId = (b.assigned_driver_id as string | null) ?? null;
      after(() => sendCancellationNotices(id, driverId, { by, amountReceived: received, refundDue: due ?? 0 }, me.id));
    }
    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
  }, t("No se pudo cancelar la reserva. Inténtelo de nuevo.", "Couldn't cancel the booking. Please try again."));
}

/** "Refund paid" by hand (Green Pay isn't connected yet): amount, date and method; or undo it. */
export async function markRefundPaid(_prev: FormState, fd: FormData): Promise<FormState> {
  const lang = await getTeamLang();
  const t = makeT(lang);
  return runAction(async () => {
    await requireRole("admin", "/admin/bookings");
    const id = String(fd.get("id") ?? "");
    if (!UUID.test(id)) throw new InputError(t("No se encontró la reserva.", "Booking not found."));
    const db = (await createSupabaseServerClient())!;
    let patch: Record<string, unknown>;
    if (fd.get("undo") === "1") {
      patch = { refund_paid_amount: null, refund_paid_on: null, refund_method: null };
    } else {
      const amount = parseMoney(String(fd.get("amount") ?? ""));
      const on = String(fd.get("paid_on") ?? "");
      const method = String(fd.get("method") ?? "") as RefundMethod;
      if (!amount || amount <= 0) throw new InputError(t("Escriba el monto devuelto, por ejemplo 45.50.", "Enter the amount refunded, e.g. 45.50."));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) throw new InputError(t("Elija la fecha del reembolso.", "Pick the refund date."));
      if (!REFUND_METHODS.includes(method)) throw new InputError(t("Elija cómo se devolvió.", "Pick how it was refunded."));
      patch = { refund_paid_amount: amount, refund_paid_on: on, refund_method: method };
    }
    const { data, error } = await db.from("booking_refunds").update(patch).eq("booking_id", id).select("booking_id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new InputError(t("Esta reserva no tiene un reembolso registrado.", "This booking has no refund recorded."));
    revalidatePath(`/admin/bookings/${id}`);
  }, t("No se pudo guardar el reembolso.", "Couldn't save the refund."));
}

/**
 * The team sets the name sign (same rules as the traveller's: up to 40 characters, no phone
 * numbers, emails or links, or "no name" → the brand). Allowed even after the driver set off
 * (a confirmation on the page says so). The change history records it with who did it.
 */
export async function setSignByTeam(_prev: FormState, fd: FormData): Promise<FormState> {
  const lang = await getTeamLang();
  const t = makeT(lang);
  return runAction(async () => {
    await requireRole("admin", "/admin/bookings");
    const id = String(fd.get("id") ?? "");
    if (!UUID.test(id)) throw new InputError(t("No se encontró la reserva.", "Booking not found."));
    const choice = String(fd.get("sign_choice") ?? "text");
    const hide = choice === "brand";
    const text = choice === "text" ? cleanSignText(String(fd.get("sign_text") ?? "").slice(0, 200)) : "";
    const problem = signTextProblem(text, hasContactDetails);
    if (problem)
      throw new InputError(
        problem === SIGN_ERROR_CONTACT
          ? t("Sin teléfonos, correos ni enlaces en el rótulo.", "No phone numbers, emails or links on the sign.")
          : t("El rótulo puede tener hasta 40 caracteres.", "The sign can be up to 40 characters."),
      );
    const db = (await createSupabaseServerClient())!;
    const { data, error } = await db
      .from("bookings")
      .update({ sign_text: text || null, sign_hide_name: hide })
      .eq("id", id)
      .eq("service_type", "transfer")
      .not("status", "in", "(completed,cancelled)")
      .select("id");
    if (error) {
      if (/name sign/.test(error.message)) throw new InputError(t("Sin teléfonos, correos ni enlaces en el rótulo.", "No phone numbers, emails or links on the sign."));
      throw new Error(error.message);
    }
    if (!data?.length) throw new InputError(t("El rótulo ya no se puede cambiar en esta reserva.", "The sign can't be changed on this booking any more."));
    revalidatePath(`/admin/bookings/${id}`);
  }, t("No se pudo guardar el rótulo.", "Couldn't save the sign."));
}
