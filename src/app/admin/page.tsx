import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { addDays, todayInCostaRica } from "@/lib/dates";
import { driverIssues, vehicleIssues, type DriverRecord, type VehicleRecord } from "@/lib/driverKyc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

const STATUSES = [
  ["pending_payment", "Solicitudes nuevas / esperando el pago", "New requests / waiting for payment"],
  ["pending_bids", "Recibiendo ofertas de conductores", "Collecting driver offers"],
  ["confirmed", "Confirmado", "Confirmed"],
  ["in_progress", "En ruta", "On the road"],
] as const;

type DriverRow = DriverRecord & {
  profiles: { full_name: string | null; email: string | null } | null;
  driver_vehicles: VehicleRecord[];
};

export default async function AdminDashboard() {
  await requireRole("admin");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const supabase = (await createSupabaseServerClient())!;
  const today = todayInCostaRica();
  const soon = addDays(today, 30);

  const counts = await Promise.all(
    STATUSES.map(async ([status]) => {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      return count ?? 0;
    }),
  );

  const { data: drivers } = await supabase
    .from("drivers")
    .select("*, profiles!drivers_id_fkey(full_name, email), driver_vehicles(*)")
    .returns<DriverRow[]>();

  const pendingKyc = (drivers ?? []).filter(
    (d) =>
      d.kyc_status === "pending" ||
      d.needs_review ||
      (d.kyc_status === "approved" && d.driver_vehicles.some((v) => v.status === "pending" || v.needs_review)),
  );
  const expiring = (drivers ?? [])
    .filter((d) => d.kyc_status === "approved")
    .map((d) => ({
      d,
      issues: [
        ...driverIssues(d, today, soon, lang),
        ...d.driver_vehicles.flatMap((v) => vehicleIssues(v, today, soon, lang)),
      ],
    }))
    .filter((x) => x.issues.length > 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold text-slate-900">{t("Panel", "Dashboard")}</h1>

      <section aria-labelledby="bookings-h">
        <h2 id="bookings-h" className="text-lg font-extrabold text-slate-900">{t("Reservas", "Bookings")}</h2>
        <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-4">
          {STATUSES.map(([status, es, en], i) => (
            <Link
              key={status}
              href={`/admin/bookings?status=${status}`}
              className="rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-400"
            >
              <p className="text-sm text-slate-500">{t(es, en)}</p>
              <p className="text-3xl font-extrabold text-slate-900">{counts[i]}</p>
            </Link>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {t(
            "Las solicitudes de viaje enviadas desde el sitio web llegan a Reservas. El pago con tarjeta llega con la Fase 2d.",
            "Trip requests sent from the website land in Bookings. Card payment comes with Phase 2d.",
          )}
        </p>
      </section>

      <section aria-labelledby="kyc-h" className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 id="kyc-h" className="font-extrabold text-slate-900">{t("Conductores por revisar", "Drivers to review")}</h2>
          {pendingKyc.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t("Ninguno por ahora.", "None right now.")}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {pendingKyc.map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/drivers/${d.id}`} className="font-bold text-emerald-700 underline">
                    {d.profiles?.full_name || d.profiles?.email}
                  </Link>
                  {d.kyc_status === "pending" ? (
                    <span className="text-slate-500"> · {t("solicitud nueva", "new application")}</span>
                  ) : (
                    <span className="text-slate-500"> · {t("cambios o vehículos por revisar", "changes or vehicles to check")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold text-slate-900">{t("Documentos vencidos o por vencer", "Expired or expiring documents")}</h2>
          {expiring.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t("Todos los conductores aprobados están al día.", "All approved drivers are up to date.")}</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {expiring.map(({ d, issues }) => (
                <li key={d.id}>
                  <Link href={`/admin/drivers/${d.id}`} className="font-bold text-emerald-700 underline">
                    {d.profiles?.full_name || d.profiles?.email}
                  </Link>
                  {issues.map((i) => (
                    <span key={i.text} className={`block ${i.blocking ? "font-bold text-red-700" : "text-amber-700"}`}>
                      {i.text}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="text-sm text-slate-600">
        {t("Revise las solicitudes de conductores en", "Review driver applications in")}{" "}
        <Link href="/admin/drivers" className="font-bold text-emerald-700 underline">
          {t("Conductores", "Drivers")}
        </Link>
        {t("; haga admin a alguien en", "; make someone an admin in")}{" "}
        <Link href="/admin/users" className="font-bold text-emerald-700 underline">
          {t("Usuarios y roles", "Users & roles")}
        </Link>
        .
      </p>
    </div>
  );
}
