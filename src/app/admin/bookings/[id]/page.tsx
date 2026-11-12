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
import { formatScheduledAt, scheduledParts, todayInCostaRica } from "@/lib/dates";
import { canTakeTrips, type DriverRecord, type VehicleRecord } from "@/lib/driverKyc";
import { prefMismatches, prefsSummary } from "@/lib/preferences";
import { signShown } from "@/lib/sign";
import { categoryLabel, isVehicleCategory, jobClassLabel, vehicleCanServe } from "@/lib/vehicleEligibility";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { compareRanks, nearHome, offerRank, ratingBand, returnMatch, townName, townOf, type ReturnMatch, type TripLike } from "@/lib/matching";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { acceptOffer, updateBooking } from "../actions";

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
      .select("*, trips(guest_name, guest_email, guest_phone, language)")
      .eq("id", id)
      .maybeSingle<BookingRow & { trips: TripContact | null }>(),
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
    .map((s) => (s.id === "en_route_upgrade" ? "Smart En-Route Transfer" : (catalog.stops.find((x) => x.id === s.id)?.name ?? s.id)))
    .join(", ");
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

  const cancelWarning = t(
    `La reserva ${b.booking_ref} quedará cancelada. Nadie recibe un aviso automático: avise al viajero${b.assigned_driver_id ? " y al conductor" : ""}.${
      Number(b.amount_paid) > 0 ? ` Ya se recibieron ${usd(b.amount_paid)}: revise el reembolso.` : ""
    }`,
    `Booking ${b.booking_ref} will be cancelled. Nobody is told automatically: let the traveller${b.assigned_driver_id ? " and the driver" : ""} know.${
      Number(b.amount_paid) > 0 ? ` ${usd(b.amount_paid)} was already received: check the refund.` : ""
    }`,
  );

  return (
    <div className="space-y-5">
      {b.status === "pending_bids" && <LiveRefresh seconds={10} />}
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
            <StatusChip status={b.status} lang={lang} />
            <PaymentChip booking={b} lang={lang} test={testPaid} />
          </span>
        }
        actions={
          <a href="#dispatch" className={btn.primary}>
            {t("Asignar y cambiar estado", "Dispatch & status")}
          </a>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("Cliente", "Client")}>
          <DetailList>
            <Detail k={t("Nombre", "Name")} v={guest.guest_name} />
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
            <a
              href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(
                guest.language === "es"
                  ? `¡Hola ${guest.guest_name ?? ""}! Le escribimos de Costa Rica Private Transfers sobre su solicitud de viaje ${b.booking_ref}.`
                  : `Hi ${guest.guest_name ?? ""}! This is Costa Rica Private Transfers about your trip request ${b.booking_ref}.`,
              )}`}
              target="_blank"
              rel="noreferrer"
              className={`mt-4 ${btn.primary}`}
            >
              {t("Escribir por WhatsApp", "Message on WhatsApp")}
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
                v={`${Math.floor(b.drive_minutes / 60)} h ${String(b.drive_minutes % 60).padStart(2, "0")} min${t(" (sin paradas)", " (without stops)")}`}
              />
            )}
            {stops && <Detail k={t("Paradas / extras", "Stops / extras")} v={stops} />}
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
            {b.driver_notes && <Detail k={t("Mensaje para el conductor", "Message for driver")} v={b.driver_notes} />}
            {b.service_type === "transfer" && (
              <Detail
                k={t("Rótulo", "Name sign")}
                v={`“${signShown(b, guest.guest_name)}” ${
                  b.sign_text
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
              { kind: "equals", field: "status", values: ["cancelled"], unlessInitial: true, message: cancelWarning },
              {
                kind: "changed",
                fields: ["amount_paid"],
                message: t("El monto recibido cambiará de {from} a {to} USD.", "The amount received will change from {from} to {to} USD."),
              },
            ]}
          >
            <input type="hidden" name="id" value={b.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={field.label}>
                {t("Estado", "Status")}
                <select name="status" defaultValue={b.status} className={field.input}>
                  {BOOKING_STATUSES.map(([s]) => (
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
                  "Se guarda solo: estado, conductor y vehículo, montos, forma de pago, hora, liquidación, rótulo y notas internas. Nunca datos de tarjeta ni mensajes del chat.",
                  "Recorded automatically: status, driver and vehicle, amounts, payment mode, time, settlement, name sign and internal notes. Never card data or chat messages.",
                )}
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
