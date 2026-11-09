import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { requireUser } from "@/lib/auth";
import { SERVICE_LABEL, usd, type DriverJob } from "@/lib/bookings";
import { HUBS } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalogSource";
import { formatScheduledAt, todayInCostaRica } from "@/lib/dates";
import { canTakeTrips, vehicleRoadLegal, type DriverRecord, type VehicleRecord } from "@/lib/driverKyc";
import { prefsSummary } from "@/lib/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DriverHeader } from "../DriverHeader";
import { claimJob } from "./actions";

export const metadata: Metadata = { title: "Open jobs | PuraVidaWay Drivers", robots: { index: false, follow: false } };

export default function DriverJobsPage() {
  return (
    <main className="flex-1 bg-slate-50">
      <DriverHeader />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Suspense fallback={<p className="text-sm font-semibold text-slate-500">Loading…</p>}>
          <Jobs />
        </Suspense>
      </div>
    </main>
  );
}

/**
 * Open jobs with the driver's payout (never the client's price). The route is
 * town to town here; the exact pickup place comes with the claim. First qualified
 * driver to claim gets the job.
 */
async function Jobs() {
  const me = await requireUser("/driver/jobs");
  const supabase = (await createSupabaseServerClient())!;
  const today = todayInCostaRica();
  const [jobs, d, v, catalog] = await Promise.all([
    supabase.rpc("driver_jobs").then((r) => r as { data: DriverJob[] | null; error: { message: string } | null }),
    supabase.from("drivers").select("*").eq("id", me.id).maybeSingle<DriverRecord>(),
    supabase.from("driver_vehicles").select("*").eq("driver_id", me.id).order("created_at").returns<VehicleRecord[]>(),
    getCatalog(),
  ]);
  if (jobs.error) return <p className="font-semibold text-red-700">Couldn&apos;t load the jobs. Please reload.</p>;
  const vehicles = (v.data ?? []).filter((x) => x.status === "approved" && vehicleRoadLegal(x, today));
  const ready = Boolean(d.data) && canTakeTrips(d.data!, v.data ?? [], today);
  const townName = (t: string | null) => HUBS.find((h) => h.id === t)?.name ?? t ?? "—";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Open jobs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fixed payouts, first come first served. Claim a job and it&apos;s yours: the exact pickup
          place, the traveller&apos;s requests and the chat open right away.
        </p>
      </div>

      {!ready && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You can see open jobs, but claiming needs an approved profile, a current licence and at
          least one approved vehicle with current documents.{" "}
          <Link href="/driver" className="font-bold underline">Check your profile &amp; documents</Link>.
        </p>
      )}

      {(jobs.data ?? []).length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          No open jobs right now. New rides appear here as soon as our team posts them; check back
          daily.
        </p>
      ) : (
        <ul className="space-y-3">
          {(jobs.data ?? []).map((j) => {
            const title =
              j.service_type === "transfer"
                ? `${townName(j.origin_town)} → ${townName(j.destination_town)}`
                : (catalog.dayTours.find((t) => t.id === j.catalog_item_id)?.name ?? "Day tour");
            const stops = (j.sightseeing_stops ?? [])
              .map((s) => (s.id === "en_route_upgrade" ? "Smart En-Route Transfer" : (catalog.stops.find((x) => x.id === s.id)?.name ?? s.id)))
              .join(", ");
            const asked = prefsSummary(j.preferences);
            const fit = vehicles.filter((x) => (x.passenger_capacity ?? 0) >= (j.passenger_count ?? 1));
            return (
              <li key={j.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500">
                      {formatScheduledAt(j.scheduled_at)} · {SERVICE_LABEL[j.service_type]} · <span className="font-mono">{j.booking_ref}</span>
                    </p>
                    <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
                    <p className="text-sm text-slate-600">
                      {j.passenger_count ?? 1} passenger{(j.passenger_count ?? 1) > 1 ? "s" : ""}
                      {j.vehicle_class ? ` · ${catalog.vehicles.find((x) => x.id === j.vehicle_class)?.name ?? j.vehicle_class}` : ""}
                      {stops ? ` · Stops: ${stops}` : ""}
                    </p>
                    {asked.length > 0 && <p className="text-sm text-slate-600">Asked for: {asked.join(", ")}</p>}
                    {j.driver_notes && <p className="mt-1 text-sm text-slate-700 italic">“{j.driver_notes}”</p>}
                  </div>
                  <p className="text-right">
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Your payout</span>
                    <span className="text-2xl font-extrabold text-emerald-700">{j.driver_payout != null ? usd(j.driver_payout) : "—"}</span>
                  </p>
                </div>
                {ready && fit.length > 0 ? (
                  <ActionForm action={claimJob} submitLabel="Claim this job" savedLabel="Claimed" className="mt-4 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="booking_id" value={j.id} />
                    {fit.length === 1 ? (
                      <input type="hidden" name="vehicle_id" value={fit[0].id} />
                    ) : (
                      <label className="text-xs font-bold text-slate-600">
                        Vehicle
                        <select name="vehicle_id" className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-2 text-sm font-semibold">
                          {fit.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.make_model ?? "Vehicle"} {x.plate ?? ""} · {x.passenger_capacity ?? "?"} seats
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </ActionForm>
                ) : ready ? (
                  <p className="mt-3 text-sm font-semibold text-amber-800">
                    None of your approved vehicles seats {j.passenger_count ?? 1}.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        Payouts include ferry tickets where the route takes a ferry. Cash rides: you collect the
        traveller&apos;s payment and we settle the difference weekly; online rides are paid out weekly.
      </p>
    </div>
  );
}
