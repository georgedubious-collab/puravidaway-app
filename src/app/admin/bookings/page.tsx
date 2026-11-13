import Link from "next/link";
import { PaymentChip, StatusChip } from "@/components/admin/chips";
import { Card, DataTable, EmptyState, Icon, Notice, PageHeader, PhoneHeader, Td, Th, btn, field, link } from "@/components/admin/ui";
import { LiveRefresh } from "@/components/LiveRefresh";
import {
  LIST_STATUSES,
  PHONE_FILTERS,
  TO_ACT_STATUSES,
  activePhoneFilter,
  bookingsHref,
  phoneFilterHref,
  pageCount,
  pageSpan,
  parseBookingFilters,
  statusShort,
  type BookingFilters,
  type RangeId,
} from "@/lib/adminBookings";
import { bookingsPage, searchIds, statusCounts } from "@/lib/adminBookingsServer";
import { bookingTitle, pickupDay, vehicleClassName } from "@/lib/adminDisplay";
import { requireRole } from "@/lib/auth";
import { bookingDue, usd, type BookingRow, type TripContact } from "@/lib/bookings";
import { localizeCatalog } from "@/lib/catalogEs";
import { getCatalog } from "@/lib/catalogSource";
import { customerHref, customerKey } from "@/lib/customers";
import { nowMs, todayInCostaRica } from "@/lib/dates";
import { postingLabel, postingMinutesLeft, postingState } from "@/lib/postingWindow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

type Row = BookingRow & { trips: TripContact | null };

const SELECT = "*, trips(guest_name, guest_email, guest_phone)";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("admin", "/admin/bookings");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const f = parseBookingFilters(await searchParams);
  const today = todayInCostaRica();
  const now = nowMs();
  const supabase = (await createSupabaseServerClient())!;

  const ids = await searchIds(supabase, f.q);
  const [page, counts, rawCatalog, driverList, toAct] = await Promise.all([
    bookingsPage<Row>(supabase, SELECT, f, today, ids),
    statusCounts(supabase, f, today, ids),
    getCatalog(),
    supabase
      .from("drivers")
      .select("id, profiles!drivers_id_fkey(full_name)")
      .eq("kyc_status", "approved")
      .returns<{ id: string; profiles: { full_name: string | null } | null }[]>(),
    // "Por atender · N" on the phone: the same count as the side menu's Reservas badge.
    supabase.from("bookings").select("id", { count: "exact", head: true }).in("status", [...TO_ACT_STATUSES]),
  ]);
  const catalog = localizeCatalog(rawCatalog, lang);
  const rows = page.data;
  const total = page.count;

  // Driver names, offers waiting on the job board, and test checkouts for the rows on this page.
  const driverIds = [...new Set(rows.map((b) => b.assigned_driver_id).filter((x): x is string => Boolean(x)))];
  const openIds = rows.filter((b) => b.status === "pending_bids").map((b) => b.id);
  const rowIds = rows.map((b) => b.id);
  const [{ data: names }, { data: openOffers }, { data: tests }] = await Promise.all([
    driverIds.length ? supabase.from("profiles").select("id, full_name").in("id", driverIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    openIds.length
      ? supabase.from("bids").select("booking_id").in("booking_id", openIds).eq("status", "submitted")
      : Promise.resolve({ data: [] as { booking_id: string }[] }),
    rowIds.length
      ? supabase.from("payments").select("booking_id").in("booking_id", rowIds).eq("provider", "test")
      : Promise.resolve({ data: [] as { booking_id: string }[] }),
  ]);
  const driverName = (id: string | null) => (id ? (names?.find((p) => p.id === id)?.full_name ?? t("Conductor", "Driver")) : null);
  const offersOn = (id: string) => (openOffers ?? []).filter((o) => o.booking_id === id).length;
  const isTest = (id: string) => (tests ?? []).some((p) => p.booking_id === id);
  const pages = pageCount(total);
  const span = pageSpan(f.page, total);
  const filtered = Boolean(f.q) || f.range !== "upcoming" || f.type !== "all" || f.driver !== "all" || f.status !== "all";

  const RANGE_LABEL: Record<RangeId, string> = {
    upcoming: t("Próximas (desde hoy)", "Upcoming (from today)"),
    today: t("Hoy", "Today"),
    tomorrow: t("Mañana", "Tomorrow"),
    "7d": t("Próximos 7 días", "Next 7 days"),
    "30d": t("Próximos 30 días", "Next 30 days"),
    past: t("Pasadas", "Past"),
    all: t("Todas las fechas", "All dates"),
    custom: t("Fechas exactas (abajo)", "Exact dates (below)"),
  };

  // The search and filters card: shown as is from large screens up, folded under "Más filtros" on phones.
  const filtersCard = (
  <Card>
    <form method="get" action="/admin/bookings" className="flex flex-col gap-3">
      {f.status !== "all" && <input type="hidden" name="status" value={f.status} />}
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="min-w-0 flex-[1_1_300px]">
          <span className="sr-only">{t("Buscar reservas", "Search bookings")}</span>
          <span className="flex min-h-11 items-center gap-2 rounded-xl border border-[#DCE3DF] bg-white px-3 focus-within:border-[#047857] focus-within:ring-2 focus-within:ring-[#047857]/20">
            <Icon name="search" className="h-[18px] w-[18px] shrink-0 text-[#5F6F67]" />
            <input
              name="q"
              type="search"
              defaultValue={f.q}
              placeholder={t("Código, nombre del viajero, correo o conductor", "Code, traveller name, email or driver")}
              className="min-w-0 grow bg-transparent text-sm outline-none"
            />
          </span>
        </label>
        <label className="text-xs font-bold text-[#5F6F67]">
          {t("Fecha", "Date")}
          <select name="range" defaultValue={f.range} className={`${field.input} mt-0.5 w-auto`}>
            {(["upcoming", "today", "tomorrow", "7d", "30d", "past", "all", "custom"] as const).map((r) => (
              <option key={r} value={r}>
                {RANGE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-[#5F6F67]">
          {t("Tipo", "Type")}
          <select name="type" defaultValue={f.type} className={`${field.input} mt-0.5 w-auto`}>
            <option value="all">{t("Todos", "All")}</option>
            <option value="transfer">{t("Traslados", "Rides")}</option>
            <option value="day_tour">{t("Tours de un día", "Day tours")}</option>
          </select>
        </label>
        <label className="text-xs font-bold text-[#5F6F67]">
          {t("Conductor", "Driver")}
          <select name="driver" defaultValue={f.driver} className={`${field.input} mt-0.5 w-auto max-w-[14rem]`}>
            <option value="all">{t("Todos", "All")}</option>
            <option value="none">{t("Sin conductor", "No driver yet")}</option>
            {(driverList.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.profiles?.full_name ?? t("Conductor", "Driver")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details className="group" open={f.range === "custom"}>
        <summary className="inline-flex min-h-9 cursor-pointer items-center text-sm font-bold text-[#047857]">
          {t("Fechas exactas", "Exact dates")}
        </summary>
        <div className="mt-2 flex flex-wrap items-end gap-2.5">
          <label className="text-xs font-bold text-[#5F6F67]">
            {t("Desde", "From")}
            <input type="date" name="from" defaultValue={f.from} className={`${field.input} mt-0.5 w-auto`} />
          </label>
          <label className="text-xs font-bold text-[#5F6F67]">
            {t("Hasta", "To")}
            <input type="date" name="to" defaultValue={f.to} className={`${field.input} mt-0.5 w-auto`} />
          </label>
          <p className="pb-2 text-xs text-[#5F6F67]">{t("Fecha de recogida, hora de Costa Rica.", "Pickup date, Costa Rica time.")}</p>
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={btn.primary}>
          {t("Buscar y filtrar", "Search & filter")}
        </button>
        {filtered && (
          <Link href="/admin/bookings" className={btn.secondary}>
            {t("Quitar filtros", "Clear filters")}
          </Link>
        )}
      </div>
    </form>
    <nav aria-label={t("Filtrar por estado", "Filter by status")} className="mt-4 flex flex-wrap gap-1.5 border-t border-[#EDF1EE] pt-3">
      {(["all", ...LIST_STATUSES] as const).map((s) => {
        const on = f.status === s;
        return (
          <Link
            key={s}
            href={bookingsHref(f, { status: s })}
            aria-current={on ? "page" : undefined}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold ${
              on ? "border-[#0B2E22] bg-[#0B2E22] text-white" : "border-[#DCE3DF] bg-white text-[#33443C] hover:bg-[#F1F4F2]"
            }`}
          >
            {s === "all" ? t("Todas", "All") : statusShort(s, lang)}
            <span className={`rounded-full px-1.5 text-xs ${on ? "bg-[#1F4A3A] text-white" : "bg-[#F1F4F2] text-[#5F6F67]"}`}>{counts[s]}</span>
          </Link>
        );
      })}
    </nav>
  </Card>
  );
  const quick = activePhoneFilter(f);
  const QUICK_LABEL = {
    to_act: `${t("Por atender", "To handle")} · ${toAct.count ?? 0}`,
    today: t("Hoy", "Today"),
    upcoming: t("Próximas", "Upcoming"),
    all: t("Todas", "All"),
  } as const;

  return (
    <div className="space-y-4">
      {openIds.length > 0 && <LiveRefresh seconds={15} />}
      {/* ================= Phone (below lg) ================= */}
      <PhoneHeader>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold">{t("Reservas", "Bookings")}</h1>
          <Link
            href="/admin/bookings/new"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#F59E0B] px-3.5 text-sm font-extrabold text-[#1F1300] focus-visible:outline-2 focus-visible:outline-white"
          >
            <Icon name="plus" className="h-4 w-4" />
            {t("Nueva", "New")}
          </Link>
        </div>
        <form method="get" action="/admin/bookings" role="search" className="mt-3">
          {f.status !== "all" && <input type="hidden" name="status" value={f.status} />}
          {f.range !== "upcoming" && f.range !== "custom" && <input type="hidden" name="range" value={f.range} />}
          <label className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-[#5B6B64] focus-within:ring-2 focus-within:ring-[#F5B301]">
            <Icon name="search" className="h-[18px] w-[18px] shrink-0" />
            <span className="sr-only">{t("Buscar reservas", "Search bookings")}</span>
            <input
              name="q"
              type="search"
              defaultValue={f.q}
              enterKeyHint="search"
              placeholder={t("Nombre, correo o CRPT-…", "Name, email or CRPT-…")}
              className="min-h-11 min-w-0 grow bg-transparent text-[15px] text-[#14231C] outline-none"
            />
          </label>
        </form>
      </PhoneHeader>
      <nav aria-label={t("Filtros rápidos", "Quick filters")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden">
        {PHONE_FILTERS.map((id) => {
          const on = quick === id;
          return (
            <Link
              key={id}
              href={phoneFilterHref(id)}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-[13px] ${
                on ? "bg-[#0B2E22] font-extrabold text-white" : "border border-[#CBD5CF] bg-white font-bold text-[#14231C]"
              }`}
            >
              {QUICK_LABEL[id]}
            </Link>
          );
        })}
      </nav>
      <details className="group lg:hidden" open={quick === null && (f.type !== "all" || f.driver !== "all" || f.range === "custom" || (f.status !== "all" && f.status !== "to_act"))}>
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm font-bold text-[#047857]">
          {t("Más filtros, estado y CSV", "More filters, status & CSV")}
        </summary>
        <div className="mt-2 space-y-3">
          {filtersCard}
          <a href={bookingsHref(f, {}, "/admin/bookings/export")} className={btn.secondary} download>
            <Icon name="download" />
            {t("Exportar CSV", "Export CSV")}
          </a>
        </div>
      </details>

      {/* ================= Large screens (unchanged) ================= */}
      <div className="hidden lg:block">
        <PageHeader
          title={t("Reservas", "Bookings")}
          subtitle={
            lang === "en"
              ? `${total} booking${total === 1 ? "" : "s"} · sorted by pickup time${f.sort === "desc" ? " (latest first)" : ""}`
              : `${total} ${total === 1 ? "reserva" : "reservas"} · ordenadas por fecha de recogida${f.sort === "desc" ? " (las más recientes primero)" : ""}`
          }
          actions={
            <>
              <a href={bookingsHref(f, {}, "/admin/bookings/export")} className={btn.secondary} download>
                <Icon name="download" />
                {t("Exportar CSV", "Export CSV")}
              </a>
              <Link href="/admin/bookings/new" className={btn.primary}>
                <Icon name="plus" />
                {t("Nueva reserva", "New booking")}
              </Link>
            </>
          }
        />
  
      </div>
      <div className="hidden lg:block">{filtersCard}</div>

      {page.error ? (
        <Notice tone="red" role="alert">
          <p className="font-bold">{t("No se pudieron cargar las reservas.", "Couldn't load the bookings.")}</p>
          <p className="mt-1">
            {t("Puede ser la conexión. ", "It may be the connection. ")}
            <Link href={bookingsHref(f, { page: f.page })} className="font-bold underline">
              {t("Intentar de nuevo", "Try again")}
            </Link>
          </p>
          <p className="mt-1 text-xs opacity-80">{page.error.message}</p>
        </Notice>
      ) : (
        <Card padded={false} className="max-lg:overflow-visible max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent">
          {rows.length === 0 ? (
            <EmptyState
              title={filtered ? t("Ninguna reserva coincide", "No bookings match") : t("No hay reservas próximas", "No upcoming bookings")}
              text={
                filtered
                  ? t("Pruebe con otra búsqueda, otras fechas u otro estado.", "Try another search, other dates or another status.")
                  : t("Las solicitudes del sitio web y las que usted ingrese aparecen aquí.", "Requests from the website and the ones you enter show here.")
              }
              action={
                filtered ? (
                  <Link href="/admin/bookings" className={btn.secondary}>
                    {t("Quitar filtros", "Clear filters")}
                  </Link>
                ) : (
                  <Link href={bookingsHref(f, { range: "all" })} className={btn.secondary}>
                    {t("Ver todas las fechas", "See all dates")}
                  </Link>
                )
              }
            />
          ) : (
            <>
              {/* Phones and tablets (below lg, 2026-11-13): one card per booking. */}
              <ul className="space-y-2.5 lg:hidden">
                {rows.map((b) => {
                  const when = pickupDay(b.scheduled_at, today, lang);
                  const posting = postingState(b, now);
                  const what =
                    b.service_type === "transfer"
                      ? vehicleClassName(b.vehicle_class, catalog, lang)
                      : `${b.passenger_count ?? "?"} ${(b.passenger_count ?? 0) === 1 ? t("persona", "person") : t("personas", "people")}`;
                  return (
                    <li key={b.id}>
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="flex flex-col gap-2 rounded-2xl border border-[#E3E8E5] bg-white p-3.5 text-[#14231C] hover:border-[#A7D7C0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]"
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[13px] font-bold text-[#5B6B64]">{b.booking_ref}</span>
                          <StatusChip
                            status={b.status}
                            lang={lang}
                            posting={posting}
                            booking={b}
                            offers={b.status === "pending_bids" && (posting === "closed" || offersOn(b.id) > 0) ? offersOn(b.id) : undefined}
                            minutesLeft={postingMinutesLeft(b, now)}
                          />
                        </span>
                        <span className="text-base font-extrabold leading-snug">
                          {b.service_type === "day_tour" ? `${t("Tour", "Tour")}: ` : ""}
                          {bookingTitle(b, catalog, lang)}
                        </span>
                        <span className="flex items-end justify-between gap-2 text-[13px] text-[#3F4F48]">
                          <span className="min-w-0">
                            {when.day} · {when.time} · {what}
                            <span className="block truncate text-xs text-[#5F6F67]">
                              {b.trips?.guest_name ?? "—"} · {driverName(b.assigned_driver_id) ?? t("sin conductor", "no driver")}
                              {isTest(b.id) ? ` · ${t("PRUEBA", "TEST")}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-[15px] font-extrabold text-[#14231C]">{usd(bookingDue(b)).replace(/\.00$/, "")}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {/* Large screens: the table. */}
              <div className="hidden lg:block">
                <DataTable minWidth={980} caption={t("Reservas", "Bookings")}>
                  <thead>
                    <tr>
                      <Th>
                        <Link href={bookingsHref(f, { sort: f.sort === "asc" ? "desc" : "asc" })} className="inline-flex items-center gap-1 hover:text-[#14231C]">
                          {t("Recogida", "Pickup")} <span aria-hidden>{f.sort === "asc" ? "↑" : "↓"}</span>
                          <span className="sr-only">{f.sort === "asc" ? t("(la más próxima primero)", "(soonest first)") : t("(la más reciente primero)", "(latest first)")}</span>
                        </Link>
                      </Th>
                      <Th>{t("Reserva", "Booking")}</Th>
                      <Th>{t("Ruta / tour", "Route / tour")}</Th>
                      <Th>{t("Viajero", "Traveller")}</Th>
                      <Th>{t("Vehículo", "Vehicle")}</Th>
                      <Th>{t("Conductor", "Driver")}</Th>
                      <Th align="right">Total</Th>
                      <Th>{t("Pago", "Payment")}</Th>
                      <Th>{t("Estado", "Status")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => {
                      const when = pickupDay(b.scheduled_at, today, lang);
                      const offers = b.status === "pending_bids" ? offersOn(b.id) : 0;
                      return (
                        <tr key={b.id} className="hover:bg-[#FAFBFA]">
                          <Td className="whitespace-nowrap">
                            <div className="font-extrabold">{when.day}</div>
                            <div className="text-xs text-[#5F6F67]">{when.time}</div>
                          </Td>
                          <Td>
                            <Link href={`/admin/bookings/${b.id}`} className={`whitespace-nowrap font-mono ${link}`}>
                              {b.booking_ref}
                            </Link>
                          </Td>
                          <Td>
                            <div className="max-w-[18rem] font-semibold" title={bookingTitle(b, catalog, lang, false)}>
                              {b.service_type === "day_tour" ? `${t("Tour", "Tour")}: ` : ""}
                              {bookingTitle(b, catalog, lang)}
                            </div>
                            {b.pricing_mode === "bid" && (
                              <span className="mt-0.5 inline-block rounded bg-[#FEF3C7] px-1.5 text-xs font-bold text-[#92400E]">
                                {t("oferta del cliente", "client's offer")}
                              </span>
                            )}
                            {b.status === "pending_bids" &&
                              (postingState(b, now) === "closed" ? (
                                <span className="mt-0.5 inline-block rounded bg-[#FFEDD5] px-1.5 text-xs font-bold text-[#9A3412]">
                                  {postingLabel("closed", offers, 0, lang)}
                                </span>
                              ) : (
                                <span className={`mt-0.5 inline-block rounded px-1.5 text-xs font-bold ${offers ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#F1F4F2] text-[#5F6F67]"}`}>
                                  {offers} {offers === 1 ? t("oferta de conductor", "driver offer") : t("ofertas de conductores", "driver offers")}
                                </span>
                              ))}
                          </Td>
                          <Td>
                            {b.trips ? (
                              <Link href={customerHref(customerKey(b.trips.guest_email, b.trips.guest_phone, b.trip_id))} className={`font-semibold ${link}`}>
                                {b.trips.guest_name ?? "—"}
                              </Link>
                            ) : (
                              <div className="font-semibold">—</div>
                            )}
                            <div className="text-xs text-[#5F6F67]">
                              {b.passenger_count ?? "?"} {(b.passenger_count ?? 0) === 1 ? t("viajero", "traveller") : t("viajeros", "travellers")}
                            </div>
                          </Td>
                          <Td className="text-[#33443C]">{b.service_type === "transfer" ? vehicleClassName(b.vehicle_class, catalog, lang) : "—"}</Td>
                          <Td>
                            {driverName(b.assigned_driver_id) ?? (
                              <span className="font-semibold text-[#B45309]">{t("Sin conductor", "No driver")}</span>
                            )}
                          </Td>
                          <Td align="right" className="whitespace-nowrap font-extrabold">
                            {usd(bookingDue(b))}
                          </Td>
                          <Td>
                            <PaymentChip booking={b} lang={lang} test={isTest(b.id)} />
                          </Td>
                          <Td>
                            <StatusChip status={b.status} lang={lang} posting={postingState(b, now)} booking={b} />
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </div>
              <Pager f={f} pages={pages} span={span} total={total} lang={lang} />
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function Pager({
  f,
  pages,
  span,
  total,
  lang,
}: {
  f: BookingFilters;
  pages: number;
  span: { first: number; last: number };
  total: number;
  lang: "es" | "en";
}) {
  const t = makeT(lang);
  const prev = f.page > 1;
  const next = f.page < pages;
  const cls = "inline-flex min-h-10 items-center rounded-xl border border-[#DCE3DF] bg-white px-3 text-sm font-bold";
  return (
    <nav
      aria-label={t("Páginas", "Pages")}
      className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#EDF1EE] px-4 py-3 text-sm text-[#5F6F67] sm:px-5"
    >
      <span>
        {span.first}–{span.last} {t("de", "of")} {total} · {t("página", "page")} {Math.min(f.page, pages)} {t("de", "of")} {pages}
      </span>
      <div className="flex gap-1.5">
        {prev ? (
          <Link href={bookingsHref(f, { page: f.page - 1 })} rel="prev" className={`${cls} text-[#14231C] hover:bg-[#F1F4F2]`}>
            {t("Anterior", "Previous")}
          </Link>
        ) : (
          <span aria-disabled="true" className={`${cls} text-[#9AA8A1]`}>
            {t("Anterior", "Previous")}
          </span>
        )}
        {next ? (
          <Link href={bookingsHref(f, { page: f.page + 1 })} rel="next" className={`${cls} text-[#14231C] hover:bg-[#F1F4F2]`}>
            {t("Siguiente", "Next")}
          </Link>
        ) : (
          <span aria-disabled="true" className={`${cls} text-[#9AA8A1]`}>
            {t("Siguiente", "Next")}
          </span>
        )}
      </div>
    </nav>
  );
}
