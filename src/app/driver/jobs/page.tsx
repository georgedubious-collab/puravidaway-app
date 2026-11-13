import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { requireUser } from "@/lib/auth";
import { serviceLabel, usd, type DriverJob, type DriverTrip } from "@/lib/bookings";
import { nearHome, returnMatch, townName as areaName } from "@/lib/matching";
import { HUBS } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalogSource";
import { savedStopLabel } from "@/lib/customStops";
import { formatScheduledAt, todayInCostaRica } from "@/lib/dates";
import { HOLD_MESSAGE, HOLD_MESSAGE_ES, canTakeTrips, vehicleRoadLegal, type DriverRecord, type VehicleRecord } from "@/lib/driverKyc";
import { prefsSummary } from "@/lib/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { seatsFit, vehicleCanServe } from "@/lib/vehicleEligibility";
import { DriverHeader } from "../DriverHeader";
import { offerJob, withdrawOffer } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getTeamLang());
  return {
    title: `${t("Trabajos disponibles", "Open jobs")} | Costa Rica Private Transfers ${t("Conductores", "Drivers")}`,
    robots: { index: false, follow: false },
  };
}

export default function DriverJobsPage() {
  return (
    <main className="flex-1 bg-slate-50">
      <DriverHeader />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Suspense fallback={<p className="text-sm font-semibold text-slate-500">Cargando… / Loading…</p>}>
          <Jobs />
        </Suspense>
      </div>
    </main>
  );
}

/**
 * Open jobs with a suggested payout (never the client's price). The route is
 * town to town here; the exact pickup place comes once the team assigns the
 * driver. Drivers send an offer (the suggested payout or their own amount) and
 * the team picks one.
 */
function gapText(min: number | undefined): string {
  if (min == null) return "";
  return min >= 60 ? `${Math.floor(min / 60)} h` : `${min} min`;
}

async function Jobs() {
  const me = await requireUser("/driver/jobs");
  const lang = await getTeamLang();
  const tt = makeT(lang);
  const supabase = (await createSupabaseServerClient())!;
  const today = todayInCostaRica();
  const [jobs, mine, d, v, catalog] = await Promise.all([
    supabase.rpc("driver_jobs").then((r) => r as { data: DriverJob[] | null; error: { message: string } | null }),
    supabase.rpc("my_trips").then((r) => r as { data: DriverTrip[] | null }),
    supabase.from("drivers").select("*").eq("id", me.id).maybeSingle<DriverRecord>(),
    supabase.from("driver_vehicles").select("*").eq("driver_id", me.id).order("created_at").returns<VehicleRecord[]>(),
    getCatalog(),
  ]);
  if (jobs.error)
    return (
      <p className="font-semibold text-red-700">
        {tt("No se pudieron cargar los trabajos. Recargue la página.", "Couldn't load the jobs. Please reload.")}
      </p>
    );
  const vehicles = (v.data ?? []).filter((x) => x.status === "approved" && vehicleRoadLegal(x, today));
  const ready = Boolean(d.data) && canTakeTrips(d.data!, v.data ?? [], today);
  const townName = (t: string | null) => HUBS.find((h) => h.id === t)?.name ?? t ?? "—";
  const field = "mt-1 block min-h-11 rounded-lg border border-slate-300 px-3 text-base sm:text-sm font-semibold";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{tt("Trabajos disponibles", "Open jobs")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {tt(
            "Cada trabajo muestra un pago sugerido y recibe ofertas durante 1 hora desde que se publica. Envíe una oferta por ese monto, o proponga el suyo, y nuestro equipo elige un conductor. Si lo eligen a usted, el lugar exacto de recogida, las solicitudes del cliente y el chat aparecen en ",
            "Each job shows a suggested payout and takes offers for 1 hour after it's posted. Send an offer at that amount, or name your own, and our team picks a driver. When you're chosen, the exact pickup place, the traveller's requests and the chat open under ",
          )}
          <Link href="/driver/trips" className="font-bold text-emerald-700 underline">
            {tt("Mis viajes", "Your trips")}
          </Link>
          .
        </p>
      </div>

      {d.data?.review_hold && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {lang === "en" ? HOLD_MESSAGE : HOLD_MESSAGE_ES}
        </p>
      )}
      {!ready && !d.data?.review_hold && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {tt(
            "Puede ver los trabajos disponibles, pero para ofertar necesita un perfil aprobado, una licencia vigente y al menos un vehículo aprobado con documentos vigentes.",
            "You can see open jobs, but offering needs an approved profile, a current licence and at least one approved vehicle with current documents.",
          )}{" "}
          <Link href="/driver" className="font-bold underline">
            {tt("Revise su perfil y documentos", "Check your profile & documents")}
          </Link>
          .
        </p>
      )}

      {(jobs.data ?? []).length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          {tt(
            "No hay trabajos disponibles en este momento. Los viajes nuevos aparecen aquí en cuanto nuestro equipo los publica; revise todos los días.",
            "No open jobs right now. New rides appear here as soon as our team posts them; check back daily.",
          )}
        </p>
      ) : (
        <ul className="space-y-3">
          {(jobs.data ?? []).map((j) => {
            const title =
              j.service_type === "transfer"
                ? `${townName(j.origin_town)} → ${townName(j.destination_town)}`
                : (catalog.dayTours.find((t) => t.id === j.catalog_item_id)?.name ?? serviceLabel("day_tour", lang));
            const stops = (j.sightseeing_stops ?? [])
              .map((s) => savedStopLabel(s, catalog.stops))
              .join(", ");
            const asked = prefsSummary(j.preferences, lang);
            const pax = j.passenger_count ?? 1;
            const fit = vehicles.filter(
              (x) => seatsFit(x.passenger_capacity, j.passenger_count) && vehicleCanServe(x.vehicle_class, j.vehicle_class),
            );
            const payout = j.driver_payout != null ? Math.round(Number(j.driver_payout)) : null;
            const open = j.my_offer_status === "submitted";
            const match = returnMatch(j, mine.data ?? []);
            const home = nearHome(d.data?.home_hub, j);
            return (
              <li key={j.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500">
                      {formatScheduledAt(j.scheduled_at, lang)} · {serviceLabel(j.service_type, lang)} · <span className="font-mono">{j.booking_ref}</span>
                    </p>
                    <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
                    <p className="text-sm text-slate-600">
                      {lang === "en" ? `${pax} passenger${pax > 1 ? "s" : ""}` : `${pax} pasajero${pax > 1 ? "s" : ""}`}
                      {j.vehicle_class ? ` · ${catalog.vehicles.find((x) => x.id === j.vehicle_class)?.name ?? j.vehicle_class}` : ""}
                      {stops ? ` · ${tt("Paradas", "Stops")}: ${stops}` : ""}
                    </p>
                    {asked.length > 0 && (
                      <p className="text-sm text-slate-600">
                        {tt("Solicitó", "Asked for")}: {asked.join(", ")}
                      </p>
                    )}
                    {j.driver_notes && <p className="mt-1 text-sm text-slate-700 italic">“{j.driver_notes}”</p>}
                    {match && (
                      <p className="mt-1 inline-block rounded bg-emerald-100 px-1.5 text-xs font-bold text-emerald-900">
                        {match.kind === "after"
                          ? tt(
                              `Viaje de regreso: usted deja clientes en ${areaName(j.origin_town, lang)} ${gapText(match.gapMinutes)} antes de esta recogida`,
                              `Return trip: you drop off in ${areaName(j.origin_town)} ${gapText(match.gapMinutes)} before this pickup`,
                            )
                          : tt(
                              `Le calza antes de su viaje desde ${areaName(j.destination_town, lang)}`,
                              `Fits before your trip from ${areaName(j.destination_town)}`,
                            )}
                      </p>
                    )}
                    {!match && home && (
                      <p className="mt-1 inline-block rounded bg-sky-100 px-1.5 text-xs font-bold text-sky-900">
                        {tt("Empieza en su zona", "Starts in your area")}
                      </p>
                    )}
                  </div>
                  <p className="text-right">
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">{tt("Pago sugerido", "Suggested payout")}</span>
                    <span className="text-2xl font-extrabold text-emerald-700">{payout != null ? usd(payout) : "—"}</span>
                  </p>
                </div>

                {open && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-emerald-900">
                      {tt("Su oferta", "Your offer")}: {usd(j.my_offer ?? 0)} · {tt("esperando al equipo", "waiting for the team")}
                    </span>
                    <ActionForm
                      action={withdrawOffer}
                      lang={lang}
                      submitLabel={tt("Retirar", "Withdraw")}
                      savedLabel={tt("Retirada", "Withdrawn")}
                      className="inline"
                    >
                      <input type="hidden" name="bid_id" value={j.my_offer_id ?? ""} />
                    </ActionForm>
                  </div>
                )}
                {j.my_offer_status === "declined" && (
                  <p className="mt-3 text-sm font-semibold text-slate-500">
                    {tt("Para este trabajo se eligió a otro conductor.", "Another driver was chosen for this one.")}
                  </p>
                )}

                {ready && fit.length > 0 && payout != null ? (
                  <ActionForm
                    action={offerJob}
                    lang={lang}
                    submitLabel={open ? tt("Cambiar mi oferta", "Change my offer") : tt("Enviar mi oferta", "Send my offer")}
                    savedLabel={tt("Oferta enviada", "Offer sent")}
                    className="mt-4 grid gap-3 sm:grid-cols-6 items-end"
                  >
                    <input type="hidden" name="booking_id" value={j.id} />
                    <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                      {tt("Mi oferta (USD)", "My offer (USD)")}
                      <input
                        name="amount"
                        inputMode="decimal"
                        defaultValue={open && j.my_offer != null ? Math.round(Number(j.my_offer)) : payout}
                        className={`${field} w-full`}
                      />
                      <span className="mt-1 block text-[11px] font-normal text-slate-500">
                        {tt("Entre", "Between")} {usd(Math.round(payout * 0.7))} {tt("y", "and")} {usd(Math.round(payout * 1.3))}
                      </span>
                    </label>
                    {fit.length === 1 ? (
                      <input type="hidden" name="vehicle_id" value={fit[0].id} />
                    ) : (
                      <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                        {tt("Vehículo", "Vehicle")}
                        <select name="vehicle_id" className={`${field} w-full`}>
                          {fit.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.make_model ?? tt("Vehículo", "Vehicle")} {x.plate ?? ""} · {x.passenger_capacity ?? "?"} {tt("asientos", "seats")}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className={`text-xs font-bold text-slate-600 ${fit.length === 1 ? "sm:col-span-4" : "sm:col-span-2"}`}>
                      {tt("Nota para el equipo (opcional)", "Note for the team (optional)")}
                      <input
                        name="note"
                        maxLength={300}
                        placeholder={tt("p. ej. Ese día ya estoy en La Fortuna", "e.g. I'm already in La Fortuna that day")}
                        className={`${field} w-full font-normal`}
                      />
                    </label>
                  </ActionForm>
                ) : ready && payout != null ? (
                  <p className="mt-3 text-sm font-semibold text-amber-800">
                    {tt(
                      `Ninguno de sus vehículos aprobados puede tomar este trabajo (asientos para ${pax} y categoría).`,
                      `None of your approved vehicles can take this job (seats for ${pax} and category).`,
                    )}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        {tt(
          "Los pagos incluyen los tiquetes de ferry cuando la ruta usa ferry. Viajes en efectivo: usted cobra el pago del cliente y liquidamos la diferencia cada semana; los viajes pagados en línea se pagan cada semana. Por favor no incluya teléfonos ni enlaces en las notas.",
          "Payouts include ferry tickets where the route takes a ferry. Cash rides: you collect the traveller's payment and we settle the difference weekly; online rides are paid out weekly. Please keep phone numbers and links out of notes.",
        )}
      </p>
    </div>
  );
}
