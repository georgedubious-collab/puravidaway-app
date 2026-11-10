import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { addDays, todayInCostaRica } from "@/lib/dates";
import {
  driverIssues,
  kycStatusLabel,
  missingDriverDetails,
  missingDriverDocs,
  missingVehicleItems,
  vehicleIssues,
  type DriverRecord,
  type VehicleRecord,
} from "@/lib/driverKyc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

type Row = DriverRecord & {
  profiles: { full_name: string | null; email: string | null; phone: string | null } | null;
  driver_vehicles: VehicleRecord[];
};

const vehiclesToCheck = (r: Row) => r.driver_vehicles.filter((v) => v.status === "pending" || v.needs_review).length;

export default async function DriversPage() {
  await requireRole("admin", "/admin/drivers");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase
    .from("drivers")
    .select("*, profiles!drivers_id_fkey(full_name, email, phone), driver_vehicles(*)")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .returns<Row[]>();

  if (error)
    return (
      <p className="font-semibold text-red-700">
        {t("No se pudieron cargar los conductores", "Couldn't load drivers")}: {error.message}
      </p>
    );
  const rows = data ?? [];
  const today = todayInCostaRica();
  const soon = addDays(today, 30);

  const groups: [string, Row[]][] = [
    [t("Esperando revisión", "Waiting for review"), rows.filter((r) => r.kyc_status === "pending")],
    [
      t("Conductores aprobados con cambios o vehículos nuevos por revisar", "Approved drivers with changes or new vehicles to check"),
      rows.filter((r) => r.kyc_status === "approved" && (r.needs_review || vehiclesToCheck(r) > 0)),
    ],
    [
      t("Aprobados", "Approved"),
      rows.filter((r) => r.kyc_status === "approved" && !r.needs_review && vehiclesToCheck(r) === 0),
    ],
    [
      t("No aprobados o suspendidos", "Not approved or suspended"),
      rows.filter((r) => r.kyc_status === "rejected" || r.kyc_status === "suspended"),
    ],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{t("Conductores", "Drivers")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {lang === "en" ? (
            <>
              Drivers apply at <code>/driver</code> and upload their documents there. Open one to see the
              documents and approve, reject or suspend.
            </>
          ) : (
            <>
              Los conductores se postulan en <code>/driver</code> y suben ahí sus documentos. Abra uno para ver
              los documentos y aprobar, rechazar o suspender.
            </>
          )}
        </p>
      </div>
      {groups.map(([title, list]) => (
        <section key={title}>
          <h2 className="text-lg font-extrabold text-slate-900">
            {title} <span className="text-slate-400">({list.length})</span>
          </h2>
          {list.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">{t("Ninguno.", "None.")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {list.map((r) => {
                const todo =
                  missingDriverDocs(r).length +
                  missingDriverDetails(r).length +
                  r.driver_vehicles.reduce((n, v) => n + missingVehicleItems(v).length, 0) +
                  (r.driver_vehicles.length === 0 ? 1 : 0);
                const issues = [...driverIssues(r, today, soon), ...r.driver_vehicles.flatMap((v) => vehicleIssues(v, today, soon))];
                const nv = r.driver_vehicles.length;
                const check = vehiclesToCheck(r);
                return (
                  <li key={r.id}>
                    <Link href={`/admin/drivers/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                      <span>
                        <span className="font-bold text-slate-900">{r.profiles?.full_name || t("(aún sin nombre)", "(no name yet)")}</span>
                        <span className="block text-sm text-slate-500">
                          {r.profiles?.email} ·{" "}
                          {lang === "en"
                            ? `${nv} vehicle${nv === 1 ? "" : "s"}`
                            : `${nv} vehículo${nv === 1 ? "" : "s"}`}{" "}
                          · {kycStatusLabel(r.kyc_status, lang)}
                          {check > 0 && (lang === "en" ? ` · ${check} vehicle(s) to check` : ` · ${check} vehículo(s) por revisar`)}
                        </span>
                      </span>
                      <span className="text-sm font-semibold">
                        {todo > 0 ? (
                          <span className="text-amber-700">
                            {lang === "en"
                              ? `${todo} item${todo === 1 ? "" : "s"} missing`
                              : `${todo} ${todo === 1 ? "dato pendiente" : "datos pendientes"}`}
                          </span>
                        ) : (
                          <span className="text-emerald-700">{t("Completo", "Complete")}</span>
                        )}
                        {issues.some((i) => i.blocking) ? (
                          <span className="block text-red-700">{t("Documentos vencidos: sin viajes", "Documents expired: no trips")}</span>
                        ) : issues.length > 0 ? (
                          <span className="block text-amber-700">
                            {lang === "en"
                              ? `${issues.length} expiry warning${issues.length === 1 ? "" : "s"}`
                              : `${issues.length} ${issues.length === 1 ? "aviso" : "avisos"} de vencimiento`}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
