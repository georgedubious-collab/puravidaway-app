import Link from "next/link";
import { LiveRefresh } from "@/components/LiveRefresh";
import { StatusChip } from "@/components/admin/chips";
import { Card, EmptyState, Icon, Notice, PageHeader, link } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { serviceLabel, type BookingStatus } from "@/lib/bookings";
import { formatScheduledAt, nowMs } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { getCatalog } from "@/lib/catalogSource";
import { bookedItemName } from "@/lib/catalog";
import { formatTime12h, scheduledParts } from "@/lib/dates";
import { agoText, driverWhatsAppHref, isLiveTrip, isStaleLocation, liveFocusId, osmEmbedSrc } from "@/lib/liveTrips";

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
  pickup_place?: string | null;
  catalog_item_id?: string | null;
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

const ago = (iso: string, now: number, lang: TeamLang) => agoText(iso, now, lang);

/**
 * Live trips: rides on the road or with a pickup in the next 3 hours, with the
 * driver's latest position from the driver app (shared with their consent, only
 * inside this window). Refreshes every 20 seconds. Which trips: isLiveTrip (src/lib/liveTrips.ts).
 *
 * Phones (below lg, 2026-11-13): the map of one trip fills the top, the live trips are listed under
 * it; ?booking=<id> picks the trip ("Ver en el mapa" on Inicio and the booking page). The team gets
 * a WhatsApp button to the DRIVER; travellers' contact details are never shown here.
 */
export default async function LivePage({ searchParams }: { searchParams: Promise<{ booking?: string | string[] }> }) {
  await requireRole("admin", "/admin/live");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const supabase = (await createSupabaseServerClient())!;
  const now = nowMs();
  const sp = await searchParams;
  const { data: rows } = await supabase
    .from("bookings")
    .select("*")
    .in("status", ["confirmed", "in_progress"])
    .not("assigned_driver_id", "is", null)
    .order("scheduled_at")
    .returns<Row[]>();
  const active = (rows ?? []).filter((b) => isLiveTrip(b, now));
  const focusId = liveFocusId(sp.booking, active.map((b) => b.id));
  const focused = active.find((b) => b.id === focusId);
  const driverIds = [...new Set(active.map((b) => b.assigned_driver_id))];
  const [locs, names] = driverIds.length
    ? await Promise.all([
        supabase.from("driver_locations").select("*").in("driver_id", driverIds),
        supabase.from("profiles").select("id, full_name, phone").in("id", driverIds),
      ])
    : [{ data: [] as Loc[], error: null }, { data: [] as { id: string; full_name: string | null; phone: string | null }[] }];
  const catalog = active.some((b) => b.service_type !== "transfer") ? await getCatalog() : null;
  const whoOf = (b: Row) => names.data?.find((p) => p.id === b.assigned_driver_id);
  const locOf = (b: Row) => (locs.data as Loc[] | null)?.find((l) => l.driver_id === b.assigned_driver_id);
  const what = (b: Row) =>
    b.service_type === "transfer"
      ? `${(b.origin ?? "—").split(",")[0]} → ${(b.destination ?? "—").split(",")[0]}`
      : ((catalog && bookedItemName(catalog.dayTours, b.catalog_item_id, lang)) ?? t("Tour", "Tour"));
  const timeOf = (iso: string | null | undefined) => formatTime12h(scheduledParts(iso)?.time ?? "", lang);
  const fLoc = focused ? locOf(focused) : undefined;
  const fWho = focused ? whoOf(focused) : undefined;
  const fWa = driverWhatsAppHref(fWho?.phone);

  return (
    <div className="space-y-6">
      <LiveRefresh seconds={20} />

      {/* ================= Phone (below lg): map on top, trips under it ================= */}
      <div className="-mx-4 -mt-5 sm:-mx-6 lg:hidden">
        <h1 className="sr-only">{t("Viajes en vivo", "Live trips")}</h1>
        <div className="relative h-[48dvh] min-h-[240px] bg-[#E3E8E5]">
          {fLoc ? (
            <iframe
              key={`${fLoc.lat},${fLoc.lng}`}
              title={`${t("Mapa", "Map")}: ${fWho?.full_name ?? t("conductor", "driver")}`}
              className="absolute inset-0 h-full w-full border-0"
              src={osmEmbedSrc(fLoc.lat, fLoc.lng, 0.03)}
            />
          ) : (
            <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm font-semibold text-[#5F6F67]">
              {active.length === 0
                ? t("No hay viajes en este momento.", "No trips in the window right now.")
                : t("Todavía no hay ubicación para este viaje.", "No location for this trip yet.")}
            </p>
          )}
        </div>
        <div className="relative -mt-4 space-y-3 rounded-t-3xl bg-[#F4F6F4] px-4 pt-4 sm:px-6">
          {locs.error && <Notice>{t("Las ubicaciones de los conductores todavía no están disponibles.", "Driver locations aren't available yet.")}</Notice>}
          {focused && (
            <section aria-labelledby="live-focus" className="space-y-2 rounded-2xl border border-[#E3E8E5] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#5F6F67]">
                    <span className="font-mono">{focused.booking_ref}</span> · {timeOf(focused.scheduled_at)}
                  </p>
                  <h2 id="live-focus" className="font-extrabold text-[#14231C]">
                    {fWho?.full_name ?? t("Conductor", "Driver")}
                  </h2>
                  <p className="text-sm text-[#33443C]">{what(focused)}</p>
                </div>
                <StatusChip status={focused.status} lang={lang} />
              </div>
              <ul className="space-y-1 text-sm">
                {focused.status === "confirmed" && (
                  <li className="font-bold">
                    {focused.en_route_at ? t("En camino a la recogida", "On the way to the pickup") : t("Todavía no ha salido", "Has not set off yet")}
                    {fLoc?.eta_at && fLoc.late_min != null && (
                      <span className={fLoc.late_min > 20 ? "text-red-700" : fLoc.late_min > 5 ? "text-amber-700" : "text-[#047857]"}>
                        {" · "}
                        {t("llega", "arrives")} {timeOf(fLoc.eta_at)}
                        {fLoc.late_min > 0
                          ? ` · ${t(`${fLoc.late_min} min tarde`, `${fLoc.late_min} min late`)}`
                          : fLoc.late_min < 0
                            ? ` · ${t(`${-fLoc.late_min} min antes`, `${-fLoc.late_min} min early`)}`
                            : ` · ${t("a tiempo", "on time")}`}
                      </span>
                    )}
                  </li>
                )}
                <li className="text-[#33443C]">
                  {focused.status === "in_progress"
                    ? `${t("Destino", "Drop-off")}: ${focused.service_type === "transfer" ? (focused.destination ?? "—") : what(focused)}`
                    : `${t("Recogida", "Pickup")}: ${focused.service_type === "transfer" ? (focused.origin ?? "—") : (focused.pickup_place || t("(no indicada)", "(not given)"))}`}
                </li>
                <li className={fLoc && !isStaleLocation(fLoc.recorded_at, now) ? "text-[#047857]" : "font-semibold text-amber-700"}>
                  {fLoc
                    ? `${t("Última ubicación", "Last seen")} ${ago(fLoc.recorded_at, now, lang)}${isStaleLocation(fLoc.recorded_at, now) ? t(" · sin señal reciente", " · no recent signal") : ""}`
                    : t("Sin ubicación todavía", "No location yet")}
                </li>
              </ul>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {fWa ? (
                  <a
                    href={fWa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#DCFCE7] px-3 text-sm font-extrabold text-[#14532D]"
                  >
                    <Icon name="message" className="h-4 w-4" />
                    {t("WhatsApp al conductor", "WhatsApp the driver")}
                  </a>
                ) : (
                  <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F1F4F2] px-3 text-center text-xs font-semibold text-[#5F6F67]">
                    {t("Conductor sin teléfono", "Driver has no phone")}
                  </span>
                )}
                <Link
                  href={`/admin/bookings/${focused.id}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#CBD5CF] bg-white px-3 text-sm font-bold text-[#14231C]"
                >
                  {t("Abrir la reserva", "Open the booking")}
                </Link>
                {fLoc && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${fLoc.lat},${fLoc.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`col-span-2 inline-flex min-h-11 items-center justify-center text-sm ${link}`}
                  >
                    {t("Abrir en Google Maps", "Open in Google Maps")}
                  </a>
                )}
              </div>
            </section>
          )}
          {active.length > 0 && (
            <nav aria-label={t("Viajes en vivo", "Live trips")}>
              <ul className="overflow-hidden rounded-2xl border border-[#E3E8E5] bg-white">
                {active.map((b) => {
                  const l = locOf(b);
                  const ok = Boolean(l && !isStaleLocation(l.recorded_at, now)) && !(l?.late_min != null && l.late_min > 5 && b.status === "confirmed");
                  const on = b.id === focusId;
                  return (
                    <li key={b.id} className="border-t border-[#EEF2EF] first:border-t-0">
                      <Link
                        href={`/admin/live?booking=${b.id}`}
                        scroll={false}
                        aria-current={on ? "true" : undefined}
                        className={`flex min-h-14 items-center gap-3 px-3.5 py-2.5 text-[#14231C] ${on ? "bg-[#ECFDF5]" : ""}`}
                      >
                        <span className="w-14 shrink-0 text-sm font-extrabold">{timeOf(b.scheduled_at)}</span>
                        <span className="flex min-w-0 grow flex-col">
                          <span className="truncate text-sm font-bold">{what(b)}</span>
                          <span className="truncate text-xs text-[#5B6B64]">
                            {whoOf(b)?.full_name ?? t("Conductor", "Driver")} · {l ? ago(l.recorded_at, now, lang) : t("sin ubicación", "no location")}
                          </span>
                        </span>
                        <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </div>
      </div>

      {/* ================= Large screens (unchanged) ================= */}
      <div className="hidden space-y-6 lg:block">
      <PageHeader
        title={t("Viajes en vivo", "Live trips")}
        subtitle={t(
            "Viajes en ruta, y viajes confirmados con recogida en las próximas 3 horas o con el conductor ya en camino. Los conductores comparten su ubicación desde la app de conductores hasta que terminan el viaje. Antes de la recogida, la hora de llegada se estima con el tráfico en vivo, y usted recibe un correo si un conductor llegaría más de 20 minutos tarde. Esta página se actualiza sola.",
            "Trips on the road, and confirmed trips with a pickup in the next 3 hours or a driver already on the way. Drivers share their location through the driver app until they end the trip. Before the pickup, the arrival time is estimated with live traffic, and you get an email if a driver would be more than 20 minutes late. This page updates by itself.",
        )}
      />
      {locs.error && (
        <Notice>
          {t("Las ubicaciones de los conductores necesitan la migración", "Driver locations need migration")}{" "}
          <code>20261109000028_driver_location.sql</code>. {t("Se aplica sola después de la fusión.", "It runs by itself after the merge.")}
        </Notice>
      )}
      {active.length === 0 && (
        <Card>
          <EmptyState title={t("No hay viajes en este momento.", "No trips in the window right now.")} />
        </Card>
      )}
      <ul className="grid gap-4 lg:grid-cols-2">
        {active.map((b) => {
          const who = names.data?.find((p) => p.id === b.assigned_driver_id);
          const loc = (locs.data as Loc[] | null)?.find((l) => l.driver_id === b.assigned_driver_id);
          const stale = loc ? now - new Date(loc.recorded_at).getTime() > 10 * 60000 : false;
          const d = 0.02;
          return (
            <li key={b.id} id={`trip-${b.id}`} className={`rounded-2xl border bg-white p-4 sm:p-5 ${sp.booking && b.id === focusId ? "border-[#047857] ring-2 ring-[#047857]" : "border-[#E3E8E5]"}`}>
              <p className="text-xs font-bold text-[#5F6F67]">
                {formatScheduledAt(b.scheduled_at, lang)} · {serviceLabel(b.service_type, lang)} ·{" "}
                <Link href={`/admin/bookings/${b.id}`} className={`font-mono ${link}`}>{b.booking_ref}</Link> <StatusChip status={b.status} lang={lang} />
              </p>
              <h2 className="font-extrabold text-[#14231C]">
                {b.service_type === "transfer" ? `${b.origin} → ${b.destination}` : "Tour"}
              </h2>
              <p className="text-sm text-[#33443C]">
                <Link href={`/admin/drivers/${b.assigned_driver_id}`} className={link}>
                  {who?.full_name ?? t("Conductor", "Driver")}
                </Link>
                {who?.phone ? ` · ${who.phone}` : ""}
              </p>
              {b.status === "confirmed" && (
                <p className={`mt-1 inline-block rounded px-1.5 text-xs font-bold ${b.en_route_at ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-[#5F6F67]"}`}>
                  {b.en_route_at ? t("En camino a la recogida", "On the way to the pickup") : t("Todavía no ha salido", "Has not set off yet")}
                </p>
              )}
              {loc && b.status === "confirmed" && loc.eta_at && loc.late_min != null && (
                <p className={`mt-2 text-sm font-extrabold ${loc.late_min > 20 ? "text-red-700" : loc.late_min > 5 ? "text-amber-700" : "text-[#047857]"}`}>
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
                  <p className={`mt-2 text-sm font-bold ${stale ? "text-amber-700" : "text-[#047857]"}`}>
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
                    className="mt-2 h-56 w-full rounded-lg border border-[#E3E8E5]"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng - d},${loc.lat - d},${loc.lng + d},${loc.lat + d}&layer=mapnik&marker=${loc.lat},${loc.lng}`}
                  />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-2 inline-block text-sm ${link}`}
                  >
                    {t("Abrir en Google Maps", "Open in Google Maps")}
                  </a>
                </>
              ) : (
                <p className="mt-2 text-sm font-semibold text-[#5F6F67]">
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
    </div>
  );
}
