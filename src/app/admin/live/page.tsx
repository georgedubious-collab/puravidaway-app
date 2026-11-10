import Link from "next/link";
import { LiveRefresh } from "@/components/LiveRefresh";
import { requireRole } from "@/lib/auth";
import { bookingStatusLabel, serviceLabel, type BookingStatus } from "@/lib/bookings";
import { formatScheduledAt, nowMs } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

interface Row {
  id: string;
  booking_ref: string;
  status: BookingStatus;
  service_type: string;
  origin: string | null;
  destination: string | null;
  scheduled_at: string | null;
  assigned_driver_id: string;
  en_route_at?: string | null;
  late_alert_at?: string | null;
}
interface Loc {
  driver_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  booking_id: string | null;
  recorded_at: string;
  eta_at?: string | null;
  late_min?: number | null;
}

const HOUR = 3600000;

function ago(iso: string, now: number, lang: TeamLang): string {
  const t = makeT(lang);
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return t("hace un momento", "just now");
  if (min < 60) return t(`hace ${min} min`, `${min} min ago`);
  return t(`hace ${Math.floor(min / 60)} h ${min % 60} min`, `${Math.floor(min / 60)} h ${min % 60} min ago`);
}

/**
 * Live trips: rides on the road or with a pickup in the next 3 hours, with the
 * driver's latest position from the driver app (shared with their consent, only
 * inside this window). Refreshes every 20 seconds.
 */
export default async function LivePage() {
  await requireRole("admin", "/admin/live");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const supabase = (await createSupabaseServerClient())!;
  const now = nowMs();
  const { data: rows } = await supabase
    .from("bookings")
    .select("*")
    .in("status", ["confirmed", "in_progress"])
    .not("assigned_driver_id", "is", null)
    .order("scheduled_at")
    .returns<Row[]>();
  const active = (rows ?? []).filter((b) => {
    if (b.status === "in_progress") return true;
    const at = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
    return (at <= now + 3 * HOUR || Boolean(b.en_route_at)) && at >= now - 12 * HOUR;
  });
  const driverIds = [...new Set(active.map((b) => b.assigned_driver_id))];
  const [locs, names] = driverIds.length
    ? await Promise.all([
        supabase.from("driver_locations").select("*").in("driver_id", driverIds),
        supabase.from("profiles").select("id, full_name, phone").in("id", driverIds),
      ])
    : [{ data: [] as Loc[], error: null }, { data: [] as { id: string; full_name: string | null; phone: string | null }[] }];

  return (
    <div className="space-y-6">
      <LiveRefresh seconds={20} />
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{t("Viajes en vivo", "Live trips")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t(
            "Viajes en ruta, y viajes confirmados con recogida en las próximas 3 horas o con el conductor ya en camino. Los conductores comparten su ubicación desde la app de conductores hasta que terminan el viaje. Antes de la recogida, la hora de llegada se estima con el tráfico en vivo, y usted recibe un correo si un conductor llegaría más de 20 minutos tarde. Esta página se actualiza sola.",
            "Trips on the road, and confirmed trips with a pickup in the next 3 hours or a driver already on the way. Drivers share their location through the driver app until they end the trip. Before the pickup, the arrival time is estimated with live traffic, and you get an email if a driver would be more than 20 minutes late. This page updates by itself.",
          )}
        </p>
      </div>
      {locs.error && (
        <p className="text-sm text-amber-800">
          {t("Las ubicaciones de los conductores necesitan la migración", "Driver locations need migration")}{" "}
          <code>20261109000028_driver_location.sql</code>. {t("Se aplica sola después de la fusión.", "It runs by itself after the merge.")}
        </p>
      )}
      {active.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          {t("No hay viajes en este momento.", "No trips in the window right now.")}
        </p>
      )}
      <ul className="grid gap-4 lg:grid-cols-2">
        {active.map((b) => {
          const who = names.data?.find((p) => p.id === b.assigned_driver_id);
          const loc = (locs.data as Loc[] | null)?.find((l) => l.driver_id === b.assigned_driver_id);
          const stale = loc ? now - new Date(loc.recorded_at).getTime() > 10 * 60000 : false;
          const d = 0.02;
          return (
            <li key={b.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold text-slate-500">
                {formatScheduledAt(b.scheduled_at, lang)} · {serviceLabel(b.service_type, lang)} ·{" "}
                <Link href={`/admin/bookings/${b.id}`} className="font-mono underline">{b.booking_ref}</Link> · {bookingStatusLabel(b.status, lang)}
              </p>
              <h2 className="font-extrabold text-slate-900">
                {b.service_type === "transfer" ? `${b.origin} → ${b.destination}` : "Tour"}
              </h2>
              <p className="text-sm text-slate-700">
                <Link href={`/admin/drivers/${b.assigned_driver_id}`} className="font-bold underline">
                  {who?.full_name ?? t("Conductor", "Driver")}
                </Link>
                {who?.phone ? ` · ${who.phone}` : ""}
              </p>
              {b.status === "confirmed" && (
                <p className={`mt-1 inline-block rounded px-1.5 text-xs font-bold ${b.en_route_at ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-600"}`}>
                  {b.en_route_at ? t("En camino a la recogida", "On the way to the pickup") : t("Todavía no ha salido", "Has not set off yet")}
                </p>
              )}
              {loc && b.status === "confirmed" && loc.eta_at && loc.late_min != null && (
                <p className={`mt-2 text-sm font-extrabold ${loc.late_min > 20 ? "text-red-700" : loc.late_min > 5 ? "text-amber-700" : "text-emerald-700"}`}>
                  {t("Llega cerca de las", "Arrives about")} {formatScheduledAt(loc.eta_at, lang).split(" · ").pop()}{" "}
                  {t("con el tráfico actual:", "with current traffic:")}{" "}
                  {loc.late_min > 0
                    ? t(`${loc.late_min} min tarde`, `${loc.late_min} min late`)
                    : loc.late_min < 0
                      ? t(`${-loc.late_min} min antes`, `${-loc.late_min} min early`)
                      : t("a tiempo", "on time")}
                  {b.late_alert_at ? t(" · alerta enviada", " · alert sent") : ""}
                </p>
              )}
              {loc ? (
                <>
                  <p className={`mt-2 text-sm font-bold ${stale ? "text-amber-700" : "text-emerald-700"}`}>
                    {t("Última ubicación", "Last seen")} {ago(loc.recorded_at, now, lang)}
                    {loc.speed_mps != null && loc.speed_mps > 1 ? ` · ${Math.round(loc.speed_mps * 3.6)} km/h` : ""}
                    {stale
                      ? t(
                          " · sin señal reciente (sin cobertura, o el teléfono dejó de compartir)",
                          " · no recent signal (no coverage, or the phone stopped sharing)",
                        )
                      : ""}
                  </p>
                  <iframe
                    title={`${t("Mapa", "Map")}: ${who?.full_name ?? t("conductor", "driver")}`}
                    className="mt-2 h-56 w-full rounded-lg border border-slate-200"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng - d},${loc.lat - d},${loc.lng + d},${loc.lat + d}&layer=mapnik&marker=${loc.lat},${loc.lng}`}
                  />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-bold text-emerald-700 underline"
                  >
                    {t("Abrir en Google Maps", "Open in Google Maps")}
                  </a>
                </>
              ) : (
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  {t(
                    "Todavía no hay ubicación. El conductor necesita la app, con la ubicación compartida aceptada y permitida en el teléfono.",
                    "No location yet. The driver needs the app, with location sharing agreed and allowed on the phone.",
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
