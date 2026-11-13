import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { BookingTimeline, type BookingEvent } from "@/components/admin/BookingTimeline";
import { PaymentChip, StatusChip } from "@/components/admin/chips";
import { Card, Chip, Detail, DetailList, Notice, PageHeader, btn, field, link } from "@/components/admin/ui";
import { ChatBox } from "@/components/ChatBox";
import { requireRole } from "@/lib/auth";
import { bagsForTeam } from "@/lib/bags";
import { BOOKING_STATUSES, bookingDue, bookingStatusLabel, serviceLabel, usd, type BookingRow, type OfferRow, type TripContact } from "@/lib/bookings";
import { RETIRED_LODGING_TIERS, bookedItemName } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalogSource";
import { customStopsOf, savedStopLabel, stopTimeText } from "@/lib/customStops";
import { formatScheduledAt, nowMs, scheduledParts, todayInCostaRica } from "@/lib/dates";
import { canTakeTrips, type DriverRecord, type VehicleRecord } from "@/lib/driverKyc";
import { prefMismatches, prefsSummary } from "@/lib/preferences";
import { signShown } from "@/lib/sign";
import { categoryLabel, isVehicleCategory, jobClassLabel, vehicleCanServe } from "@/lib/vehicleEligibility";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { compareRanks, nearHome, offerRank, ratingBand, returnMatch, townName, townOf, type ReturnMatch, type TripLike } from "@/lib/matching";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { acceptOffer, repostJob, updateBooking } from "../actions";
import { AUTO_REPOST_HOURS, POSTING_WINDOW_MINUTES, canRepost, postingLabel, postingMinutesLeft, postingState } from "@/lib/postingWindow";
// CRM part 3 (2026-11-12): customer link, WhatsApp card, cancel + refund, team name sign.
import { customerHref, customerKey } from "@/lib/customers";
import { localizeCatalog, placeNameFor } from "@/lib/catalogEs";
import { formatScheduledAtFor } from "@/lib/dates";
import { SITE_URL } from "@/lib/email";
import { parsePublicLang } from "@/lib/publicLang";
import { REFUND_METHODS, cancelledByText, isoToCrLocal, refundMethodText, ruleText, type CancelledBy, type RefundRule } from "@/lib/refundPolicy";
import { SIGN_MAX, shortName } from "@/lib/sign";
import { WA_KINDS, vehicleText, waButtonLabel, waLink, waMessage, waUnavailable } from "@/lib/whatsappMessages";
import { markRefundPaid, setSignByTeam } from "../crmActions";
import { CancelBookingForm, WhatsAppButtons } from "./CrmCards";
// Team edits pickup / drop-off / time (2026-11-12, src/lib/bookingEdit.ts).
import { HUBS } from "@/lib/catalog";
import { canEditPlaces } from "@/lib/bookingEdit";
import { storedRidePlace } from "@/lib/places";
import { EditTripCard } from "./EditTripCard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type DriverRow = DriverRecord & { profiles: { full_name: string | null } | null; driver_vehicles: VehicleRecord[] };

/** Offer statuses as stored (bids.status), in Spanish for the team. */
const OFFER_STATUS_ES: Record<string, string> = {
  submitted: "enviada",
  accepted: "aceptada",
  declined: "rechazada",
  withdrawn: "retirada",
};

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("admin", `/admin/bookings/${id}`);
  if (!UUID.test(id)) notFound();
  const lang = await getTeamLang();
  const t = makeT(lang);
  const supabase = (await createSupabaseServerClient())!;
  const [{ data: b, error }, { data: drivers }, catalog] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, trips(guest_name, guest_email, guest_phone, language, access_token)")
      .eq("id", id)
      .maybeSingle<BookingRow & { en_route_at?: string | null; trips: (TripContact & { access_token?: string | null }) | null }>(),
    supabase
      .from("drivers")
      .select("*, profiles!drivers_id_fkey(full_name), driver_vehicles(*)")
      .eq("kyc_status", "approved")
      .returns<DriverRow[]>(),
    getCatalog(),
  ]);
  if (error)
    return (
      <p className="font-semibold text-red-700">
        {t("No se pudo cargar esta reserva:", "Couldn't load this booking:")} {error.message}
      </p>
    );
  if (!b) notFound();

  const { data: note } = await supabase.from("booking_admin_notes").select("notes").eq("booking_id", b.id).maybeSingle();
  // Contact details hidden from the chat or the notes (originals, admins only; migration 0034).
  const { count: flagCount } = await supabase.from("contact_flags").select("id", { count: "exact", head: true }).eq("booking_id", b.id);
  // Payments from the pre-launch test checkout are not real money.
  const { data: testPays } = await supabase.from("payments").select("id").eq("booking_id", b.id).eq("provider", "test").limit(1);
  const testPaid = Boolean(testPays?.length);
  // Drivers' offers from the job board, with who they are and how much work they've had.
  const { data: offers } = await supabase.from("bids").select("*").eq("booking_id", b.id).order("created_at").returns<OfferRow[]>();
  const offerDriverIds = [...new Set((offers ?? []).map((o) => o.driver_id))];
  type Load = TripLike & { assigned_driver_id: string | null };
  const [{ data: offerNames }, { data: offerHomes }, { data: offerLoad }] = offerDriverIds.length
    ? await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", offerDriverIds),
        supabase.from("drivers").select("id, home_hub, rating_avg, rating_count").in("id", offerDriverIds),
        supabase
          .from("bookings")
          .select("id, assigned_driver_id, status, scheduled_at, origin, destination, origin_coords, destination_coords, sightseeing_stops, booking_ref")
          .in("assigned_driver_id", offerDriverIds)
          .in("status", ["confirmed", "in_progress", "completed"])
          .returns<Load[]>(),
      ])
    : [{ data: [] }, { data: [] }, { data: [] as Load[] }];
  const nameOf = (id: string) => offerNames?.find((p) => p.id === id)?.full_name ?? t("Conductor", "Driver");
  type DriverBits = { id: string; home_hub: string | null; rating_avg: number | string | null; rating_count: number | null };
  const bitsOf = (id: string) => (offerHomes as DriverBits[] | null)?.find((d) => d.id === id);
  const homeOf = (id: string) => bitsOf(id)?.home_hub ?? null;
  const ratingText = (id: string) => {
    const d = bitsOf(id);
    return d?.rating_count ? `★ ${Number(d.rating_avg).toFixed(1)} (${d.rating_count})` : t("★ conductor nuevo", "★ new driver");
  };
  const tripsOf = (id: string) => (offerLoad ?? []).filter((x) => x.assigned_driver_id === id);
  // Rank offers: return-trip match first, then drivers based nearby, then fewer trips, then cheaper.
  const job = {
    origin_town: townOf(b.origin, b.origin_coords),
    destination_town: townOf(b.destination, b.destination_coords),
    scheduled_at: b.scheduled_at ?? "",
  };
  const ranked = (offers ?? [])
    .map((o) => {
      const mine = tripsOf(o.driver_id);
      const match = b.scheduled_at ? returnMatch(job, mine.filter((x) => x.id !== b.id)) : null;
      const home = nearHome(homeOf(o.driver_id), job);
      const bits = bitsOf(o.driver_id);
      const rating = ratingBand(bits?.rating_avg, bits?.rating_count);
      // The traveller asked for an electric vehicle: offers made with one come first.
      const electricMiss = Boolean(b.preferences?.electric) && !(drivers ?? []).flatMap((d) => d.driver_vehicles).find((x) => x.id === o.vehicle_id)?.is_electric;
      return { o, match, home, trips: mine.length, rank: offerRank({ match, home, trips: mine.length, amount: Number(o.bid_amount), rating, electricMiss }) };
    })
    .sort((x, y) => compareRanks(x.rank, y.rank));
  const gapText = (m: ReturnMatch) => (m.gapMinutes >= 60 ? `${Math.floor(m.gapMinutes / 60)} h` : `${m.gapMinutes} min`);
  const matchText = (m: ReturnMatch) =>
    m.kind === "after"
      ? t(
          `Viaje de regreso: deja clientes en ${townName(job.origin_town, lang)} ${gapText(m)} antes de esta recogida (${m.trip.booking_ref ?? ""})`,
          `Return trip: drops off in ${townName(job.origin_town, lang)} ${gapText(m)} before this pickup (${m.trip.booking_ref ?? ""})`,
        )
      : t(
          `Enlaza con su siguiente viaje desde ${townName(job.destination_town, lang)} (${m.trip.booking_ref ?? ""})`,
          `Leads into their next trip from ${townName(job.destination_town, lang)} (${m.trip.booking_ref ?? ""})`,
        );
  const { data: siblings } = b.trip_id
    ? await supabase.from("bookings").select("id, booking_ref, service_type, scheduled_at").eq("trip_id", b.trip_id).neq("id", b.id)
    : { data: [] };

  // Change history (migration 0044): who changed what, with names for the people and vehicles in it.
  const history = await supabase
    .from("booking_events")
    .select("id, at, actor_id, action, before, after")
    .eq("booking_id", b.id)
    .order("at")
    .limit(500)
    .returns<BookingEvent[]>();
  const events = history.data ?? [];
  const personIds = [
    ...new Set(
      events
        .flatMap((e) => [e.actor_id, e.before?.driver_id, e.after?.driver_id])
        .filter((x): x is string => typeof x === "string" && UUID.test(x)),
    ),
  ];
  const vehicleIds = [
    ...new Set(events.flatMap((e) => [e.before?.vehicle_id, e.after?.vehicle_id]).filter((x): x is string => typeof x === "string" && UUID.test(x))),
  ];
  const [{ data: people }, { data: eventVehicles }] = await Promise.all([
    personIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", personIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
    vehicleIds.length
      ? supabase.from("driver_vehicles").select("id, make_model, plate").in("id", vehicleIds)
      : Promise.resolve({ data: [] as { id: string; make_model: string | null; plate: string | null }[] }),
  ]);
  const personName = (id: unknown) => {
    const p = people?.find((x) => x.id === id);
    return p ? p.full_name || p.email || null : null;
  };
  const vehicleName = (id: unknown) => {
    const v = eventVehicles?.find((x) => x.id === id);
    return v ? `${v.make_model ?? ""} ${v.plate ?? ""}`.trim() || null : null;
  };

  // ---- CRM part 3 data (2026-11-12) ----
  type RefundRow = {
    cancelled_by: CancelledBy;
    cancelled_at: string;
    asked_at: string | null;
    amount_received: number | string;
    refund_policy: number | string;
    refund_rule: RefundRule;
    refund_due: number | string;
    refund_reason: string | null;
    refund_paid_amount: number | string | null;
    refund_paid_on: string | null;
    refund_method: string | null;
  };
  const [{ data: refund }, { data: waVehicle }, { data: waDriver }] = await Promise.all([
    supabase.from("booking_refunds").select("*").eq("booking_id", b.id).maybeSingle<RefundRow>(),
    b.assigned_vehicle_id
      ? supabase.from("driver_vehicles").select("make_model, year, color, plate").eq("id", b.assigned_vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
    b.assigned_driver_id ? supabase.from("profiles").select("full_name").eq("id", b.assigned_driver_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const signSetBy = [...events].reverse().find((e) => e.action === "sign");
  // ---- end CRM part 3 data ----

  const today = todayInCostaRica();
  const seats = b.passenger_count ?? 1;
  // Approved drivers and their approved vehicles that can legally take trips and fit the group.
  // Drivers who blocked the trip's day in their calendar.
  const tripDay = scheduledParts(b.scheduled_at)?.ymd;
  const { data: daysOff } = tripDay ? await supabase.from("driver_unavailable").select("driver_id").eq("day", tripDay) : { data: [] };
  const unavailable = new Set((daysOff ?? []).map((u) => u.driver_id as string));
  const options = (drivers ?? []).flatMap((d) =>
    d.driver_vehicles
      .filter((v) => v.status === "approved")
      .map((v) => {
        const problems = [
          ...(canTakeTrips(d, [v], today) ? [] : [t("documentos", "documents")]),
          ...(unavailable.has(d.id) ? [t("no disponible ese día", "unavailable that day")] : []),
          ...((v.passenger_capacity ?? 0) >= seats ? [] : [t("asientos", "seats")]),
          // Category (migration 0038): the team may still assign anyone, but is warned.
          ...(vehicleCanServe(v.vehicle_class, b.vehicle_class)
            ? []
            : [t(`categoría ${categoryLabel(v.vehicle_class, lang)}`, `category ${categoryLabel(v.vehicle_class, lang)}`)]),
          ...prefMismatches(b.preferences, d, v, lang),
        ];
        return {
          value: `${d.id}:${v.id}`,
          label: `${d.profiles?.full_name ?? t("Conductor", "Driver")} — ${v.make_model ?? t("vehículo", "vehicle")} ${v.plate ?? ""} (${v.passenger_capacity ?? "?"} ${t("asientos", "seats")}${isVehicleCategory(v.vehicle_class) ? `, ${categoryLabel(v.vehicle_class, lang)}` : ""}${v.is_electric ? `, ⚡ ${t("eléctrico", "electric")}` : ""})`,
          problems,
        };
      }),
  );
  const current = b.assigned_driver_id && b.assigned_vehicle_id ? `${b.assigned_driver_id}:${b.assigned_vehicle_id}` : "";
  // The assigned vehicle's category can't serve the booked class: a clear warning for the team.
  const assignedVehicle = (drivers ?? []).flatMap((d) => d.driver_vehicles).find((v) => v.id === b.assigned_vehicle_id);
  const categoryMismatch =
    assignedVehicle && b.vehicle_class && !vehicleCanServe(assignedVehicle.vehicle_class, b.vehicle_class) ? assignedVehicle : null;
  const bookedClassName = b.vehicle_class
    ? (catalog.vehicles.find((v) => v.id === b.vehicle_class)?.name ?? jobClassLabel(b.vehicle_class, lang))
    : "";
  // An offer sent before the vehicle was tagged can end up in a category that doesn't cover the job.
  const offerCategoryProblem = (vehicleId: string | null) => {
    const v = (drivers ?? []).flatMap((d) => d.driver_vehicles).find((x) => x.id === vehicleId);
    return v && !vehicleCanServe(v.vehicle_class, b.vehicle_class)
      ? t(
          `Categoría ${categoryLabel(v.vehicle_class, lang)}: no cubre ${bookedClassName}`,
          `${categoryLabel(v.vehicle_class, lang)} category: doesn't cover ${bookedClassName}`,
        )
      : null;
  };
  // Electric vehicles (migration 0042): when the traveller asked for one, offers made with an
  // electric vehicle are listed first (see offerRank). It never limits who can be assigned;
  // the traveller's request is "if available".
  const askedElectric = Boolean(b.preferences?.electric);
  const offerIsElectric = (vehicleId: string | null) =>
    Boolean((drivers ?? []).flatMap((d) => d.driver_vehicles).find((x) => x.id === vehicleId)?.is_electric);
  const name =
    b.service_type === "transfer"
      ? `${b.origin} → ${b.destination}`
      : (bookedItemName(catalog.dayTours, b.catalog_item_id, lang) ?? b.catalog_item_id);
  const stops = (b.sightseeing_stops ?? [])
    .map((s) => savedStopLabel(s, catalog.stops))
    .join(", ");
  // The traveller's own stops ("add your own stop"), in their order.
  const ownStops = b.service_type === "transfer" ? customStopsOf(b.sightseeing_stops) : [];
  const cashFee = Number(b.cash_fee ?? 0);
  const due = bookingDue(b);
  const paymentText =
    b.payment_mode === "cash_driver"
      ? t(
          `Efectivo al conductor: ${usd(due)} (${usd(b.total_price)} + ${usd(cashFee)} de cargo por reserva en efectivo)`,
          `Cash to driver: ${usd(due)} (${usd(b.total_price)} + ${usd(cashFee)} cash booking fee)`,
        )
      : b.payment_mode === "deposit_20"
        ? t(
            `Depósito del 20% (solicitud antigua): ${usd(Math.round(Number(b.total_price) * 20) / 100)} de ${usd(b.total_price)}`,
            `20% deposit (old request): ${usd(Math.round(Number(b.total_price) * 20) / 100)} of ${usd(b.total_price)}`,
          )
        : t(
            `En línea, pago completo: ${usd(due)} (envíe el enlace de pago una vez confirmada)`,
            `Online in full: ${usd(due)} (send the payment link once confirmed)`,
          );
  const guest: TripContact = b.trips ?? { guest_name: null, guest_email: null, guest_phone: null };
  const phoneDigits = guest.guest_phone?.replace(/\D/g, "") ?? "";
  const asked = prefsSummary(b.preferences, lang);

  // ---- CRM part 3: one-tap WhatsApp messages, in the traveller's booking language ----
  const glang = parsePublicLang(guest.language);
  const waFacts = {
    lang: glang,
    guestName: guest.guest_name,
    ref: b.booking_ref,
    what:
      b.service_type === "transfer"
        ? `${placeNameFor(b.origin, glang)} → ${placeNameFor(b.destination, glang)}`
        : (bookedItemName(localizeCatalog(catalog, glang).dayTours, b.catalog_item_id, glang) ?? b.catalog_item_id ?? ""),
    when: formatScheduledAtFor(b.scheduled_at, glang),
    tripUrl: b.trips?.access_token ? `${SITE_URL}/trip/${b.trips.access_token}` : null,
    driver: b.assigned_driver_id ? (waDriver?.full_name ?? "").trim().split(/\s+/)[0] || null : null,
    vehicle: vehicleText(waVehicle, glang),
    sign: b.service_type === "transfer" ? signShown(b, guest.guest_name) : null,
    amountDue: b.payment_mode === "cash_driver" ? 0 : Math.max(0, Math.round((due - Number(b.amount_paid ?? 0)) * 100) / 100),
  };
  const waButtons = WA_KINDS.map((k) => {
    const text = waMessage(k, waFacts);
    return { kind: k, label: waButtonLabel(k, lang), href: waLink(guest.guest_phone, text), unavailable: waUnavailable(k, waFacts, lang), text };
  });
  const hasWaNumber = waButtons.some((x) => x.href);
  const custKey = b.trips ? customerKey(guest.guest_email, guest.guest_phone, b.trip_id) : null;
  // ---- end CRM part 3 ----

  // Job board posting window (migration 0054): open for 1 hour, then "Publicación cerrada".
  const now = nowMs();
  const posting = postingState(b, now);
  const openOffers = (offers ?? []).filter((o) => o.status === "submitted").length;

  return (
    <div className="space-y-5">
      {posting === "open" && <LiveRefresh seconds={10} />}
      <PageHeader
        back={{ href: "/admin/bookings", label: t("Todas las reservas", "All bookings") }}
        eyebrow={b.booking_ref}
        title={
          <>
            {serviceLabel(b.service_type, lang)}: {name}
          </>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {formatScheduledAt(b.scheduled_at, lang)} · {t("enviada", "sent")} {b.created_at.slice(0, 10)}
            </span>
            <StatusChip status={b.status} lang={lang} posting={posting} />
            <PaymentChip booking={b} lang={lang} test={testPaid} />
          </span>
        }
        actions={
          <>
            <Link
              href={`/admin/dispatch?d=${scheduledParts(b.scheduled_at)?.ymd ?? ""}${b.assigned_driver_id || b.status === "cancelled" ? "" : `&assign=${b.id}`}`}
              className={btn.secondary}
            >
              {t("Ver en el calendario", "See on the calendar")}
            </Link>
            {canEditPlaces(b.status) && (b.service_type === "transfer" || b.service_type === "day_tour") && (
              <a href="#edit-trip" className={btn.secondary}>
                {t("Cambiar recogida u hora", "Change pickup or time")}
              </a>
            )}
            <a href="#dispatch" className={btn.primary}>
              {t("Asignar y cambiar estado", "Dispatch & status")}
            </a>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("Cliente", "Client")}>
          <DetailList>
            <Detail
              k={t("Nombre", "Name")}
              v={
                custKey ? (
                  <Link href={customerHref(custKey)} className={link}>
                    {guest.guest_name ?? t("(sin nombre)", "(no name)")} · {t("ver cliente", "see customer")}
                  </Link>
                ) : (
                  guest.guest_name
                )
              }
            />
            <Detail k={t("Correo", "Email")} v={guest.guest_email} />
            <Detail k="WhatsApp" v={guest.guest_phone} />
            <Detail
              k={t("Idioma", "Language")}
              v={
                guest.language === "es"
                  ? t("Español: escríbale en español (chat y WhatsApp)", "Spanish: write to them in Spanish (chat and WhatsApp)")
                  : t("Inglés", "English")
              }
            />
            <Detail k={t("Sus notas", "Their notes")} v={b.client_notes} />
          </DetailList>
          {phoneDigits && (
            <a href="#whatsapp" className={`mt-4 ${btn.primary}`}>
              {t("Mensajes de WhatsApp", "WhatsApp messages")}
            </a>
          )}
          {siblings && siblings.length > 0 && (
            <p className="mt-4 text-sm text-[#5F6F67]">
              {t("Mismo viaje:", "Same trip:")}{" "}
              {siblings.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", "}
                  <Link href={`/admin/bookings/${s.id}`} className={`font-mono ${link}`}>
                    {s.booking_ref}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </Card>

        <Card title={t("Viaje", "Trip")}>
          <DetailList>
            <Detail k={t("Recogida (hora de Costa Rica)", "Pickup (Costa Rica time)")} v={formatScheduledAt(b.scheduled_at, lang)} />
            {b.service_type === "transfer" && (
              <Detail k={t("Tipo de vehículo", "Vehicle class")} v={catalog.vehicles.find((v) => v.id === b.vehicle_class)?.name ?? b.vehicle_class} />
            )}
            {b.passenger_count ? <Detail k={t("Pasajeros", "Passengers")} v={b.passenger_count} /> : null}
            {bagsForTeam(b.luggage_count, b.carry_on_count, lang) != null && (
              <Detail k={t("Maletas", "Bags")} v={bagsForTeam(b.luggage_count, b.carry_on_count, lang)} />
            )}
            {b.drive_minutes != null && (
              <Detail
                k={t("Tiempo de manejo", "Drive time")}
                v={`${Math.floor(b.drive_minutes / 60)} h ${String(b.drive_minutes % 60).padStart(2, "0")} min${
                  ownStops.length
                    ? t(" (con el desvío a las paradas propias; sin el tiempo en las paradas)", " (with the detour to the traveller's own stops; without the time at stops)")
                    : t(" (sin paradas)", " (without stops)")
                }`}
              />
            )}
            {stops && <Detail k={t("Paradas / extras", "Stops / extras")} v={stops} />}
            {ownStops.length > 0 && (
              <Detail
                k={t("Paradas propias del cliente", "Traveller's own stops")}
                v={
                  <ol className="list-decimal space-y-1 pl-5">
                    {ownStops.map((s) => (
                      <li key={s.id}>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}&query_place_id=${encodeURIComponent(s.place_id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={link}
                        >
                          {s.name}
                        </a>
                        {" · "}
                        {stopTimeText(s.minutes)} {t("en el lugar", "there")} · {t("desvío", "detour")} {s.detour_km} km / {s.detour_min} min
                        {s.price != null ? ` · ${usd(s.price)} ${t("antes de temporada", "before the season")}` : ""}
                        <span className="block text-xs font-normal text-[#5F6F67]">
                          {t("Entradas no incluidas: el cliente las paga en el lugar.", "Entrance tickets not included: the traveller pays at the place.")}
                        </span>
                      </li>
                    ))}
                  </ol>
                }
              />
            )}
            {b.lodging_tier && <Detail k={t("Hospedaje", "Lodging")} v={RETIRED_LODGING_TIERS[b.lodging_tier]?.[lang] ?? b.lodging_tier} />}
            {b.flight_or_hotel_notes && <Detail k={t("Notas del viaje", "Ride notes")} v={b.flight_or_hotel_notes} />}
            {asked.length > 0 && <Detail k={t("Pidió", "Asked for")} v={asked.join(", ")} />}
            {b.driver_payout != null && (
              <Detail
                k={t("Pago al conductor", "Driver payout")}
                v={`${usd(b.driver_payout)} (${t("nos quedamos", "we keep")} ${usd(b.platform_fee ?? 0)}${
                  Number(b.company_costs ?? 0) > 0
                    ? t(
                        `, de los cuales ${usd(b.company_costs ?? 0)} cubren entradas, almuerzo y actividades: ${usd(Number(b.platform_fee ?? 0) - Number(b.company_costs ?? 0))} neto`,
                        `, of which ${usd(b.company_costs ?? 0)} pays entrances, lunch and activities: ${usd(Number(b.platform_fee ?? 0) - Number(b.company_costs ?? 0))} net`,
                      )
                    : ""
                })${b.claimed_at ? t(" · oferta aceptada de la bolsa de trabajos", " · offer accepted from the job board") : t(" · sugerido", " · suggested")}`}
              />
            )}
            {b.promo_code && Number(b.promo_discount ?? 0) > 0 && (
              <Detail
                k={t("Código promocional", "Promo code")}
                v={t(
                  `${b.promo_code} −${usd(b.promo_discount ?? 0)} (precio antes: ${usd(Number(b.total_price) + Number(b.promo_discount ?? 0))}; mitad de nuestra parte, mitad del pago al conductor)`,
                  `${b.promo_code} −${usd(b.promo_discount ?? 0)} (price before: ${usd(Number(b.total_price) + Number(b.promo_discount ?? 0))}; half from our share, half from the driver's payout)`,
                )}
              />
            )}
            {b.driver_notes && <Detail k={t("Mensaje para el conductor", "Message for driver")} v={b.driver_notes} />}
            {b.service_type !== "transfer" && (
              <Detail k={t("Lugar de recogida", "Pickup place")} v={b.pickup_place || t("(no indicado)", "(not given)")} />
            )}
            <Detail
              k={t("Mensajes automáticos", "Automatic messages")}
              v={[
                b.reminder_traveller_at ? t(`Recordatorio al cliente: ${formatScheduledAt(b.reminder_traveller_at, lang)}`, `Reminder to traveller: ${formatScheduledAt(b.reminder_traveller_at, lang)}`) : "",
                b.reminder_driver_at ? t(`Recordatorio al conductor: ${formatScheduledAt(b.reminder_driver_at, lang)}`, `Reminder to driver: ${formatScheduledAt(b.reminder_driver_at, lang)}`) : "",
                b.followup_sent_at ? t(`Sugerencia de regreso: revisada ${formatScheduledAt(b.followup_sent_at, lang)}`, `Return suggestion: checked ${formatScheduledAt(b.followup_sent_at, lang)}`) : "",
              ].filter(Boolean).join(" · ") || t("Ninguno todavía", "None yet")}
            />
            {b.service_type === "transfer" && (
              <Detail
                k={t("Rótulo", "Name sign")}
                v={`“${signShown(b, guest.guest_name)}” ${
                  signSetBy
                    ? t(
                        `(último cambio: ${personName(signSetBy.actor_id) ?? "el viajero"}, ${formatScheduledAt(signSetBy.at, lang)})`,
                        `(last changed by ${personName(signSetBy.actor_id) ?? "the traveller"}, ${formatScheduledAt(signSetBy.at, lang)})`,
                      )
                    : b.sign_text
                    ? t("(texto del cliente)", "(the client's own text)")
                    : b.sign_hide_name
                      ? t("(el cliente pidió no mostrar su nombre)", "(the client asked not to show their name)")
                      : t("(nombre e inicial del apellido; el cliente no escribió nada)", "(first name + last initial; the client wrote nothing)")
                }`}
              />
            )}
            <Detail k={t("Precio", "Price")} v={`${usd(b.total_price)}${b.pricing_mode === "bid" ? t(" (oferta del cliente)", " (client's offer)") : ""}`} />
            {Number(b.night_premium ?? 0) > 0 && (
              <Detail k={t("Recargo nocturno", "Night premium")} v={`${usd(b.night_premium ?? 0)} ${t("(incluido en el precio)", "(included in the price)")}`} />
            )}
            <Detail k={t("Pago", "Payment")} v={paymentText} />
            <Detail
              k={t("Recibido", "Received")}
              v={`${usd(b.amount_paid)}${testPaid ? t(" · pago de PRUEBA, no se cobró dinero", " · TEST checkout, no money was charged") : ""}`}
            />
          </DetailList>
        </Card>
      </div>

      {/* Team edits where and when the trip starts (2026-11-12). Not on cancelled / completed bookings. */}
      {canEditPlaces(b.status) && (b.service_type === "transfer" || b.service_type === "day_tour") && (
        <div id="edit-trip" className="scroll-mt-20">
          <Card title={b.service_type === "transfer" ? t("Cambiar recogida, destino y hora", "Change pickup, drop-off and time") : t("Cambiar lugar y hora de recogida", "Change pickup place and time")}>
            <p className="mb-4 text-sm text-[#5F6F67]">
              {t(
                "Primero revise: verá qué cambia y el precio con la ruta nueva. El precio solo cambia si elige «Usar el precio nuevo». Todo queda en el historial con su nombre.",
                "Review first: you'll see what changes and the price with the new route. The price only changes if you pick \"Use the new price\". Everything is recorded in the history with your name.",
              )}
            </p>
            <EditTripCard
              bookingId={b.id}
              kind={b.service_type}
              lang={lang}
              today={today}
              hubs={HUBS.map((h) => ({ id: h.id, name: placeNameFor(h.name, lang) }))}
              origin={storedRidePlace(b.origin, b.origin_coords)}
              destination={storedRidePlace(b.destination, b.destination_coords)}
              date={scheduledParts(b.scheduled_at)?.ymd ?? today}
              time={scheduledParts(b.scheduled_at)?.time ?? "09:00"}
              notes={b.flight_or_hotel_notes ?? ""}
              driverNotes={b.driver_notes ?? ""}
              pickupPlace={b.pickup_place ?? ""}
            />
          </Card>
        </div>
      )}

      {posting && (
        <Card title={t("Publicación en la bolsa de trabajos", "Job board posting")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-1 text-sm">
              <p className="font-extrabold text-[#14231C]">{postingLabel(posting, openOffers, postingMinutesLeft(b, now), lang)}</p>
              <p className="text-[#5F6F67]">
                {posting === "open"
                  ? t(
                      `Los conductores la ven y pueden ofertar hasta ${formatScheduledAt(b.posting_closes_at ?? null, lang)}. Cada publicación dura ${POSTING_WINDOW_MINUTES} minutos.`,
                      `Drivers see it and can offer until ${formatScheduledAt(b.posting_closes_at ?? null, lang)}. Each posting lasts ${POSTING_WINDOW_MINUTES} minutes.`,
                    )
                  : t(
                      "Ya no está en la bolsa de trabajos y los conductores no pueden ofertar. Todavía necesita conductor: acepte una de las ofertas recibidas, asígnelo a mano o vuelva a publicarla por otra hora (se avisa de nuevo a los conductores).",
                      "It's off the job board and drivers can't offer. It still needs a driver: accept one of the offers received, assign one by hand, or post it again for another hour (drivers are alerted again).",
                    )}
              </p>
              <p className="text-xs text-[#5F6F67]">
                {b.auto_reposted_at
                  ? t(
                      `Se volvió a publicar sola ${AUTO_REPOST_HOURS} h antes de la recogida (${formatScheduledAt(b.auto_reposted_at, lang)}).`,
                      `Posted again automatically ${AUTO_REPOST_HOURS} h before pickup (${formatScheduledAt(b.auto_reposted_at, lang)}).`,
                    )
                  : t(
                      `Si sigue sin conductor ${AUTO_REPOST_HOURS} h antes de la recogida, se vuelve a publicar sola una vez (no de 9 p. m. a 7 a. m.).`,
                      `If it still has no driver ${AUTO_REPOST_HOURS} h before pickup, it is posted again automatically once (not 9 PM–7 AM).`,
                    )}
              </p>
            </div>
            {canRepost(b, now) && (
              <AdminActionForm
                action={repostJob}
                lang={lang}
                submitLabel={t("Volver a publicar", "Repost")}
                savedLabel={t("Publicada", "Posted")}
                confirm={[
                  {
                    kind: "always",
                    message: t(
                      `La reserva vuelve a la bolsa de trabajos por ${POSTING_WINDOW_MINUTES} minutos y se avisa otra vez a los conductores que pueden tomarla. Las ofertas recibidas se mantienen.`,
                      `The booking goes back on the job board for ${POSTING_WINDOW_MINUTES} minutes and the drivers who can take it are alerted again. Offers already received stay.`,
                    ),
                  },
                ]}
                confirmLabel={t("Sí, volver a publicar", "Yes, repost")}
              >
                <input type="hidden" name="booking_id" value={b.id} />
              </AdminActionForm>
            )}
          </div>
        </Card>
      )}

      {(offers ?? []).length > 0 && (
        <Card title={t("Ofertas de los conductores", "Drivers' offers")}>
          <p className="text-xs leading-relaxed text-[#5F6F67]">
            {t(
              `Pago sugerido ${b.driver_payout != null ? usd(b.driver_payout) : "—"}. Ordenadas para usted: primero un conductor con viaje de regreso, luego la mejor calificación (los conductores nuevos cuentan como 4.0), luego los conductores que viven cerca, luego la oferta más baja y luego quien tiene menos viajes con nosotros. Al aceptar una se asigna el conductor, se confirma la reserva y se rechazan las demás. Las ofertas nuevas aparecen solas.`,
              `Suggested payout ${b.driver_payout != null ? usd(b.driver_payout) : "—"}. Sorted for you: a driver with a return trip first, then the better rating (new drivers count as 4.0), then drivers based nearby, then the lower offer, then fewer trips with us. Accepting one assigns the driver, confirms the booking and declines the rest. New offers appear by themselves.`,
            )}
          </p>
          <ul className="mt-3 divide-y divide-[#EDF1EE]">
            {ranked.map(({ o, match, home, trips }) => (
              <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="font-bold text-[#14231C]">
                    {nameOf(o.driver_id)}{" "}
                    <span className="font-semibold text-[#5F6F67]">
                      · {ratingText(o.driver_id)} · {trips} {trips === 1 ? t("viaje", "trip") : t("viajes", "trips")}
                      {homeOf(o.driver_id) ? ` · ${t("vive en", "based in")} ${townName(homeOf(o.driver_id), lang)}` : ""}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {match && <Chip tone="green">{matchText(match)}</Chip>}
                    {!match && home && <Chip tone="blue">{t("Vive cerca de la recogida", "Based near the pickup")}</Chip>}
                    {offerCategoryProblem(o.vehicle_id) && <Chip tone="amber">⚠ {offerCategoryProblem(o.vehicle_id)}</Chip>}
                    {offerIsElectric(o.vehicle_id) ? (
                      <Chip tone="green">
                        ⚡ {t("Vehículo eléctrico", "Electric vehicle")}
                        {askedElectric ? ` · ${t("el viajero lo pidió", "the traveller asked for one")}` : ""}
                      </Chip>
                    ) : (
                      askedElectric && (
                        <Chip tone="amber">⚠ {t("no es eléctrico (el viajero pidió uno, si hay disponible)", "not electric (the traveller asked for one, if available)")}</Chip>
                      )
                    )}
                  </div>
                  <p className="text-[#5F6F67]">
                    {o.vehicle_snapshot?.make_model ?? t("Vehículo", "Vehicle")} {o.vehicle_snapshot?.plate ?? ""}
                    {o.vehicle_snapshot?.seats ? ` · ${o.vehicle_snapshot.seats} ${t("asientos", "seats")}` : ""} · {o.created_at.slice(0, 10)}
                  </p>
                  {o.note && <p className="italic text-[#33443C]">&ldquo;{o.note}&rdquo;</p>}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`text-lg font-extrabold ${Number(o.bid_amount) > Number(b.driver_payout ?? 0) ? "text-[#B45309]" : "text-[#047857]"}`}>
                    {usd(o.bid_amount)}
                  </span>
                  {o.status === "submitted" && b.status === "pending_bids" ? (
                    <AdminActionForm
                      action={acceptOffer}
                      lang={lang}
                      submitLabel={t("Aceptar oferta", "Accept")}
                      savedLabel={t("Aceptada", "Accepted")}
                      confirm={[
                        {
                          kind: "always",
                          message: t(
                            `Se asigna a ${nameOf(o.driver_id)}, la reserva queda confirmada con un pago al conductor de ${usd(o.bid_amount)}, y las demás ofertas se rechazan. El conductor y el viajero reciben un aviso.`,
                            `${nameOf(o.driver_id)} gets the job, the booking is confirmed with a driver payout of ${usd(o.bid_amount)}, and the other offers are declined. The driver and the traveller are notified.`,
                          ),
                        },
                      ]}
                      confirmLabel={t("Sí, aceptar esta oferta", "Yes, accept this offer")}
                    >
                      <input type="hidden" name="bid_id" value={o.id} />
                      <input type="hidden" name="booking_id" value={b.id} />
                    </AdminActionForm>
                  ) : (
                    <Chip tone={o.status === "accepted" ? "green" : "grey"}>{lang === "en" ? o.status : (OFFER_STATUS_ES[o.status] ?? o.status)}</Chip>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div id="dispatch" className="scroll-mt-20">
        <Card title={t("Asignación y estado", "Dispatch & status")}>
          <AdminActionForm
            action={updateBooking}
            lang={lang}
            className="space-y-4"
            confirm={[
              {
                kind: "changed",
                fields: ["amount_paid"],
                message: t("El monto recibido cambiará de {from} a {to} USD.", "The amount received will change from {from} to {to} USD."),
              },
              // Setting, removing or replacing the driver: say who gets a message.
              {
                kind: "changed" as const,
                fields: ["assignment"],
                message: b.assigned_driver_id
                  ? t(
                      "Se quita al conductor actual. Al viajero NO se le avisa del cambio. Si elige otro conductor, el viajero recibe «conductor confirmado» y el nuevo conductor «tiene el viaje» (correo y app). Si deja «Nadie todavía» en una reserva confirmada, vuelve a «Abierta para conductores». Se avisa al equipo por correo; si fue decisión del equipo, el conductor quitado recibe un correo breve de que el viaje fue reasignado.",
                      "The current driver is removed. The traveller is NOT told about the change. If you pick another driver, the traveller gets \"driver confirmed\" and the new driver \"you've got the ride\" (email and app). If you leave \"Nobody yet\" on a confirmed booking, it goes back to \"Open for drivers\". The team is emailed; on a team decision, the removed driver gets a short email that the trip was reassigned.",
                    )
                  : t(
                      "Se asigna el conductor: el viajero recibe «conductor confirmado» y el conductor «tiene el viaje» (correo y app), una vez por asignación.",
                      "The driver is set: the traveller gets \"driver confirmed\" and the driver \"you've got the ride\" (email and app), once per assignment.",
                    ),
              },
            ]}
          >
            <input type="hidden" name="id" value={b.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={field.label}>
                {t("Estado", "Status")}
                <select name="status" defaultValue={b.status} className={field.input}>
                  {/* Cancelling goes through the "Cancelar reserva" card (refund by the policy). */}
                  {BOOKING_STATUSES.filter(([s]) => s !== "cancelled" || b.status === "cancelled").map(([s]) => (
                    <option key={s} value={s}>
                      {bookingStatusLabel(s, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={field.label}>
                {t("Conductor y vehículo", "Driver and vehicle")}
                <select name="assignment" defaultValue={current} className={field.input}>
                  <option value="">{t("Nadie todavía", "Nobody yet")}</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                      {o.problems.length ? ` ⚠ ${o.problems.join(", ")}` : " ✓"}
                    </option>
                  ))}
                </select>
                {categoryMismatch && (
                  <span role="alert" className="mt-2 block rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-2.5 text-sm font-semibold text-[#78350F]">
                    ⚠{" "}
                    {t(
                      `El vehículo asignado (${categoryMismatch.make_model ?? "vehículo"} ${categoryMismatch.plate ?? ""}) es de categoría ${categoryLabel(categoryMismatch.vehicle_class, lang)} y el cliente reservó ${bookedClassName}. Esa categoría no cubre este viaje: confirme que el vehículo sirve o asigne otro.`,
                      `The assigned vehicle (${categoryMismatch.make_model ?? "vehicle"} ${categoryMismatch.plate ?? ""}) is in the ${categoryLabel(categoryMismatch.vehicle_class, lang)} category and the client booked ${bookedClassName}. That category doesn't cover this trip: confirm the vehicle fits or assign another.`,
                    )}
                  </span>
                )}
              </label>
              {b.assigned_driver_id && (
                <label className={field.label}>
                  {t("Si quita o cambia al conductor: ¿por qué?", "If you remove or change the driver: why?")}
                  <select name="removal_reason" defaultValue="" className={field.input}>
                    <option value="">{t("— (no cambio al conductor)", "— (not changing the driver)")}</option>
                    <option value="driver_dropped">{t("El conductor canceló o se retiró", "The driver cancelled or dropped out")}</option>
                    <option value="team">{t("Decisión del equipo", "Team decision")}</option>
                  </select>
                  <span className={field.hint}>{t("Queda en el historial y en la ficha del conductor.", "Recorded in the history and on the driver's scorecard.")}</span>
                </label>
              )}
              <label className={field.label}>
                {t("Monto recibido (USD)", "Amount received (USD)")}
                <input name="amount_paid" inputMode="decimal" defaultValue={b.amount_paid} className={field.input} />
                <span className={field.hint}>{t(`A cobrar en total: ${usd(due)}`, `Total due: ${usd(due)}`)}</span>
              </label>
            </div>
            <label className={field.label}>
              {t("Notas internas (nunca se muestran al cliente ni al conductor)", "Internal notes (never shown to the client or driver)")}
              <textarea name="admin_notes" rows={3} defaultValue={note?.notes ?? ""} className={field.textarea} />
            </label>
          </AdminActionForm>
          {options.length === 0 && (
            <p className="mt-3 text-sm text-[#5F6F67]">
              {t(
                "Todavía no hay conductores aprobados con un vehículo aprobado. Apruébelos en",
                "No approved drivers with an approved vehicle yet. Approve them in",
              )}{" "}
              <Link href="/admin/drivers" className={link}>
                {t("Conductores", "Drivers")}
              </Link>
              .
            </p>
          )}
        </Card>
      </div>

      {/* ================= CRM part 3 (2026-11-12): WhatsApp, name sign, cancel + refund ================= */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div id="whatsapp" className="scroll-mt-20">
          <Card title="WhatsApp">
            {hasWaNumber ? (
              <>
                <p className="mb-3 text-sm text-[#5F6F67]">
                  {t(
                    `Cada botón abre WhatsApp con el mensaje listo, en ${glang === "es" ? "español" : "inglés"} (el idioma de su reserva). Revíselo y presione enviar. Solo para el equipo.`,
                    `Each button opens WhatsApp with the message ready, in ${glang === "es" ? "Spanish" : "English"} (their booking language). Check it and press send. Team only.`,
                  )}
                </p>
                <WhatsAppButtons bookingId={b.id} buttons={waButtons} lang={lang} />
              </>
            ) : (
              <p className="text-sm text-[#5F6F67]">
                {t(
                  "No hay número de WhatsApp para este viajero. Escríbale por el chat del viaje o por correo.",
                  "No WhatsApp number for this traveller. Write to them in the trip chat or by email.",
                )}
              </p>
            )}
          </Card>
        </div>

        {b.service_type === "transfer" && b.status !== "cancelled" && b.status !== "completed" && (
          <Card title={t("Rótulo de recogida (equipo)", "Name sign (team)")}>
            <p className="mb-3 text-sm text-[#5F6F67]">
              {t("Ahora dice:", "It says now:")} <strong className="text-[#14231C]">“{signShown(b, guest.guest_name)}”</strong>.{" "}
              {t(
                "Mismas reglas que para el viajero: hasta 40 caracteres, sin teléfonos, correos ni enlaces. Queda en el historial con su nombre.",
                "Same rules as the traveller's: up to 40 characters, no phone numbers, emails or links. Recorded in the history with your name.",
              )}
            </p>
            <AdminActionForm
              action={setSignByTeam}
              lang={lang}
              className="space-y-3"
              confirm={[
                b.en_route_at
                  ? {
                      kind: "always",
                      message: t(
                        "El conductor ya va en camino: el cambio le llega al actualizar su app. Avísele también por el chat o WhatsApp.",
                        "The driver is already on the way: they see the change when their app refreshes. Tell them in the chat or on WhatsApp too.",
                      ),
                    }
                  : {
                      kind: "changed",
                      fields: ["sign_choice", "sign_text"],
                      message: t("El rótulo cambiará. El viajero y el conductor lo ven en su página y su app.", "The sign will change. The traveller and the driver see it on their page and app."),
                    },
              ]}
            >
              <input type="hidden" name="id" value={b.id} />
              <fieldset className="space-y-1 text-sm">
                <legend className="sr-only">{t("Qué dice el rótulo", "What the sign says")}</legend>
                <label className="flex min-h-10 items-center gap-2">
                  <input type="radio" name="sign_choice" value="name" defaultChecked={!b.sign_text && !b.sign_hide_name} />
                  {t("Nombre e inicial del apellido", "First name + last initial")} ({shortName(guest.guest_name) ?? "—"})
                </label>
                <label className="flex min-h-10 items-center gap-2">
                  <input type="radio" name="sign_choice" value="brand" defaultChecked={Boolean(b.sign_hide_name)} />
                  {t("Sin nombre: la marca", "No name: the brand")}
                </label>
                <label className="flex min-h-10 items-center gap-2">
                  <input type="radio" name="sign_choice" value="text" defaultChecked={Boolean(b.sign_text)} />
                  {t("Este texto:", "This text:")}
                </label>
              </fieldset>
              <input name="sign_text" maxLength={SIGN_MAX} defaultValue={b.sign_text ?? ""} aria-label={t("Texto del rótulo", "Sign text")} className={field.input} />
            </AdminActionForm>
          </Card>
        )}
      </div>

      <div id="cancel" className="scroll-mt-20">
        {b.status !== "cancelled" ? (
          <Card title={t("Cancelar reserva", "Cancel booking")}>
            <CancelBookingForm
              bookingId={b.id}
              bookingRef={b.booking_ref}
              pickupAt={b.scheduled_at}
              pickupText={formatScheduledAt(b.scheduled_at, lang)}
              amountReceived={Number(b.amount_paid ?? 0)}
              hasDriver={Boolean(b.assigned_driver_id)}
              testPaid={testPaid}
              nowLocal={isoToCrLocal(new Date().toISOString())}
              nowIso={new Date().toISOString()}
              lang={lang}
            />
          </Card>
        ) : (
          <Card title={t("Cancelación y reembolso", "Cancellation & refund")}>
            {refund ? (
              <div className="space-y-4">
                <DetailList>
                  <Detail k={t("Cancelada por", "Cancelled by")} v={cancelledByText(refund.cancelled_by, lang)} />
                  <Detail k={t("Cuándo", "When")} v={formatScheduledAt(refund.cancelled_at, lang)} />
                  {refund.asked_at && <Detail k={t("Mensaje del viajero", "Traveller's message")} v={formatScheduledAt(refund.asked_at, lang)} />}
                  <Detail k={t("Recibido", "Received")} v={usd(refund.amount_received)} />
                  <Detail k={t("Según la política", "By the policy")} v={`${usd(refund.refund_policy)} · ${ruleText(refund.refund_rule, lang)}`} />
                  <Detail
                    k={t("Reembolso a deber", "Refund owed")}
                    v={`${usd(refund.refund_due)}${refund.refund_reason ? ` · “${refund.refund_reason}”` : ""}`}
                  />
                  <Detail
                    k={t("Reembolso pagado", "Refund paid")}
                    v={
                      refund.refund_paid_amount
                        ? `${usd(refund.refund_paid_amount)} · ${refund.refund_paid_on} · ${refundMethodText(refund.refund_method ?? "", lang)}`
                        : Number(refund.refund_due) > 0
                          ? t("todavía no", "not yet")
                          : t("nada que devolver", "nothing to return")
                    }
                  />
                </DetailList>
                {Number(refund.refund_due) > 0 && !refund.refund_paid_amount && (
                  <AdminActionForm
                    action={markRefundPaid}
                    lang={lang}
                    className="space-y-3"
                    submitLabel={t("Marcar reembolso como pagado", "Mark refund as paid")}
                    confirm={[{ kind: "changed", fields: ["amount"], message: t("El monto pagado ({to}) es distinto al reembolso a deber ({from}).", "The amount paid ({to}) differs from the refund owed ({from}).") }]}
                  >
                    <input type="hidden" name="id" value={b.id} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className={field.label}>
                        {t("Monto devuelto (USD)", "Amount refunded (USD)")}
                        <input name="amount" inputMode="decimal" defaultValue={Number(refund.refund_due).toFixed(2)} className={field.input} />
                      </label>
                      <label className={field.label}>
                        {t("Fecha", "Date")}
                        <input name="paid_on" type="date" defaultValue={today} max={today} className={field.input} />
                      </label>
                      <label className={field.label}>
                        {t("Medio", "Method")}
                        <select name="method" defaultValue="card" className={field.input}>
                          {REFUND_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {refundMethodText(m, lang)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </AdminActionForm>
                )}
                {refund.refund_paid_amount && (
                  <AdminActionForm
                    action={markRefundPaid}
                    lang={lang}
                    submitLabel={t("Deshacer «pagado»", "Undo \"paid\"")}
                    buttonClassName={btn.secondary}
                    confirm={[{ kind: "always", message: t("El reembolso vuelve a quedar sin pagar.", "The refund goes back to not paid.") }]}
                  >
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="undo" value="1" />
                  </AdminActionForm>
                )}
                <p className="text-xs text-[#5F6F67]">
                  {t(
                    "Los reembolsos con tarjeta aún se hacen a mano (Green Pay no está conectado). Para reabrir la reserva, cambie su estado arriba.",
                    "Card refunds are still done by hand (Green Pay isn't connected). To reopen the booking, change its status above.",
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#5F6F67]">
                {t(
                  "Esta reserva se canceló antes de que existiera la calculadora de reembolsos: no hay reembolso registrado.",
                  "This booking was cancelled before the refund calculator existed: no refund recorded.",
                )}
              </p>
            )}
          </Card>
        )}
      </div>
      {/* ================= end CRM part 3 ================= */}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title={t("Chat del viaje", "Trip chat")}>
          <p className="mb-3 text-sm text-[#5F6F67]">
            {t(
              "Entre el cliente y el conductor asignado; ustedes pueden leerlo y escribir. Cada mensaje les llega como notificación (o por correo). Usted puede compartir números de teléfono aquí; a los clientes y conductores se les ocultan.",
              "Between the traveller and the assigned driver; you can read it and write. Each message reaches them as a notification (or email). You can share phone numbers here; travellers' and drivers' are hidden.",
            )}
          </p>
          {(flagCount ?? 0) > 0 && (
            <div className="mb-3">
              <Notice tone="red">
                {t(
                  `Se ocultaron datos de contacto ${flagCount} ${flagCount === 1 ? "vez" : "veces"} en esta reserva (chat o notas).`,
                  `Contact details were hidden ${flagCount} time${flagCount === 1 ? "" : "s"} on this booking (chat or notes).`,
                )}{" "}
                <Link href="/admin/flagged?all=1" className="font-bold underline">
                  {t("Ver los originales", "See the originals")}
                </Link>
              </Notice>
            </div>
          )}
          <ChatBox bookingId={b.id} viewer={{ kind: "staff" }} allowContactDetails lang={lang} />
        </Card>

        <Card title={t("Historial de cambios", "Change history")}>
          {history.error ? (
            <p className="text-sm text-[#5F6F67]">
              {t(
                "El historial aparece cuando termine la actualización de la base de datos (se aplica sola después de publicar).",
                "The history shows once the database update has finished (it runs by itself after publishing).",
              )}
            </p>
          ) : (
            <>
              <BookingTimeline
                events={events}
                createdAt={b.created_at}
                lang={lang}
                actorName={personName}
                driverName={personName}
                vehicleName={vehicleName}
              />
              <p className="mt-4 text-xs text-[#5F6F67]">
                {t(
                  "Se guarda solo: estado, conductor y vehículo, montos, forma de pago, hora, recogida y destino, notas del viaje, liquidación, rótulo y notas internas. Nunca datos de tarjeta ni mensajes del chat.",
                  "Recorded automatically: status, driver and vehicle, amounts, payment mode, time, pickup and drop-off, trip notes, settlement, name sign and internal notes. Never card data or chat messages.",
                )}
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
