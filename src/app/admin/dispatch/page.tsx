import Link from "next/link";
import { StatusChip } from "@/components/admin/chips";
import { Card, Chip, Notice, PageHeader, btn, link } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { statusShort, weekStart } from "@/lib/adminBookings";
import type { BookingStatus } from "@/lib/bookings";
import { getCatalog } from "@/lib/catalogSource";
import { addDays, costaRicaTimestamp, isValidYmd, scheduledParts, todayInCostaRica } from "@/lib/dates";
import { vehicleRoadLegal, type DriverRecord, type VehicleRecord } from "@/lib/driverKyc";
import {
  CLASH_BUFFER_MINUTES,
  durationText,
  busySpan,
  candidateWarnings,
  findClashes,
  shortPlace,
  spanLabel,
  type BusySpan,
  type Clash,
  type DispatchWarning,
  type SpanBooking,
  type SpanCatalog,
} from "@/lib/dispatch";
import { compareRanks, nearHome, offerRank, ratingBand, returnMatch, townName, townOf, type ReturnMatch } from "@/lib/matching";
import { prefMismatches, type RidePrefs } from "@/lib/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { categoryLabel, isVehicleCategory, jobClassLabel, seatsFit, vehicleCanServe } from "@/lib/vehicleEligibility";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { acceptOffer, updateBooking } from "../bookings/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Offer = { id: string; driver_id: string; vehicle_id: string | null; bid_amount: number | string; status: string };
type Row = SpanBooking & {
  booking_ref: string;
  status: BookingStatus;
  service_type: string;
  catalog_item_id: string | null;
  vehicle_class: string | null;
  passenger_count: number | null;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  driver_payout: number | string | null;
  preferences: Partial<RidePrefs> | null;
  /** The traveller's name only: no email or phone on the calendar. */
  trips: { guest_name: string | null } | null;
  bids: Offer[] | null;
};
type DriverRow = DriverRecord & { profiles: { full_name: string | null } | null; driver_vehicles: VehicleRecord[] };

/** Bookings that still need a driver: not assigned, not finished. */
const needsDriver = (b: Row) => !b.assigned_driver_id && (b.status === "pending_payment" || b.status === "pending_bids" || b.status === "confirmed");
const dayOf = (b: { scheduled_at: string | null }) => scheduledParts(b.scheduled_at)?.ymd ?? "";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** "lun 17" / "Mon 17" for a YYYY-MM-DD day. */
function dayName(ymd: string, lang: TeamLang, style: "short" | "long" = "short"): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const s = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-CR", {
    timeZone: "UTC",
    weekday: style,
    day: "numeric",
    ...(style === "long" ? { month: "long" } : {}),
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Dispatch calendar (2026-11-12): one week (Monday–Sunday, Costa Rica time) with a row per
 * approved driver and a "Sin conductor" row for bookings that still need one. Each booking shows
 * its busy span (pickup → estimated end, src/lib/dispatch.ts). Clicking a booking without a
 * driver opens the side panel with the candidates, their clash warnings and the same assign
 * actions as the booking page. Phones see one day at a time. Read by admins only: nothing here is
 * shown to drivers, and travellers appear by name only.
 */
export default async function DispatchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("admin", "/admin/dispatch");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const sp = await searchParams;
  const today = todayInCostaRica();
  const day = isValidYmd(one(sp.d)) ? one(sp.d) : today;
  const assignId = UUID.test(one(sp.assign)) ? one(sp.assign).toLowerCase() : "";
  const monday = weekStart(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  // One day either side, so a late Sunday ride or an early Monday one still shows its clashes.
  const fromDay = addDays(monday, -1);
  const toDay = addDays(monday, 8);

  const supabase = (await createSupabaseServerClient())!;
  // One query per table for the whole week (no query per driver or per booking).
  const [{ data: rowsData, error }, { data: driversData }, { data: offDays }, catalog] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, booking_ref, status, service_type, catalog_item_id, scheduled_at, origin, destination, origin_coords, destination_coords, sightseeing_stops, drive_minutes, vehicle_class, passenger_count, assigned_driver_id, assigned_vehicle_id, driver_payout, preferences, trips(guest_name), bids(id, driver_id, vehicle_id, bid_amount, status)",
      )
      .neq("status", "cancelled")
      .gte("scheduled_at", costaRicaTimestamp(fromDay, "00:00"))
      .lt("scheduled_at", costaRicaTimestamp(toDay, "00:00"))
      .order("scheduled_at")
      .limit(2000)
      .returns<Row[]>(),
    supabase.from("drivers").select("*, profiles!drivers_id_fkey(full_name), driver_vehicles(*)").eq("kyc_status", "approved").returns<DriverRow[]>(),
    supabase.from("driver_unavailable").select("driver_id, day").gte("day", fromDay).lte("day", toDay),
    getCatalog(),
  ]);
  if (error)
    return (
      <p className="font-semibold text-red-700">
        {t("No se pudo cargar el calendario:", "Couldn't load the calendar:")} {error.message}
      </p>
    );

  const rows = rowsData ?? [];
  const cat: SpanCatalog = { stops: catalog.stops, dayTours: catalog.dayTours };
  const drivers = [...(driversData ?? [])].sort((a, b) => (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? "", "es"));
  const blocked = new Map<string, Set<string>>();
  for (const u of (offDays ?? []) as { driver_id: string; day: string }[]) {
    if (!blocked.has(u.driver_id)) blocked.set(u.driver_id, new Set());
    blocked.get(u.driver_id)!.add(String(u.day).slice(0, 10));
  }
  const byDriver = new Map<string, Row[]>();
  for (const b of rows) {
    if (!b.assigned_driver_id) continue;
    if (!byDriver.has(b.assigned_driver_id)) byDriver.set(b.assigned_driver_id, []);
    byDriver.get(b.assigned_driver_id)!.push(b);
  }
  const spans = new Map<string, BusySpan | null>(rows.map((b) => [b.id, busySpan(b, cat)]));
  const clashes = new Map<string, Clash[]>();
  for (const list of byDriver.values()) for (const b of list) clashes.set(b.id, findClashes(b, list, cat));
  const unassigned = rows.filter(needsDriver);
  const approvedIds = new Set(drivers.map((d) => d.id));
  // Bookings still assigned to a driver who is no longer approved (suspended, …): kept visible.
  const otherAssigned = rows.filter((b) => b.assigned_driver_id && !approvedIds.has(b.assigned_driver_id));
  const inWeek = (b: Row) => days.includes(dayOf(b));

  const href = (d: string, extra = "") => `/admin/dispatch?d=${d}${extra}`;
  const blockFor = (b: Row) => (
    <BookingBlock
      key={b.id}
      b={b}
      span={spans.get(b.id) ?? null}
      clashes={clashes.get(b.id) ?? []}
      lang={lang}
      catalog={catalog}
      href={b.assigned_driver_id ? `/admin/bookings/${b.id}` : href(dayOf(b), `&assign=${b.id}`)}
      selected={b.id === assignId}
    />
  );

  const weekTitle = `${dayName(days[0], lang, "long")} – ${dayName(days[6], lang, "long")}`;
  const panelBooking = assignId ? rows.find((b) => b.id === assignId) : undefined;

  const driverMeta = (d: DriverRow) => {
    const cats = [...new Set(d.driver_vehicles.filter((v) => v.status === "approved").map((v) => (isVehicleCategory(v.vehicle_class) ? categoryLabel(v.vehicle_class, lang) : null)).filter(Boolean))];
    return (
      <>
        <span className="block truncate font-extrabold text-[#14231C]">{d.profiles?.full_name ?? t("Conductor", "Driver")}</span>
        <span className="block truncate text-xs text-[#5F6F67]">{d.home_hub ? townName(d.home_hub, lang) : t("Base sin indicar", "No home base")}</span>
        {cats.length > 0 && <span className="mt-0.5 block text-[11px] leading-snug text-[#33443C]">{cats.join(" · ")}</span>}
      </>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Despacho", "Dispatch")}
        subtitle={t(
          "Quién maneja qué esta semana. Cada viaje ocupa al conductor desde la recogida hasta la llegada estimada (manejo + paradas, o la duración del tour). Toque un viaje sin conductor para asignarlo.",
          "Who drives what this week. Each booking keeps the driver busy from pickup to estimated arrival (drive + stops, or the tour's length). Tap a booking without a driver to assign it.",
        )}
        actions={
          <Link href="/admin/bookings" className={btn.secondary}>
            {t("Lista de reservas", "Bookings list")}
          </Link>
        }
      />

      {/* ---------- Week view (tablets and computers) ---------- */}
      <div className="hidden md:block">
        <Card
          padded={false}
          title={weekTitle}
          actions={
            <nav aria-label={t("Semanas", "Weeks")} className="flex flex-wrap items-center gap-2">
              <Link href={href(addDays(day, -7))} className={btn.secondary}>
                ← {t("Semana anterior", "Previous week")}
              </Link>
              <Link href="/admin/dispatch" className={btn.secondary} aria-current={days.includes(today) ? "page" : undefined}>
                {t("Hoy", "Today")}
              </Link>
              <Link href={href(addDays(day, 7))} className={btn.secondary}>
                {t("Semana siguiente", "Next week")} →
              </Link>
            </nav>
          }
        >
          <div className="overflow-x-auto">
            <div role="table" aria-label={t("Calendario de despacho", "Dispatch calendar")} className="grid min-w-[1000px] grid-cols-[170px_repeat(7,minmax(0,1fr))] text-sm">
              <div role="row" className="contents">
                <div role="columnheader" className="sticky left-0 z-10 border-b border-[#E3E8E5] bg-[#FAFBFA] px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-[#5F6F67]">
                  {t("Conductor", "Driver")}
                </div>
                {days.map((d) => (
                  <div
                    key={d}
                    role="columnheader"
                    className={`border-b border-l border-[#E3E8E5] px-2 py-2.5 text-xs font-bold uppercase tracking-wide ${d === today ? "bg-[#ECFDF5] text-[#065F46]" : "bg-[#FAFBFA] text-[#5F6F67]"}`}
                  >
                    <Link href={href(d)} className="hover:underline">
                      {dayName(d, lang)}
                    </Link>
                    {d === today && <span className="ml-1 normal-case">· {t("hoy", "today")}</span>}
                  </div>
                ))}
              </div>

              <div role="row" className="contents">
                <div role="rowheader" className="sticky left-0 z-10 border-b border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5">
                  <span className="block font-extrabold text-[#78350F]">{t("Sin conductor", "No driver yet")}</span>
                  <span className="block text-xs text-[#92400E]">
                    {t(`${unassigned.filter(inWeek).length} esta semana`, `${unassigned.filter(inWeek).length} this week`)}
                  </span>
                </div>
                {days.map((d) => (
                  <div key={d} role="cell" className="min-h-16 space-y-1.5 border-b border-l border-[#FDE68A] bg-[#FFFDF5] p-1.5">
                    {unassigned.filter((b) => dayOf(b) === d).map(blockFor)}
                  </div>
                ))}
              </div>

              {drivers.map((dr) => {
                const mine = byDriver.get(dr.id) ?? [];
                const off = blocked.get(dr.id);
                return (
                  <div key={dr.id} role="row" className="contents">
                    <div role="rowheader" className="sticky left-0 z-10 border-b border-[#EDF1EE] bg-white px-3 py-2.5">
                      {driverMeta(dr)}
                    </div>
                    {days.map((d) => (
                      <div
                        key={d}
                        role="cell"
                        className={`min-h-16 space-y-1.5 border-b border-l border-[#EDF1EE] p-1.5 ${
                          off?.has(d) ? "bg-[repeating-linear-gradient(135deg,#F1F4F2_0_6px,#E6EBE8_6px_12px)]" : d === today ? "bg-[#F7FCF9]" : ""
                        }`}
                      >
                        {off?.has(d) && (
                          <span className="block rounded-md bg-white/80 px-1.5 py-0.5 text-[11px] font-bold text-[#5F6F67]">{t("No disponible", "Unavailable")}</span>
                        )}
                        {mine.filter((b) => dayOf(b) === d).map(blockFor)}
                      </div>
                    ))}
                  </div>
                );
              })}

              {otherAssigned.some(inWeek) && (
                <div role="row" className="contents">
                  <div role="rowheader" className="sticky left-0 z-10 border-b border-[#EDF1EE] bg-white px-3 py-2.5">
                    <span className="block font-extrabold text-[#14231C]">{t("Otros conductores", "Other drivers")}</span>
                    <span className="block text-xs text-[#5F6F67]">{t("Ya no aprobados: revise", "No longer approved: check")}</span>
                  </div>
                  {days.map((d) => (
                    <div key={d} role="cell" className="min-h-16 space-y-1.5 border-b border-l border-[#EDF1EE] p-1.5">
                      {otherAssigned.filter((b) => dayOf(b) === d).map(blockFor)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {drivers.length === 0 && (
            <p className="p-4 text-sm text-[#5F6F67]">
              {t("Todavía no hay conductores aprobados.", "No approved drivers yet.")}{" "}
              <Link href="/admin/drivers" className={link}>
                {t("Conductores", "Drivers")}
              </Link>
            </p>
          )}
        </Card>
      </div>

      {/* ---------- Day view (phones) ---------- */}
      <div className="space-y-3 md:hidden">
        <nav aria-label={t("Días", "Days")} className="flex items-center justify-between gap-2">
          <Link href={href(addDays(day, -1))} className={btn.secondary} aria-label={t("Día anterior", "Previous day")}>
            ←
          </Link>
          <div className="min-w-0 text-center">
            <p className="font-extrabold text-[#14231C]">{dayName(day, lang, "long")}</p>
            {day !== today && (
              <Link href="/admin/dispatch" className={`text-sm ${link}`}>
                {t("Ir a hoy", "Go to today")}
              </Link>
            )}
            {day === today && <p className="text-sm font-bold text-[#047857]">{t("Hoy", "Today")}</p>}
          </div>
          <Link href={href(addDays(day, 1))} className={btn.secondary} aria-label={t("Día siguiente", "Next day")}>
            →
          </Link>
        </nav>
        <Card title={t("Sin conductor", "No driver yet")}>
          {unassigned.filter((b) => dayOf(b) === day).length ? (
            <div className="space-y-2">{unassigned.filter((b) => dayOf(b) === day).map(blockFor)}</div>
          ) : (
            <p className="text-sm text-[#5F6F67]">{t("Nada pendiente este día.", "Nothing waiting this day.")}</p>
          )}
        </Card>
        <Card title={t("Conductores", "Drivers")} padded={false}>
          <ul className="divide-y divide-[#EDF1EE]">
            {drivers.map((dr) => {
              const mine = (byDriver.get(dr.id) ?? []).filter((b) => dayOf(b) === day);
              const off = blocked.get(dr.id)?.has(day);
              return (
                <li key={dr.id} className={`space-y-2 px-4 py-3 ${off ? "bg-[repeating-linear-gradient(135deg,#F1F4F2_0_6px,#E6EBE8_6px_12px)]" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">{driverMeta(dr)}</div>
                    {off ? <Chip tone="grey">{t("No disponible", "Unavailable")}</Chip> : !mine.length && <Chip tone="green">{t("Libre", "Free")}</Chip>}
                  </div>
                  {mine.map(blockFor)}
                </li>
              );
            })}
            {otherAssigned
              .filter((b) => dayOf(b) === day)
              .map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <p className="mb-2 text-xs font-bold text-[#5F6F67]">{t("Conductor ya no aprobado", "Driver no longer approved")}</p>
                  {blockFor(b)}
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <Legend lang={lang} />

      {assignId && (
        <AssignPanel
          booking={panelBooking}
          byDriver={byDriver}
          drivers={drivers}
          blocked={blocked}
          catalog={catalog}
          cat={cat}
          lang={lang}
          today={today}
          closeHref={href(day)}
        />
      )}
    </div>
  );
}

/** Never split "8:00 a. m." across two lines in a narrow block: line breaks only after the dash. */
const keepTogether = (label: string) => label.replace(/ (a\.|p\.) m\./g, "\u00a0$1\u00a0m.").replace(/ (AM|PM)\b/g, "\u00a0$1");

/* ---------- One booking on the calendar ---------- */

function BookingBlock({
  b,
  span,
  clashes,
  lang,
  catalog,
  href,
  selected,
}: {
  b: Row;
  span: BusySpan | null;
  clashes: Clash[];
  lang: TeamLang;
  catalog: Awaited<ReturnType<typeof getCatalog>>;
  href: string;
  selected: boolean;
}) {
  const t = makeT(lang);
  const route =
    b.service_type === "transfer"
      ? `${shortPlace(b.origin, b.origin_coords, lang)} → ${shortPlace(b.destination, b.destination_coords, lang)}`
      : `${span?.fromPlace ? `${span.fromPlace} · ` : ""}${catalog.dayTours.find((x) => x.id === b.catalog_item_id)?.name ?? t("Tour", "Tour")}`;
  const hard = clashes.some((c) => c.kind !== "check_travel");
  const soft = !hard && clashes.length > 0;
  const unassigned = !b.assigned_driver_id;
  // Where the busy time sits in the day (0–24 h), as a thin bar.
  const [hh, mm] = (span ? (scheduledParts(new Date(span.start).toISOString())?.time ?? "00:00") : "00:00").split(":").map(Number);
  const startMin = hh * 60 + mm;
  const width = span ? Math.max(2, Math.min(span.minutes, 1440 - startMin)) : 0;
  const tone = hard
    ? "border-[#FCA5A5] bg-[#FEF2F2]"
    : unassigned
      ? "border-[#FCD34D] bg-white"
      : soft
        ? "border-[#FDE68A] bg-[#FFFBEB]"
        : "border-[#D1E7DC] bg-[#F3FAF6]";
  const tip = clashes.map((c) => c.other.booking_ref).join(", ");
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={`block rounded-lg border px-2 py-1.5 text-xs leading-snug text-[#14231C] hover:border-[#047857] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#047857] ${tone} ${selected ? "ring-2 ring-[#047857]" : ""}`}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className="font-extrabold tabular-nums">
          {span ? `${span.estimated ? "≈ " : ""}${keepTogether(spanLabel(span, lang))}` : t("Sin hora", "No time")}
        </span>
      </span>
      <span className="block font-mono text-[11px] font-bold text-[#33443C]">{b.booking_ref}</span>
      <span className="block truncate font-semibold" title={route}>
        {route}
      </span>
      <span className="block truncate text-[#5F6F67]">
        {[b.passenger_count ? t(`${b.passenger_count} pers.`, `${b.passenger_count} pax`) : null, b.vehicle_class ? jobClassLabel(b.vehicle_class, lang) : null].filter(Boolean).join(" · ")}
      </span>
      {b.trips?.guest_name && <span className="block truncate text-[#5F6F67]">{b.trips.guest_name}</span>}
      {span && (
        <span aria-hidden className="mt-1 block h-1 rounded-full bg-[#E3E8E5]">
          <span
            className={`block h-1 rounded-full ${hard ? "bg-[#DC2626]" : unassigned ? "bg-[#F5B301]" : "bg-[#047857]"}`}
            style={{ marginLeft: `${(startMin / 1440) * 100}%`, width: `${(width / 1440) * 100}%` }}
          />
        </span>
      )}
      {(unassigned || clashes.length > 0) && (
        <span className="mt-1 flex flex-wrap gap-1">
          {unassigned && (
            <span className="rounded-full bg-[#FEF3C7] px-1.5 py-px text-[10px] font-extrabold text-[#92400E]">
              {b.status === "pending_payment" ? t("Esperando pago", "Awaiting payment") : t("Asignar", "Assign")}
              {(b.bids ?? []).filter((o) => o.status === "submitted").length > 0 &&
                ` · ${(b.bids ?? []).filter((o) => o.status === "submitted").length} ${t("ofertas", "offers")}`}
            </span>
          )}
          {clashes.length > 0 && (
            <span title={tip} className={`rounded-full px-1.5 py-px text-[10px] font-extrabold ${hard ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
              ⚠ {hard ? t("Choque", "Clash") : t("Revisar traslado", "Check travel")}
            </span>
          )}
        </span>
      )}
      {clashes.length > 0 && <span className="sr-only">{clashes.map((c) => c.other.booking_ref).join(", ")}</span>}
    </Link>
  );
}

function Legend({ lang }: { lang: TeamLang }) {
  const t = makeT(lang);
  return (
    <Notice tone="grey">
      <p className="font-bold text-[#14231C]">{t("Cómo leer el calendario", "How to read the calendar")}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        <li>
          {t(
            "La hora es de Costa Rica: recogida → llegada estimada. «≈» = no sabemos el tiempo de manejo exacto (lugar escrito sin ruta): se cuentan 4 h.",
            "Costa Rica time: pickup → estimated arrival. “≈” = we don't know the exact drive time (a typed place without a route): 4 h are counted.",
          )}
        </li>
        <li>
          {t(
            `Choque (rojo): dos viajes del mismo conductor se cruzan, o no queda tiempo para manejar de la llegada de uno a la recogida del siguiente más ${durationText(CLASH_BUFFER_MINUTES)} de margen (por si el viaje anterior se atrasa).`,
            `Clash (red): two of a driver's bookings overlap, or there isn't time to drive from one drop-off to the next pickup plus a ${durationText(CLASH_BUFFER_MINUTES)} margin (in case the earlier trip runs late).`,
          )}
        </li>
        <li>
          {t(
            "Revisar traslado (amarillo): un lugar está fuera de nuestras zonas y no podemos calcular el traslado. Rayado: el conductor marcó el día como no disponible.",
            "Check travel (yellow): a place is outside our towns, so we can't work out the drive. Striped: the driver blocked the day.",
          )}
        </li>
      </ul>
    </Notice>
  );
}

/* ---------- Side panel: candidates for one booking ---------- */

interface Candidate {
  d: DriverRow;
  v: VehicleRecord;
  offer: Offer | null;
  match: ReturnMatch | null;
  warnings: DispatchWarning[];
  rank: number[];
}

function AssignPanel({
  booking: b,
  byDriver,
  drivers,
  blocked,
  catalog,
  cat,
  lang,
  today,
  closeHref,
}: {
  booking: Row | undefined;
  byDriver: Map<string, Row[]>;
  drivers: DriverRow[];
  blocked: Map<string, Set<string>>;
  catalog: Awaited<ReturnType<typeof getCatalog>>;
  cat: SpanCatalog;
  lang: TeamLang;
  today: string;
  closeHref: string;
}) {
  const t = makeT(lang);
  const span = b ? busySpan(b, cat) : null;
  const tripDay = b ? dayOf(b) : "";
  // Documents must be valid on the trip day (and today, for a trip in the past).
  const docDay = tripDay > today ? tripDay : today;
  const offers = (b?.bids ?? []).filter((o) => o.status === "submitted");
  const candidates: Candidate[] = [];
  if (b) {
    const job = { origin_town: townOf(b.origin, b.origin_coords), destination_town: townOf(b.destination, b.destination_coords), scheduled_at: b.scheduled_at ?? "" };
    for (const d of drivers) {
      const mine = byDriver.get(d.id) ?? [];
      for (const v of d.driver_vehicles.filter((x) => x.status === "approved")) {
        const offer = offers.find((o) => o.driver_id === d.id && (!o.vehicle_id || o.vehicle_id === v.id)) ?? null;
        const warnings = candidateWarnings(
          {
            booking: b,
            driverBookings: mine,
            blockedDays: blocked.get(d.id) ?? new Set(),
            categoryOk: vehicleCanServe(v.vehicle_class, b.vehicle_class),
            seatsOk: seatsFit(v.passenger_capacity, b.passenger_count),
            documentsOk: Boolean(d.license_expiry && d.license_expiry >= docDay) && vehicleRoadLegal({ ...v, review_hold: false }, docDay),
            onHold: Boolean(d.review_hold || v.review_hold),
            preferences: prefMismatches(b.preferences, d, v, lang),
          },
          cat,
          lang,
        );
        const match = b.scheduled_at ? returnMatch(job, mine.filter((x) => x.id !== b.id)) : null;
        const rank = offerRank({
          match,
          home: nearHome(d.home_hub, job),
          trips: mine.length,
          amount: Number(offer?.bid_amount ?? b.driver_payout ?? 0),
          rating: ratingBand(d.rating_avg, d.rating_count),
          electricMiss: Boolean(b.preferences?.electric) && !v.is_electric,
        });
        // Clear candidates first, then drivers who offered, then the job board's own ranking.
        const serious = warnings.some((w) => w.code !== "preference");
        candidates.push({ d, v, offer, match, warnings, rank: [serious ? 1 : 0, offer ? 0 : 1, ...rank] });
      }
    }
    candidates.sort((x, y) => compareRanks(x.rank, y.rank));
  }
  const assignedTo = b?.assigned_driver_id ? drivers.find((d) => d.id === b.assigned_driver_id) : undefined;
  const nameOf = (d: DriverRow) => d.profiles?.full_name ?? t("Conductor", "Driver");
  const vehicleText = (v: VehicleRecord) =>
    `${v.make_model ?? t("Vehículo", "Vehicle")} ${v.plate ?? ""} · ${v.passenger_capacity ?? "?"} ${t("asientos", "seats")}${isVehicleCategory(v.vehicle_class) ? ` · ${categoryLabel(v.vehicle_class, lang)}` : ""}${v.is_electric ? " · ⚡" : ""}`;
  const route = b
    ? b.service_type === "transfer"
      ? `${shortPlace(b.origin, b.origin_coords, lang)} → ${shortPlace(b.destination, b.destination_coords, lang)}`
      : `${span?.fromPlace ? `${span.fromPlace} · ` : ""}${catalog.dayTours.find((x) => x.id === b.catalog_item_id)?.name ?? t("Tour", "Tour")}`
    : "";
  const nextStatusDefault = b?.status === "pending_bids" ? "confirmed" : (b?.status ?? "confirmed");

  return (
    <div className="fixed inset-0 z-40">
      <Link href={closeHref} scroll={false} aria-label={t("Cerrar el panel", "Close the panel")} className="absolute inset-0 bg-black/35" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col overflow-y-auto bg-[#F4F6F4] shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#E3E8E5] bg-white px-4 py-3.5">
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold text-[#5F6F67]">{b?.booking_ref ?? ""}</p>
            <h2 id="assign-title" className="text-lg font-extrabold text-[#14231C]">
              {t("Asignar conductor", "Assign a driver")}
            </h2>
          </div>
          <Link href={closeHref} scroll={false} className={btn.secondary}>
            {t("Cerrar", "Close")}
          </Link>
        </div>

        {!b ? (
          <div className="p-4">
            <Notice>{t("Esa reserva no está en esta semana o fue cancelada.", "That booking isn't in this week or was cancelled.")}</Notice>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <Card>
              <p className="font-extrabold text-[#14231C]">{route}</p>
              <p className="mt-1 text-sm text-[#33443C]">
                {dayName(tripDay, lang, "long")} · {span ? `${span.estimated ? "≈ " : ""}${keepTogether(spanLabel(span, lang))}` : t("sin hora", "no time")}
              </p>
              <p className="mt-1 text-sm text-[#5F6F67]">
                {[b.vehicle_class ? jobClassLabel(b.vehicle_class, lang) : null, b.passenger_count ? t(`${b.passenger_count} pasajeros`, `${b.passenger_count} passengers`) : null, b.trips?.guest_name]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusChip status={b.status} lang={lang} />
                {span?.estimated && <Chip tone="amber">{t("Duración estimada", "Estimated length")}</Chip>}
                <Link href={`/admin/bookings/${b.id}`} className={`text-sm ${link}`}>
                  {t("Abrir la reserva", "Open the booking")}
                </Link>
              </div>
            </Card>

            {b.assigned_driver_id ? (
              <Notice tone="green" role="status">
                {t(
                  `Asignada a ${assignedTo ? nameOf(assignedTo) : "un conductor"}. Para cambiarla, use la página de la reserva.`,
                  `Assigned to ${assignedTo ? nameOf(assignedTo) : "a driver"}. To change it, use the booking page.`,
                )}
              </Notice>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-[#5F6F67]">
                  {t(
                    "Primero los conductores sin avisos, luego los que ofertaron, y después el mismo orden de las ofertas: viaje de regreso, calificación, vive cerca, monto y menos viajes esta semana. Los avisos no impiden asignar: usted decide.",
                    "Drivers with no warnings first, then those who offered, then the same order as the offers: return trip, rating, based nearby, amount and fewer trips this week. Warnings never stop you assigning: you decide.",
                  )}
                </p>
                {candidates.length === 0 && (
                  <Notice>{t("No hay conductores aprobados con un vehículo aprobado.", "No approved drivers with an approved vehicle.")}</Notice>
                )}
                <ul className="space-y-3">
                  {candidates.map(({ d, v, offer, match, warnings }) => {
                    const warnText = warnings.map((w) => w.text);
                    const useOffer = Boolean(offer && b.status === "pending_bids");
                    return (
                      <li key={`${d.id}:${v.id}`} className="rounded-2xl border border-[#E3E8E5] bg-white p-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-extrabold text-[#14231C]">{nameOf(d)}</p>
                            <p className="text-xs text-[#5F6F67]">
                              {d.rating_count ? `★ ${Number(d.rating_avg).toFixed(1)} (${d.rating_count})` : t("★ conductor nuevo", "★ new driver")}
                              {d.home_hub ? ` · ${t("vive en", "based in")} ${townName(d.home_hub, lang)}` : ""}
                            </p>
                            <p className="mt-0.5 text-xs text-[#33443C]">{vehicleText(v)}</p>
                          </div>
                          {offer && <Chip tone="blue">{t(`Ofertó $${Number(offer.bid_amount).toFixed(2)}`, `Offered $${Number(offer.bid_amount).toFixed(2)}`)}</Chip>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {match && (
                            <Chip tone="green">
                              {match.kind === "after"
                                ? t(`Viaje de regreso tras ${match.trip.booking_ref ?? ""}`, `Return trip after ${match.trip.booking_ref ?? ""}`)
                                : t(`Enlaza con ${match.trip.booking_ref ?? ""}`, `Leads into ${match.trip.booking_ref ?? ""}`)}
                            </Chip>
                          )}
                          {warnings.length === 0 && <Chip tone="green">✓ {t("Sin choques ni avisos", "No clashes or warnings")}</Chip>}
                        </div>
                        {warnings.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs font-semibold">
                            {warnings.map((w) => (
                              <li
                                key={w.code + w.text}
                                className={`rounded-lg px-2 py-1 ${w.code === "overlap" || w.code === "too_tight" || w.code === "blocked_day" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#FEF3C7] text-[#92400E]"}`}
                              >
                                ⚠ {w.text}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-3">
                          {useOffer && offer ? (
                            <AdminActionForm
                              action={acceptOffer}
                              lang={lang}
                              submitLabel={t("Aceptar oferta", "Accept offer")}
                              savedLabel={t("Asignada", "Assigned")}
                              confirmLabel={t("Sí, aceptar y asignar", "Yes, accept and assign")}
                              confirm={[
                                {
                                  kind: "always",
                                  message: t(
                                    `Se asigna a ${nameOf(d)}, la reserva queda confirmada con un pago al conductor de $${Number(offer.bid_amount).toFixed(2)}, y las demás ofertas se rechazan. El conductor y el viajero reciben un aviso.${warnText.length ? ` Avisos: ${warnText.join("; ")}.` : ""}`,
                                    `${nameOf(d)} gets the job, the booking is confirmed with a driver payout of $${Number(offer.bid_amount).toFixed(2)}, and the other offers are declined. The driver and the traveller are notified.${warnText.length ? ` Warnings: ${warnText.join("; ")}.` : ""}`,
                                  ),
                                },
                              ]}
                            >
                              <input type="hidden" name="bid_id" value={offer.id} />
                              <input type="hidden" name="booking_id" value={b.id} />
                            </AdminActionForm>
                          ) : (
                            <AdminActionForm
                              action={updateBooking}
                              lang={lang}
                              className="flex flex-wrap items-end gap-2"
                              submitLabel={t("Asignar", "Assign")}
                              savedLabel={t("Asignada", "Assigned")}
                              confirmLabel={t("Sí, asignar", "Yes, assign")}
                              confirm={[
                                {
                                  kind: "always",
                                  message: t(
                                    `Se asigna ${b.booking_ref} a ${nameOf(d)} (${v.make_model ?? "vehículo"} ${v.plate ?? ""}). El conductor y el viajero reciben un aviso (el mismo que al aceptar una oferta).${warnText.length ? ` Avisos: ${warnText.join("; ")}.` : ""}`,
                                    `${b.booking_ref} goes to ${nameOf(d)} (${v.make_model ?? "vehicle"} ${v.plate ?? ""}). The driver and the traveller are notified (the same messages as accepting an offer).${warnText.length ? ` Warnings: ${warnText.join("; ")}.` : ""}`,
                                  ),
                                },
                              ]}
                            >
                              <input type="hidden" name="id" value={b.id} />
                              <input type="hidden" name="assignment" value={`${d.id}:${v.id}`} />
                              <label className="text-xs font-bold text-[#33443C]">
                                {t("Estado al asignar", "Status after assigning")}
                                <select
                                  name="status"
                                  defaultValue={nextStatusDefault}
                                  className="mt-1 block min-h-11 rounded-xl border border-[#DCE3DF] bg-white px-2 text-sm font-normal text-[#14231C]"
                                >
                                  {b.status !== "confirmed" && (
                                    <option value={b.status}>{t(`Sin cambio (${statusShort(b.status, lang)})`, `No change (${statusShort(b.status, lang)})`)}</option>
                                  )}
                                  <option value="confirmed">{t("Confirmada", "Confirmed")}</option>
                                </select>
                              </label>
                            </AdminActionForm>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
