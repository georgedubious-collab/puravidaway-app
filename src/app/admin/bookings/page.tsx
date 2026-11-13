import Link from "next/link";
import { PaymentChip, StatusChip } from "@/components/admin/chips";
import { Card, DataTable, EmptyState, Icon, Notice, PageHeader, Td, Th, btn, field, link } from "@/components/admin/ui";
import { LiveRefresh } from "@/components/LiveRefresh";
import {
  LIST_STATUSES,
  bookingsHref,
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
import { postingLabel, postingState } from "@/lib/postingWindow";
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
  const [page, counts, rawCatalog, driverList] = await Promise.all([
    bookingsPage<Row>(supabase, SELECT, f, today, ids),
    statusCounts(supabase, f, today, ids),
    getCatalog(),
    supabase
      .from("drivers")
      .select("id, profiles!drivers_id_fkey(full_name)")
      .eq("kyc_status", "approved")
      .returns<{ id: string; profiles: { full_name: string | null } | null }[]>(),
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

  return (
    <div className="space-y-4">
      {openIds.length > 0 && <LiveRefresh seconds={15} />}
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
        <Card padded={false}>
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
              {/* Phones: one card per booking. */}
              <ul className="divide-y divide-[#EDF1EE] md:hidden">
                {rows.map((b) => {
                  const when = pickupDay(b.scheduled_at, today, lang);
                  return (
                    <li key={b.id}>
                      <Link href={`/admin/bookings/${b.id}`} className="block px-4 py-3.5 hover:bg-[#FAFBFA]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold">
                              {when.day} · {when.time}
                            </p>
                            <p className="truncate font-semibold">{bookingTitle(b, catalog, lang)}</p>
                            <p className="text-xs text-[#5F6F67]">
                              <span className="font-mono font-bold text-[#047857]">{b.booking_ref}</span> · {b.trips?.guest_name ?? "—"} ·{" "}
                              {b.passenger_count ?? "?"} {t("viajeros", "travellers")}
                            </p>
                          </div>
                          <p className="shrink-0 text-right font-extrabold">{usd(bookingDue(b))}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <StatusChip status={b.status} lang={lang} posting={postingState(b, now)} />
                          <PaymentChip booking={b} lang={lang} test={isTest(b.id)} />
                          <span className="text-xs text-[#5F6F67]">
                            {driverName(b.assigned_driver_id) ?? t("sin conductor", "no driver")}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {/* Larger screens: the table. */}
              <div className="hidden md:block">
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
                            <StatusChip status={b.status} lang={lang} posting={postingState(b, now)} />
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
