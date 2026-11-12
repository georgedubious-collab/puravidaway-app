"use server";

import { revalidatePath } from "next/cache";
import { submitTripRequestAsTeam, type TripRequestInput } from "@/app/trip/actions";
import { requireRole } from "@/lib/auth";
import { itemPaymentMode, parsePaymentMode } from "@/lib/cart";
import { getCatalog } from "@/lib/catalogSource";
import { todayInCostaRica } from "@/lib/dates";
import { resolveTransfer } from "@/lib/googleMaps";
import { cashFeeCents } from "@/lib/pricing";
import { localizeServerMessage } from "@/lib/serverMessagesEs";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { parseSpec, priceItem } from "@/lib/tripRequest";

export type TeamQuote =
  | { ok: true; totalCents: number; nightCents: number; cashFeeCents: number; cashFeeBps: number }
  | { ok: false; error: string };

/**
 * Price one item exactly as the website does (same catalog, season, night premium, stops,
 * vehicle rules), so the team sees the price before creating the booking.
 */
export async function quoteForTeam(spec: unknown, date: string, mode: string): Promise<TeamQuote> {
  await requireRole("admin", "/admin/bookings/new");
  const lang = await getTeamLang();
  const t = makeT(lang);
  try {
    let s = parseSpec(spec);
    if (!s) return { ok: false, error: t("Revise los datos del viaje: falta algo o no es válido.", "Check the trip details: something is missing or not valid.") };
    if (typeof date !== "string" || date < todayInCostaRica()) return { ok: false, error: t("La fecha ya pasó o falta.", "The date is missing or in the past.") };
    const catalog = await getCatalog();
    let route = null;
    if (s.kind === "transfer") {
      const r = await resolveTransfer(s);
      s = r.spec;
      route = r.route;
    }
    const p = priceItem(s, date, catalog, route);
    const fee = itemPaymentMode(s.kind, parsePaymentMode(mode)) === "cash_driver" ? cashFeeCents(p.totalCents, catalog.cashFeeBps) : 0;
    return { ok: true, totalCents: p.totalCents, nightCents: p.nightCents, cashFeeCents: fee, cashFeeBps: catalog.cashFeeBps };
  } catch (e) {
    return { ok: false, error: localizeServerMessage((e as Error).message || t("No se pudo calcular el precio.", "Couldn't work out the price."), lang) };
  }
}

export type TeamCreateResult = { ok: true; refs: string[]; ids: string[] } | { ok: false; error: string };

/** Create the booking through the website's own request path (same rows, same checks). */
export async function createTeamBooking(input: TripRequestInput, emailTraveller: boolean): Promise<TeamCreateResult> {
  await requireRole("admin", "/admin/bookings/new");
  const lang = await getTeamLang();
  const res = await submitTripRequestAsTeam(input, emailTraveller);
  if (!res.ok) {
    const changed = "repriced" in res;
    return {
      ok: false,
      error: changed
        ? makeT(lang)("El precio cambió desde que lo calculó. Calcule de nuevo y confirme.", "The price changed since you worked it out. Recalculate and confirm.")
        : localizeServerMessage(res.error, lang),
    };
  }
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return { ok: true, refs: res.refs, ids: res.ids ?? [] };
}
