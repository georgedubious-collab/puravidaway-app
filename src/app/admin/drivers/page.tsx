import Link from "next/link";
import { Card, Chip, EmptyState, Notice, PageHeader } from "@/components/admin/ui";
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
      <Notice tone="red" role="alert">
        {t("No se pudieron cargar los conductores", "Couldn't load drivers")}: {error.message}
      </Notice>
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
    <div className="space-y-5">
      <PageHeader
        title={t("Conductores", "Drivers")}
        subtitle={
          lang === "en" ? (
            <>
              Drivers apply at <code>/driver</code> and upload their documents there. Open one to see the documents and approve,
              reject or suspend.
            </>
          ) : (
            <>
              Los conductores se postulan en <code>/driver</code> y suben ahí sus documentos. Abra uno para ver los documentos y
              aprobar, rechazar o suspender.
            </>
          )
        }
      />
      {groups.map(([title, list], gi) => (
        <Card
          key={title}
          padded={false}
          id={`drivers-g${gi}`}
          title={
            <>
              {title} <span className="font-bold text-[#9AA8A1]">({list.length})</span>
            </>
          }
        >
          {list.length === 0 ? (
            <EmptyState title={t("Ninguno.", "None.")} />
          ) : (
            <ul className="divide-y divide-[#EDF1EE]">
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
                    <Link href={`/admin/drivers/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-[#FAFBFA] sm:px-5">
                      <span className="min-w-0">
                        <span className="font-bold text-[#14231C]">{r.profiles?.full_name || t("(aún sin nombre)", "(no name yet)")}</span>
                        <span className="block break-all text-sm text-[#5F6F67]">
                          {r.profiles?.email} ·{" "}
                          {lang === "en" ? `${nv} vehicle${nv === 1 ? "" : "s"}` : `${nv} vehículo${nv === 1 ? "" : "s"}`} ·{" "}
                          {kycStatusLabel(r.kyc_status, lang)}
                          {check > 0 && (lang === "en" ? ` · ${check} vehicle(s) to check` : ` · ${check} vehículo(s) por revisar`)}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {todo > 0 ? (
                          <Chip tone="amber">
                            {lang === "en" ? `${todo} item${todo === 1 ? "" : "s"} missing` : `${todo} ${todo === 1 ? "dato pendiente" : "datos pendientes"}`}
                          </Chip>
                        ) : (
                          <Chip tone="green">{t("Completo", "Complete")}</Chip>
                        )}
                        {issues.some((i) => i.blocking) ? (
                          <Chip tone="red">{t("Documentos vencidos: sin viajes", "Documents expired: no trips")}</Chip>
                        ) : issues.length > 0 ? (
                          <Chip tone="orange">
                            {lang === "en"
                              ? `${issues.length} expiry warning${issues.length === 1 ? "" : "s"}`
                              : `${issues.length} ${issues.length === 1 ? "aviso" : "avisos"} de vencimiento`}
                          </Chip>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
