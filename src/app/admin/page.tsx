import Link from "next/link";
import { StatusChip } from "@/components/admin/chips";
import { Card, CountBadge, DataTable, EmptyState, Icon, Td, Th, btn, link } from "@/components/admin/ui";
import { greeting, monthBounds, pctChange, weeklyCounts, weekStart } from "@/lib/adminBookings";
import { bookingTitle, pickupDay, vehicleClassName } from "@/lib/adminDisplay";
import { requireRole } from "@/lib/auth";
import { usd, type BookingRow } from "@/lib/bookings";
import { localizeCatalog } from "@/lib/catalogEs";
import { getCatalog } from "@/lib/catalogSource";
import { COSTA_RICA_TZ, addDays, nowMs, scheduledParts, todayInCostaRica } from "@/lib/dates";
import { driverIssues, vehicleIssues, type DriverRecord, type VehicleRecord } from "@/lib/driverKyc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT, teamLocale } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { isVehicleCategory } from "@/lib/vehicleEligibility";

type DriverRow = DriverRecord & {
  profiles: { full_name: string | null; email: string | null } | null;
  driver_vehicles: VehicleRecord[];
};
type Pickup = Pick<
  BookingRow,
  | "id" | "booking_ref" | "scheduled_at" | "service_type" | "origin" | "destination" | "catalog_item_id" | "vehicle_class"
  | "passenger_count" | "luggage_count" | "carry_on_count" | "assigned_driver_id" | "status" | "flight_or_hotel_notes"
  | "night_premium" | "payment_mode"
> & { trips: { guest_name: string | null } | null };

const PICKS = ["today", "tomorrow", "7d"] as const;
type Pick7 = (typeof PICKS)[number];
const HOUR = 3600_000;

interface Alert {
  key: string;
  level: "red" | "amber" | "grey";
  title: string;
  detail: string;
  href: string;
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ pick?: string }> }) {
  await requireRole("admin");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const sp = await searchParams;
  const pick: Pick7 = (PICKS as readonly string[]).includes(sp.pick ?? "") ? (sp.pick as Pick7) : "today";
  const supabase = (await createSupabaseServerClient())!;
  const now = nowMs();
  const today = todayInCostaRica(new Date(now));
  const soon = addDays(today, 30);
  const crDay = (ymd: string) => `${ymd}T00:00:00-06:00`;
  const month = monthBounds(today);
  const weeksFrom = addDays(weekStart(today), -49);

  const [upcoming, waitingPay, monthRows, testPays, ratings, drivers, flags, noDriver, oldRequests, created, rawCatalog] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, booking_ref, scheduled_at, service_type, origin, destination, catalog_item_id, vehicle_class, passenger_count, luggage_count, carry_on_count, assigned_driver_id, status, flight_or_hotel_notes, night_premium, payment_mode, trips(guest_name)",
      )
      .gte("scheduled_at", crDay(today))
      .lt("scheduled_at", crDay(addDays(today, 7)))
      .neq("status", "cancelled")
      .order("scheduled_at")
      .limit(500)
      .returns<Pickup[]>(),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending_payment"),
    supabase
      .from("bookings")
      .select("id, amount_paid, scheduled_at")
      .gte("scheduled_at", crDay(month.prevStart))
      .lt("scheduled_at", crDay(month.next))
      .neq("status", "cancelled")
      .gt("amount_paid", 0)
      .limit(5000)
      .returns<{ id: string; amount_paid: number | string; scheduled_at: string }[]>(),
    supabase.from("payments").select("booking_id").eq("provider", "test").limit(5000),
    supabase.from("driver_reviews").select("stars").limit(20000).returns<{ stars: number }[]>(),
    supabase
      .from("drivers")
      .select("*, profiles!drivers_id_fkey(full_name, email), driver_vehicles(*)")
      .in("kyc_status", ["pending", "approved"])
      .returns<DriverRow[]>(),
    supabase
      .from("contact_flags")
      .select("booking_id, bookings(booking_ref)")
      .is("reviewed_at", null)
      .limit(200)
      .returns<{ booking_id: string; bookings: { booking_ref: string } | null }[]>(),
    supabase
      .from("bookings")
      .select("id, booking_ref, scheduled_at, status")
      .in("status", ["pending_payment", "pending_bids", "confirmed"])
      .is("assigned_driver_id", null)
      .gte("scheduled_at", new Date(now).toISOString())
      .lte("scheduled_at", new Date(now + 48 * HOUR).toISOString())
      .order("scheduled_at")
      .returns<{ id: string; booking_ref: string; scheduled_at: string; status: string }[]>(),
    supabase
      .from("bookings")
      .select("id, booking_ref, created_at, total_price, cash_fee")
      .eq("status", "pending_payment")
      .lt("created_at", new Date(now - 24 * HOUR).toISOString())
      .order("created_at")
      .limit(20)
      .returns<{ id: string; booking_ref: string; created_at: string; total_price: number | string; cash_fee: number | string | null }[]>(),
    supabase.from("bookings").select("created_at").gte("created_at", crDay(weeksFrom)).limit(20000).returns<{ created_at: string }[]>(),
    getCatalog(),
  ]);
  const catalog = localizeCatalog(rawCatalog, lang);

  /* ---- Upcoming pickups ---- */
  const pickups = upcoming.data ?? [];
  const dayOf = (b: Pickup) => scheduledParts(b.scheduled_at)?.ymd ?? "";
  const inPick = (b: Pickup, p: Pick7) => (p === "today" ? dayOf(b) === today : p === "tomorrow" ? dayOf(b) === addDays(today, 1) : true);
  const shown = pickups.filter((b) => inPick(b, pick));
  const todays = pickups.filter((b) => inPick(b, "today"));
  const driverIds = [...new Set(pickups.map((b) => b.assigned_driver_id).filter((x): x is string => Boolean(x)))];
  const { data: names } = driverIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", driverIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const driverName = (id: string | null) => (id ? (names?.find((p) => p.id === id)?.full_name ?? t("Conductor", "Driver")) : null);

  /* ---- KPIs ---- */
  const tests = new Set((testPays.data ?? []).map((p) => p.booking_id as string));
  let thisMonth = 0;
  let lastMonth = 0;
  for (const r of monthRows.data ?? []) {
    if (tests.has(r.id)) continue;
    const d = scheduledParts(r.scheduled_at)?.ymd ?? "";
    if (d >= month.start) thisMonth += Number(r.amount_paid);
    else lastMonth += Number(r.amount_paid);
  }
  const change = pctChange(thisMonth, lastMonth);
  const lastMonthName = new Intl.DateTimeFormat(teamLocale(lang), { month: "long", timeZone: "UTC" }).format(new Date(`${month.prevStart}T12:00:00Z`));
  const stars = (ratings.data ?? []).map((r) => r.stars);
  const avg = stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : null;

  /* ---- Needs attention ---- */
  const alerts: Alert[] = [];
  const noDriverIds = (noDriver.data ?? []).map((b) => b.id);
  const { data: offers } = noDriverIds.length
    ? await supabase.from("bids").select("booking_id").in("booking_id", noDriverIds).eq("status", "submitted")
    : { data: [] as { booking_id: string }[] };
  for (const b of noDriver.data ?? []) {
    const w = pickupDay(b.scheduled_at, today, lang);
    const n = (offers ?? []).filter((o) => o.booking_id === b.id).length;
    alerts.push({
      key: `nd-${b.id}`,
      level: "red",
      title: t(`${b.booking_ref} sin conductor`, `${b.booking_ref} has no driver`),
      detail: `${t("Recogida", "Pickup")} ${w.day.toLowerCase()} ${w.time} · ${
        n ? t(`${n} ${n === 1 ? "oferta recibida" : "ofertas recibidas"}`, `${n} offer${n === 1 ? "" : "s"} in`) : t("sin ofertas todavía", "no offers yet")
      }`,
      href: `/admin/bookings/${b.id}`,
    });
  }
  const allDrivers = drivers.data ?? [];
  const nameOf = (d: DriverRow) => d.profiles?.full_name || d.profiles?.email || t("Conductor", "Driver");
  for (const d of allDrivers) {
    if (d.kyc_status === "pending") {
      alerts.push({ key: `kyc-${d.id}`, level: "amber", title: t("Solicitud de conductor nueva", "New driver application"), detail: nameOf(d), href: `/admin/drivers/${d.id}` });
    } else if (d.needs_review || d.driver_vehicles.some((v) => v.status === "pending" || v.needs_review)) {
      alerts.push({ key: `chg-${d.id}`, level: "amber", title: t("Cambios o vehículos por revisar", "Changes or vehicles to check"), detail: nameOf(d), href: `/admin/drivers/${d.id}` });
    }
    if (d.kyc_status !== "approved") continue;
    for (const i of driverIssues(d, today, soon, lang)) {
      alerts.push({ key: `di-${d.id}-${i.text}`, level: i.blocking ? "red" : "amber", title: i.text, detail: nameOf(d), href: `/admin/drivers/${d.id}` });
    }
    for (const v of d.driver_vehicles) {
      for (const i of vehicleIssues(v, today, soon, lang)) {
        alerts.push({
          key: `vi-${v.id}-${i.text}`,
          level: i.blocking ? "red" : "amber",
          title: i.text,
          detail: `${nameOf(d)} · ${v.make_model ?? t("vehículo", "vehicle")}`,
          href: `/admin/drivers/${d.id}`,
        });
      }
      if (v.status === "approved" && (!isVehicleCategory(v.vehicle_class) || !v.passenger_capacity)) {
        alerts.push({
          key: `vc-${v.id}`,
          level: "grey",
          title: !isVehicleCategory(v.vehicle_class) ? t("Vehículo sin categoría", "Vehicle without a category") : t("Vehículo sin número de asientos", "Vehicle without a seat number"),
          detail: `${v.make_model ?? t("Vehículo", "Vehicle")} · ${nameOf(d)} · ${t("no recibe trabajos hasta corregirlo", "gets no jobs until fixed")}`,
          href: `/admin/drivers/${d.id}`,
        });
      }
    }
  }
  const flagsByBooking = new Map<string, { ref: string; n: number }>();
  for (const f of flags.data ?? []) {
    const cur = flagsByBooking.get(f.booking_id) ?? { ref: f.bookings?.booking_ref ?? "", n: 0 };
    flagsByBooking.set(f.booking_id, { ...cur, n: cur.n + 1 });
  }
  for (const [id, f] of flagsByBooking) {
    alerts.push({
      key: `fl-${id}`,
      level: "amber",
      title: t(`Mensaje marcado en ${f.ref}`, `Flagged message on ${f.ref}`),
      detail: t(`${f.n} ${f.n === 1 ? "vez se ocultaron" : "veces se ocultaron"} datos de contacto`, `Contact details hidden ${f.n} time${f.n === 1 ? "" : "s"}`),
      href: "/admin/flagged",
    });
  }
  for (const b of oldRequests.data ?? []) {
    const days = Math.floor((now - new Date(b.created_at).getTime()) / (24 * HOUR));
    alerts.push({
      key: `pp-${b.id}`,
      level: "amber",
      title:
        days >= 1
          ? t(`Pago pendiente hace ${days} ${days === 1 ? "día" : "días"}`, `Payment pending for ${days} day${days === 1 ? "" : "s"}`)
          : t("Pago pendiente hace más de 24 h", "Payment pending over 24 h"),
      detail: `${b.booking_ref} · ${usd(Number(b.total_price) + Number(b.cash_fee ?? 0))}`,
      href: `/admin/bookings/${b.id}`,
    });
  }
  const order = { red: 0, amber: 1, grey: 2 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);
  const MAX_ALERTS = 12;

  /* ---- Bookings per week ---- */
  const weeks = weeklyCounts((created.data ?? []).map((r) => scheduledParts(r.created_at)?.ymd ?? ""), today, 8);
  const top = Math.max(1, ...weeks.map((w) => w.n));

  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: COSTA_RICA_TZ, hour: "numeric", hourCycle: "h23" }).format(new Date(now)));
  const longDate = new Intl.DateTimeFormat(teamLocale(lang), { timeZone: COSTA_RICA_TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(now));
  const pickLabel: Record<Pick7, string> = { today: t("Hoy", "Today"), tomorrow: t("Mañana", "Tomorrow"), "7d": t("7 días", "7 days") };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0 flex-[1_1_320px]">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[26px]">{greeting(hour, lang)}</h1>
          <p className="mt-0.5 text-[#5F6F67]">
            <span className="first-letter:uppercase inline-block">{longDate}</span> · {t("hora de Costa Rica", "Costa Rica time")}
          </p>
        </div>
        <form method="get" action="/admin/bookings" role="search" className="flex min-w-[240px] flex-[0_1_420px] items-center gap-2 rounded-xl border border-[#DCE3DF] bg-white px-3 focus-within:border-[#047857] focus-within:ring-2 focus-within:ring-[#047857]/20">
          <label htmlFor="panel-q" className="sr-only">
            {t("Buscar", "Search")}
          </label>
          <Icon name="search" className="h-[18px] w-[18px] shrink-0 text-[#5F6F67]" />
          <input
            id="panel-q"
            name="q"
            type="search"
            placeholder={t("Buscar reserva, viajero o conductor…", "Search booking, traveller or driver…")}
            className="min-h-11 min-w-0 grow bg-transparent text-sm outline-none"
          />
          <button type="submit" className="rounded-lg px-2 py-1 text-xs font-bold text-[#047857] hover:bg-[#F1F4F2]">
            {t("Buscar", "Search")}
          </button>
        </form>
        <Link href="/admin/bookings/new" className={btn.primary}>
          <Icon name="plus" />
          {t("Nueva reserva", "New booking")}
        </Link>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label={t("Recogidas hoy", "Pickups today")}
          value={String(todays.length)}
          sub={
            todays.filter((b) => !b.assigned_driver_id).length
              ? t(`${todays.filter((b) => !b.assigned_driver_id).length} sin conductor`, `${todays.filter((b) => !b.assigned_driver_id).length} without a driver`)
              : todays.length
                ? t("todas con conductor", "all have a driver")
                : t("ninguna hoy", "none today")
          }
          tone={todays.some((b) => !b.assigned_driver_id) ? "warn" : "muted"}
          href="/admin/bookings?range=today"
        />
        <Kpi
          label={t("Solicitudes nuevas", "New requests")}
          value={String(waitingPay.count ?? 0)}
          sub={t("esperando el pago", "waiting for payment")}
          tone="muted"
          href="/admin/bookings?status=pending_payment&range=all"
        />
        <Kpi
          label={t("Ingresos este mes", "Revenue this month")}
          value={usd(thisMonth).replace(/\.00$/, "")}
          sub={
            change === null
              ? t(`sin datos de ${lastMonthName} para comparar`, `no ${lastMonthName} figures to compare`)
              : `${change >= 0 ? "+" : ""}${change}% ${t("vs", "vs")} ${lastMonthName}`
          }
          tone={change === null ? "muted" : change >= 0 ? "good" : "warn"}
          note={t(
            "Monto recibido en reservas con recogida este mes (hora de Costa Rica). Sin reservas canceladas ni pagos de prueba.",
            "Amount received on bookings with a pickup this month (Costa Rica time). Cancelled bookings and test payments left out.",
          )}
        />
        <Kpi
          label={t("Calificación media", "Average rating")}
          value={avg === null ? "—" : avg.toFixed(1)}
          sub={stars.length ? t(`${stars.length} ${stars.length === 1 ? "reseña" : "reseñas"}`, `${stars.length} review${stars.length === 1 ? "" : "s"}`) : t("aún sin reseñas", "no reviews yet")}
          tone="muted"
          note={t("Estrellas que dieron los viajeros a sus conductores, todas las reseñas.", "Stars travellers gave their drivers, all reviews.")}
        />
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Card
          className="min-w-0 flex-[999_1_560px]"
          padded={false}
          id="pickups-h"
          title={t("Próximas recogidas", "Upcoming pickups")}
          actions={
            <nav aria-label={t("Periodo", "Period")} className="flex gap-1 rounded-xl bg-[#F1F4F2] p-1">
              {PICKS.map((p) => {
                const n = pickups.filter((b) => inPick(b, p)).length;
                const on = p === pick;
                return (
                  <Link
                    key={p}
                    href={p === "today" ? "/admin" : `/admin?pick=${p}`}
                    aria-current={on ? "page" : undefined}
                    className={`inline-flex min-h-9 items-center rounded-lg px-3 text-[13px] ${on ? "bg-white font-extrabold text-[#14231C] shadow-sm" : "font-bold text-[#5F6F67] hover:text-[#14231C]"}`}
                  >
                    {pickLabel[p]} · {n}
                  </Link>
                );
              })}
            </nav>
          }
        >
          {upcoming.error ? (
            <p className="p-5 text-sm font-semibold text-[#B91C1C]">{t("No se pudieron cargar las recogidas. Recargue la página.", "Couldn't load the pickups. Reload the page.")}</p>
          ) : shown.length === 0 ? (
            <EmptyState
              title={pick === "today" ? t("No hay recogidas hoy", "No pickups today") : t("No hay recogidas en este periodo", "No pickups in this period")}
              action={
                <Link href="/admin/bookings" className={btn.secondary}>
                  {t("Ver reservas", "See bookings")}
                </Link>
              }
            />
          ) : (
            <DataTable minWidth={720} caption={t("Próximas recogidas", "Upcoming pickups")}>
              <thead>
                <tr>
                  <Th>{t("Hora", "Time")}</Th>
                  <Th>{t("Reserva", "Booking")}</Th>
                  <Th>{t("Ruta", "Route")}</Th>
                  <Th>{t("Vehículo", "Vehicle")}</Th>
                  <Th>{t("Conductor", "Driver")}</Th>
                  <Th>{t("Estado", "Status")}</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((b) => {
                  const w = pickupDay(b.scheduled_at, today, lang);
                  const pax = b.passenger_count ?? 0;
                  const bags = b.luggage_count != null ? ` · ${b.luggage_count}${b.carry_on_count != null ? `+${b.carry_on_count}` : ""} ${t("maletas", "bags")}` : "";
                  const extra = [
                    Number(b.night_premium ?? 0) > 0 ? t("Recogida nocturna", "Night pickup") : "",
                    b.payment_mode === "cash_driver" ? t("Pago en efectivo", "Cash payment") : "",
                    b.flight_or_hotel_notes ?? "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={b.id} className="hover:bg-[#FAFBFA]">
                      <Td className="whitespace-nowrap">
                        <div className="font-extrabold">{w.time}</div>
                        {pick !== "today" && <div className="text-xs text-[#5F6F67]">{w.day}</div>}
                      </Td>
                      <Td>
                        <Link href={`/admin/bookings/${b.id}`} className={`whitespace-nowrap font-mono ${link}`}>
                          {b.booking_ref}
                        </Link>
                        <div className="text-xs text-[#5F6F67]">
                          {pax} {pax === 1 ? t("viajero", "traveller") : t("viajeros", "travellers")}
                          {bags}
                        </div>
                      </Td>
                      <Td>
                        <div className="font-semibold">{bookingTitle(b, catalog, lang)}</div>
                        {extra && <div className="max-w-[22rem] truncate text-xs text-[#5F6F67]" title={extra}>{extra}</div>}
                      </Td>
                      <Td className="text-[#33443C]">{b.service_type === "transfer" ? vehicleClassName(b.vehicle_class, catalog, lang) : t("Tour", "Tour")}</Td>
                      <Td>
                        {driverName(b.assigned_driver_id) ? (
                          <span className="font-semibold">{driverName(b.assigned_driver_id)}</span>
                        ) : (
                          <Link href={`/admin/bookings/${b.id}#dispatch`} className={btn.small}>
                            {t("Asignar", "Assign")}
                          </Link>
                        )}
                      </Td>
                      <Td>
                        <StatusChip status={b.status} lang={lang} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </Card>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <Card padded={false} id="attention-h" title={t("Necesita atención", "Needs attention")} actions={alerts.length > 0 ? <CountBadge n={alerts.length} tone="red" /> : undefined}>
            {alerts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#5F6F67]">{t("Todo al día. Nada urgente por ahora.", "All caught up. Nothing urgent right now.")}</p>
            ) : (
              <ul>
                {alerts.slice(0, MAX_ALERTS).map((a) => (
                  <li key={a.key} className="border-t border-[#F1F4F2] first:border-t-0">
                    <Link href={a.href} className="flex gap-3 px-4 py-3 text-[#14231C] hover:bg-[#FAFBFA] sm:px-5">
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.level === "red" ? "bg-[#DC2626]" : a.level === "amber" ? "bg-[#F59E0B]" : "bg-[#94A3B8]"}`}
                      />
                      <span className="flex min-w-0 grow flex-col gap-0.5">
                        <span className="font-bold">
                          <span className="sr-only">{a.level === "red" ? t("Urgente: ", "Urgent: ") : ""}</span>
                          {a.title}
                        </span>
                        <span className="text-[12.5px] text-[#5F6F67]">{a.detail}</span>
                      </span>
                      <Icon name="chevron" className="mt-1 h-4 w-4 shrink-0 text-[#9AA8A1]" />
                    </Link>
                  </li>
                ))}
                {alerts.length > MAX_ALERTS && (
                  <li className="border-t border-[#F1F4F2] px-5 py-3 text-xs text-[#5F6F67]">
                    {t(`y ${alerts.length - MAX_ALERTS} más`, `and ${alerts.length - MAX_ALERTS} more`)}
                  </li>
                )}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-extrabold">{t("Reservas por semana", "Bookings per week")}</h2>
              <span className="text-xs text-[#5F6F67]">{t("últimas 8 · recibidas", "last 8 · received")}</span>
            </div>
            <div className="mt-3 flex h-[110px] items-end gap-2" role="img" aria-label={weeks.map((w) => `${w.start}: ${w.n}`).join(", ")}>
              {weeks.map((w, i) => (
                <div
                  key={w.start}
                  title={`${t("Semana del", "Week of")} ${w.start}: ${w.n}`}
                  className={`flex-1 rounded-t-md rounded-b-sm ${i === weeks.length - 1 ? "bg-[#047857]" : "bg-[#A7D7C0]"}`}
                  style={{ height: `${Math.max(3, Math.round((w.n / top) * 100))}%` }}
                />
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-[#5F6F67]">
              <span>{weeks[0].start.slice(5)}</span>
              <span>
                {t("esta semana", "this week")}: <strong className="text-[#14231C]">{weeks[weeks.length - 1].n}</strong>
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  note,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "good" | "warn" | "muted";
  note?: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="text-[13px] font-bold text-[#5F6F67]">{label}</span>
      <span className="text-[30px] font-extrabold leading-tight">{value}</span>
      <span className={`text-[12.5px] font-bold ${tone === "good" ? "text-[#047857]" : tone === "warn" ? "text-[#B45309]" : "text-[#5F6F67]"}`}>{sub}</span>
      {note && <span className="mt-1 text-[11.5px] leading-snug text-[#5F6F67]">{note}</span>}
    </>
  );
  const cls = "flex flex-col gap-1 rounded-2xl border border-[#E3E8E5] bg-white px-[18px] py-4";
  return href ? (
    <Link href={href} className={`${cls} hover:border-[#A7D7C0]`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
