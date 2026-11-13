"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  EDITABLE_BOOKING_COLS,
  NOT_EDITABLE,
  canEditPlaces,
  changeLabel,
  changeValue,
  currentMoney,
  moneyPatch,
  parseEditInput,
  scheduleResets,
  type EditableBooking,
  type Money,
} from "@/lib/bookingEdit";
import { EditError, planBookingEdit, prepareEditNotices, type EditPlan } from "@/lib/bookingEditServer";
import { getCatalog } from "@/lib/catalogSource";
import { todayInCostaRica } from "@/lib/dates";
import type { PromoCodeRow } from "@/lib/promo";
import { localizeServerMessage } from "@/lib/serverMessagesEs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

/*
 * "Cambiar recogida, destino y hora" on the booking page (Jorge, 2026-11-12; src/lib/bookingEdit.ts).
 * Admins only. Step 1 previews (what changes, the new route's price); step 2 saves with the team's
 * price choice. The price never changes unless the team picks "use the new price".
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PreviewMoney = Pick<Money, "total_price" | "driver_payout" | "platform_fee" | "night_premium" | "cash_fee" | "promo_discount">;

export type EditPreview =
  | {
      ok: true;
      changes: { label: string; before: string; after: string }[];
      price:
        | { state: "unaffected" | "same" }
        | { state: "error"; message: string }
        | { state: "new"; before: PreviewMoney; keep: PreviewMoney; update: PreviewMoney; offerAccepted: boolean };
      driveMinutes: { before: number | null; after: number | null };
      routeKm: number | null;
      warnings: string[];
      notifies: { traveller: boolean; driver: boolean };
    }
  | { ok: false; error: string };

export type EditSaveResult = { ok: true } | { ok: false; error: string };

type Loaded = { b: EditableBooking & { en_route_at: string | null; trips: { guest_email: string | null } | null }; plan: EditPlan };

const pick = (m: Money): PreviewMoney => ({
  total_price: m.total_price,
  driver_payout: m.driver_payout,
  platform_fee: m.platform_fee,
  night_premium: m.night_premium,
  cash_fee: m.cash_fee,
  promo_discount: m.promo_discount,
});

async function load(bookingId: string, raw: unknown, lang: TeamLang): Promise<Loaded | { error: string }> {
  const t = makeT(lang);
  if (!UUID.test(bookingId)) return { error: t("No se encontró la reserva.", "Booking not found.") };
  const db = (await createSupabaseServerClient())!;
  const { data: b } = await db
    .from("bookings")
    .select(`${EDITABLE_BOOKING_COLS}, en_route_at, trips(guest_email)`)
    .eq("id", bookingId)
    .maybeSingle<Loaded["b"]>();
  if (!b) return { error: t("No se encontró la reserva.", "Booking not found.") };
  if (!canEditPlaces(b.status)) return { error: t(NOT_EDITABLE.es, NOT_EDITABLE.en) };
  const parsed = parseEditInput(raw, b.service_type, todayInCostaRica());
  if (!parsed.ok) return { error: t(parsed.error.es, parsed.error.en) };
  const [catalog, code] = await Promise.all([
    getCatalog(),
    b.promo_code
      ? db.from("promo_codes").select("discount_type, value, applies_to").eq("code", b.promo_code).maybeSingle<Pick<PromoCodeRow, "discount_type" | "value" | "applies_to">>()
      : Promise.resolve({ data: null }),
  ]);
  try {
    const plan = await planBookingEdit(b, parsed.input, catalog, code.data ?? null);
    return { b, plan };
  } catch (e) {
    if (e instanceof EditError) return { error: localizeServerMessage(e.message, lang) };
    throw e;
  }
}

/** Step 1: what would change, and the new route's price (nothing is saved). */
export async function previewBookingEdit(bookingId: string, raw: unknown): Promise<EditPreview> {
  await requireRole("admin", `/admin/bookings/${bookingId}`);
  const lang = await getTeamLang();
  const t = makeT(lang);
  try {
    const r = await load(bookingId, raw, lang);
    if ("error" in r) return { ok: false, error: r.error };
    const { b, plan } = r;
    if (plan.changes.length === 0) return { ok: false, error: t("No cambió nada.", "Nothing changed.") };
    const warnings: string[] = [];
    if (b.en_route_at)
      warnings.push(t("El conductor ya va en camino: llámelo o escríbale además del aviso.", "The driver is already on the way: call or message them as well as the notice."));
    if (plan.price.state === "new" && Number(b.amount_paid ?? 0) > 0)
      warnings.push(
        t(
          `Ya se recibieron $${Number(b.amount_paid).toFixed(2)}. Si usa el precio nuevo, arregle la diferencia con el viajero (cobro o reembolso a mano).`,
          `$${Number(b.amount_paid).toFixed(2)} was already received. If you use the new price, settle the difference with the traveller (charge or refund by hand).`,
        ),
      );
    if (b.status === "pending_bids")
      warnings.push(
        t(
          "Está publicada para los conductores: las ofertas recibidas se hicieron para el viaje anterior. Considere volver a publicarla.",
          "It's posted to the drivers: offers already received were made for the old trip. Consider reposting it.",
        ),
      );
    if (b.assigned_driver_id && plan.changes.some((c) => c.field === "scheduled_at"))
      warnings.push(t("Revise en el calendario que la nueva hora no choque con otro viaje del conductor.", "Check on the calendar that the new time doesn't clash with the driver's other trips."));
    const price: Extract<EditPreview, { ok: true }>["price"] =
      plan.price.state === "new"
        ? { state: "new", before: pick(plan.price.before), keep: pick(plan.price.keep), update: pick(plan.price.update), offerAccepted: plan.price.offerAccepted }
        : plan.price.state === "error"
          ? { state: "error", message: localizeServerMessage(plan.price.message, lang) }
          : { state: plan.price.state };
    return {
      ok: true,
      changes: plan.changes.map((c) => ({ label: changeLabel(c.field, lang), before: changeValue(c, "before", lang, true), after: changeValue(c, "after", lang, true) })),
      price,
      driveMinutes: plan.driveMinutes,
      routeKm: plan.route?.km ?? null,
      warnings,
      notifies: { traveller: Boolean(b.trips?.guest_email), driver: Boolean(b.assigned_driver_id) },
    };
  } catch (e) {
    console.error("[booking edit] preview", e);
    return { ok: false, error: t("No se pudo revisar el cambio. Inténtelo de nuevo.", "Couldn't check the change. Please try again.") };
  }
}

/**
 * Step 2: save. `priceChoice` "keep" (default) leaves every money column as it is; "new" uses the
 * new price (`expectedTotal` = the one the team saw; a different one is refused so they look
 * again). `updatePayout`: with an accepted offer, also set the payout from the usual split.
 */
export async function saveBookingEdit(
  bookingId: string,
  raw: unknown,
  opts: { priceChoice: "keep" | "new"; updatePayout: boolean; expectedTotal: number | null; notify: boolean },
): Promise<EditSaveResult> {
  const me = await requireRole("admin", `/admin/bookings/${bookingId}`);
  const lang = await getTeamLang();
  const t = makeT(lang);
  try {
    const r = await load(bookingId, raw, lang);
    if ("error" in r) return { ok: false, error: r.error };
    const { b, plan } = r;
    if (plan.changes.length === 0) return { ok: false, error: t("No cambió nada.", "Nothing changed.") };

    const before = currentMoney(b);
    let money: Money | null = null;
    if (opts?.priceChoice === "new") {
      if (plan.price.state !== "new")
        return { ok: false, error: t("El precio ya no es el que vio. Revise los cambios otra vez.", "The price isn't the one you saw any more. Review the changes again.") };
      money = opts.updatePayout || !plan.price.offerAccepted ? plan.price.update : plan.price.keep;
      if (opts.expectedTotal === null || Math.round(opts.expectedTotal * 100) !== Math.round(money.total_price * 100))
        return { ok: false, error: t("El precio cambió desde que lo revisó. Revise los cambios otra vez.", "The price changed since you reviewed it. Review the changes again.") };
      if (money.platform_fee !== null && money.platform_fee < 0)
        return {
          ok: false,
          error: t("Con ese precio, el pago al conductor sería mayor que el precio. Actualice también el pago al conductor o mantenga el precio.", "At that price the driver's payout would be more than the price. Update the payout too, or keep the price."),
        };
    }
    const nowMs = Date.now();
    const patch = {
      ...plan.patch,
      ...(money ? moneyPatch(before, money) : {}),
      ...scheduleResets(plan.changes, String(plan.patch.scheduled_at ?? b.scheduled_at ?? ""), nowMs),
    };
    const db = (await createSupabaseServerClient())!;
    // The admin's own session: the history trigger records who did it (migration 0056).
    const { data, error } = await db.from("bookings").update(patch).eq("id", b.id).not("status", "in", "(completed,cancelled)").select("id");
    if (error) {
      if (/no_contact_details|pickup_place_shape/.test(error.message)) return { ok: false, error: t("Sin teléfonos, correos ni enlaces.", "No phone numbers, emails or links.") };
      throw error;
    }
    if (!data?.length) return { ok: false, error: t(NOT_EDITABLE.es, NOT_EDITABLE.en) };

    // Promo code: its record follows the new discount (money report, promo usage).
    if (money && plan.price.state === "new" && b.promo_code && money.promo_discount !== before.promo_discount) {
      const admin = createSupabaseAdminClient();
      const line = plan.price.line;
      const red = await admin
        ?.from("promo_redemptions")
        .update({ discount: line.discountCents / 100, platform_part: line.platformCents / 100, driver_part: line.driverCents / 100 })
        .eq("booking_id", b.id);
      if (red?.error) console.error("[booking edit] promo redemption", red.error.message);
    }

    if (opts?.notify) {
      const send = await prepareEditNotices({
        bookingId: b.id,
        actorId: me.id,
        changes: plan.changes,
        price: money && money.total_price !== before.total_price ? { before: before.total_price, after: money.total_price } : null,
        payout: money && money.driver_payout !== before.driver_payout ? { before: before.driver_payout, after: money.driver_payout } : null,
      });
      after(send);
    }
    revalidatePath(`/admin/bookings/${b.id}`);
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/dispatch");
    revalidatePath("/admin");
    revalidatePath("/driver/trips");
    return { ok: true };
  } catch (e) {
    console.error("[booking edit] save", e);
    return { ok: false, error: t("No se pudo guardar el cambio. Inténtelo de nuevo.", "Couldn't save the change. Please try again.") };
  }
}
