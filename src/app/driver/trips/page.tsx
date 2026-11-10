import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { bookingStatusLabel, serviceLabel, usd, type DriverTrip } from "@/lib/bookings";
import { getCatalog } from "@/lib/catalogSource";
import { formatScheduledAt } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { DriverHeader } from "../DriverHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getTeamLang());
  return {
    title: `${t("Mis viajes", "Your trips")} | Costa Rica Private Transfers ${t("Conductores", "Drivers")}`,
    robots: { index: false, follow: false },
  };
}

export default function DriverTripsPage() {
  return (
    <main className="flex-1 bg-slate-50">
      <DriverHeader />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Suspense fallback={<p className="text-sm font-semibold text-slate-500">Cargando… / Loading…</p>}>
          <Trips />
        </Suspense>
      </div>
    </main>
  );
}

async function Trips() {
  const me = await requireUser("/driver/trips");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const supabase = (await createSupabaseServerClient())!;
  // my_trips(): the driver's assigned trips without the client's price (migration 0017).
  const [{ data, error }, catalog] = await Promise.all([
    supabase.rpc("my_trips").then((r) => r as { data: DriverTrip[] | null; error: { message: string } | null }),
    getCatalog(),
  ]);
  void me;
  if (error)
    return (
      <p className="font-semibold text-red-700">
        {t("No se pudieron cargar sus viajes. Recargue la página.", "Couldn't load your trips. Please reload.")}
      </p>
    );
  const trips = data ?? [];
  const name = (b: DriverTrip) =>
    b.service_type === "transfer"
      ? `${b.origin} → ${b.destination}`
      : ([...catalog.dayTours, ...catalog.expeditions].find((x) => x.id === b.catalog_item_id)?.name ?? t("Viaje", "Trip"));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-900">{t("Mis viajes", "Your trips")}</h1>
      {trips.length === 0 ? (
        <p className="text-sm text-slate-600">
          {t("Aún no tiene viajes. Oferte en ", "No trips yet. Claim one on ")}
          <Link href="/driver/jobs" className="font-bold text-emerald-700 underline">
            {t("Trabajos disponibles", "Open jobs")}
          </Link>
          {t(
            " o espere a que nuestro equipo le asigne un viaje; aparecerá aquí con las solicitudes del cliente y un chat.",
            ", or wait for our team to assign you a ride; it appears here with the traveller's requests and a chat.",
          )}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {trips.map((b) => (
            <li key={b.id}>
              <Link href={`/driver/trips/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                <span>
                  <span className="block text-xs font-bold text-slate-500">
                    {formatScheduledAt(b.scheduled_at, lang)} · {serviceLabel(b.service_type, lang)} · <span className="font-mono">{b.booking_ref}</span>
                  </span>
                  <span className="font-bold text-slate-900">{name(b)}</span>
                </span>
                <span className="text-sm font-semibold text-slate-600">
                  {b.driver_payout != null && <span className="mr-2 font-extrabold text-emerald-700">{usd(b.driver_payout)}</span>}
                  {bookingStatusLabel(b.status, lang)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
