import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ChatBox } from "@/components/ChatBox";
import { requireRole } from "@/lib/auth";
import { BOOKING_STATUSES, BOOKING_STATUS_LABEL, SERVICE_LABEL, bookingDue, usd, type BookingRow, type OfferRow, type TripContact } from "@/lib/bookings";
import { getCatalog } from "@/lib/catalogSource";
import { formatScheduledAt, scheduledParts, todayInCostaRica } from "@/lib/dates";
import { canTakeTrips, type DriverRecord, type VehicleRecord } from "@/lib/driverKyc";
import { prefMismatches, prefsSummary } from "@/lib/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { compareRanks, nearHome, offerRank, ratingBand, returnMatch, townName, townOf, type ReturnMatch, type TripLike } from "@/lib/matching";
import { acceptOffer, updateBooking } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type DriverRow = DriverRecord & { profiles: { full_name: string | null } | null; driver_vehicles: VehicleRecord[] };

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("admin", `/admin/bookings/${id}`);
  if (!UUID.test(id)) notFound();
  const supabase = (await createSupabaseServerClient())!;
  const [{ data: b, error }, { data: drivers }, catalog] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, trips(guest_name, guest_email, guest_phone)")
      .eq("id", id)
      .maybeSingle<BookingRow & { trips: TripContact | null }>(),
    supabase
      .from("drivers")
      .select("*, profiles!drivers_id_fkey(full_name), driver_vehicles(*)")
      .eq("kyc_status", "approved")
      .returns<DriverRow[]>(),
    getCatalog(),
  ]);
  if (error) return <p className="font-semibold text-red-700">Couldn&apos;t load this booking: {error.message}</p>;
  if (!b) notFound();

  const { data: note } = await supabase.from("booking_admin_notes").select("notes").eq("booking_id", b.id).maybeSingle();
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
  const nameOf = (id: string) => offerNames?.find((p) => p.id === id)?.full_name ?? "Driver";
  type DriverBits = { id: string; home_hub: string | null; rating_avg: number | string | null; rating_count: number | null };
  const bitsOf = (id: string) => (offerHomes as DriverBits[] | null)?.find((d) => d.id === id);
  const homeOf = (id: string) => bitsOf(id)?.home_hub ?? null;
  const ratingText = (id: string) => {
    const d = bitsOf(id);
    return d?.rating_count ? `★ ${Number(d.rating_avg).toFixed(1)} (${d.rating_count})` : "★ new driver";
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
      const match = b.scheduled_at ? returnMatch(job, mine.filter((t) => t.id !== b.id)) : null;
      const home = nearHome(homeOf(o.driver_id), job);
      const bits = bitsOf(o.driver_id);
      const rating = ratingBand(bits?.rating_avg, bits?.rating_count);
      return { o, match, home, trips: mine.length, rank: offerRank({ match, home, trips: mine.length, amount: Number(o.bid_amount), rating }) };
    })
    .sort((x, y) => compareRanks(x.rank, y.rank));
  const matchText = (m: ReturnMatch) =>
    m.kind === "after"
      ? `Return trip: drops off in ${townName(job.origin_town)} ${m.gapMinutes >= 60 ? `${Math.floor(m.gapMinutes / 60)} h` : `${m.gapMinutes} min`} before this pickup (${m.trip.booking_ref ?? ""})`
      : `Leads into their next trip from ${townName(job.destination_town)} (${m.trip.booking_ref ?? ""})`;
  const { data: siblings } = b.trip_id
    ? await supabase.from("bookings").select("id, booking_ref, service_type, scheduled_at").eq("trip_id", b.trip_id).neq("id", b.id)
    : { data: [] };

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
          ...(canTakeTrips(d, [v], today) ? [] : ["documents"]),
          ...(unavailable.has(d.id) ? ["unavailable that day"] : []),
          ...((v.passenger_capacity ?? 0) >= seats ? [] : ["seats"]),
          ...prefMismatches(b.preferences, d, v),
        ];
        return {
          value: `${d.id}:${v.id}`,
          label: `${d.profiles?.full_name ?? "Driver"} — ${v.make_model ?? "vehicle"} ${v.plate ?? ""} (${v.passenger_capacity ?? "?"} seats)`,
          problems,
        };
      }),
  );
  const current = b.assigned_driver_id && b.assigned_vehicle_id ? `${b.assigned_driver_id}:${b.assigned_vehicle_id}` : "";
  const name =
    b.service_type === "transfer"
      ? `${b.origin} → ${b.destination}`
      : ([...catalog.dayTours, ...catalog.expeditions].find((x) => x.id === b.catalog_item_id)?.name ?? b.catalog_item_id);
  const stops = (b.sightseeing_stops ?? [])
    .map((s) => (s.id === "en_route_upgrade" ? "Smart En-Route Transfer" : (catalog.stops.find((x) => x.id === s.id)?.name ?? s.id)))
    .join(", ");
  const cashFee = Number(b.cash_fee ?? 0);
  const due = bookingDue(b);
  const paymentText =
    b.payment_mode === "cash_driver"
      ? `Cash to driver: ${usd(due)} (${usd(b.total_price)} + ${usd(cashFee)} cash booking fee)`
      : b.payment_mode === "deposit_20"
        ? `20% deposit (old request): ${usd(Math.round(Number(b.total_price) * 20) / 100)} of ${usd(b.total_price)}`
        : `Online in full: ${usd(due)} (send the payment link once confirmed)`;
  const guest: TripContact = b.trips ?? { guest_name: null, guest_email: null, guest_phone: null };
  const phoneDigits = guest.guest_phone?.replace(/\D/g, "") ?? "";
  const field = "mt-1 block w-full min-h-10 rounded-lg border border-slate-300 px-2 font-normal";

  return (
    <div className="space-y-6">
      {b.status === "pending_bids" && <LiveRefresh seconds={10} />}
      <Link href="/admin/bookings" className="text-sm font-bold text-emerald-700 underline">
        ← All bookings
      </Link>
      <div>
        <p className="font-mono text-sm font-bold text-slate-500">{b.booking_ref}</p>
        <h1 className="text-2xl font-extrabold text-slate-900">
          {SERVICE_LABEL[b.service_type]}: {name}
        </h1>
        <p className="text-sm text-slate-600">
          {formatScheduledAt(b.scheduled_at)} · {BOOKING_STATUS_LABEL[b.status]} · sent {b.created_at.slice(0, 10)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold text-slate-900">Client</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <Item k="Name" v={guest.guest_name} />
            <Item k="Email" v={guest.guest_email} />
            <Item k="WhatsApp" v={guest.guest_phone} />
            <Item k="Their notes" v={b.client_notes} />
          </dl>
          {phoneDigits && (
            <a
              href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hi ${guest.guest_name ?? ""}! This is Costa Rica Private Transfers about your trip request ${b.booking_ref}.`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white"
            >
              Message on WhatsApp
            </a>
          )}
          {siblings && siblings.length > 0 && (
            <p className="mt-4 text-sm text-slate-600">
              Same trip:{" "}
              {siblings.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", "}
                  <Link href={`/admin/bookings/${s.id}`} className="font-mono font-bold text-emerald-700 underline">
                    {s.booking_ref}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold text-slate-900">Trip</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <Item k="Pickup (Costa Rica time)" v={formatScheduledAt(b.scheduled_at)} />
            {b.service_type === "transfer" && <Item k="Vehicle class" v={catalog.vehicles.find((v) => v.id === b.vehicle_class)?.name ?? b.vehicle_class} />}
            {b.passenger_count && <Item k="Passengers" v={b.passenger_count} />}
            {stops && <Item k="Stops / extras" v={stops} />}
            {b.lodging_tier && <Item k="Lodging" v={catalog.lodgingTiers.find((t) => t.id === b.lodging_tier)?.name ?? b.lodging_tier} />}
            {b.flight_or_hotel_notes && <Item k="Ride notes" v={b.flight_or_hotel_notes} />}
            {prefsSummary(b.preferences).length > 0 && <Item k="Asked for" v={prefsSummary(b.preferences).join(", ")} />}
            {b.driver_payout != null && (
              <Item
                k="Driver payout"
                v={`${usd(b.driver_payout)} (we keep ${usd(b.platform_fee ?? 0)}${
                  Number(b.company_costs ?? 0) > 0
                    ? `, of which ${usd(b.company_costs ?? 0)} pays entrances, lunch and activities: ${usd(Number(b.platform_fee ?? 0) - Number(b.company_costs ?? 0))} net`
                    : ""
                })${b.claimed_at ? " · offer accepted from the job board" : " · suggested"}`}
              />
            )}
            {b.driver_notes && <Item k="Message for driver" v={b.driver_notes} />}
            <Item k="Price" v={`${usd(b.total_price)}${b.pricing_mode === "bid" ? " (client's offer)" : ""}`} />
            <Item k="Payment" v={paymentText} />
            <Item k="Received" v={`${usd(b.amount_paid)}${testPaid ? " · TEST checkout, no money was charged" : ""}`} />
          </dl>
        </section>
      </div>

      {(offers ?? []).length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold text-slate-900">Drivers&apos; offers</h2>
          <p className="mt-1 text-xs text-slate-500">
            Suggested payout {b.driver_payout != null ? usd(b.driver_payout) : "—"}. Sorted for you: a driver with a return trip
            first, then the better rating (new drivers count as 4.0), then drivers based nearby, then the lower offer, then fewer
            trips with us. Accepting one assigns the driver, confirms the booking and declines the rest. New offers appear by themselves.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {ranked.map(({ o, match, home, trips }) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-bold text-slate-900">
                    {nameOf(o.driver_id)}{" "}
                    <span className="font-semibold text-slate-500">
                      · {ratingText(o.driver_id)} · {trips} trip{trips === 1 ? "" : "s"}{homeOf(o.driver_id) ? ` · based in ${townName(homeOf(o.driver_id))}` : ""}
                    </span>
                  </p>
                  {match && (
                    <p className="mt-0.5 inline-block rounded bg-emerald-100 px-1.5 text-xs font-bold text-emerald-900">{matchText(match)}</p>
                  )}
                  {!match && home && (
                    <p className="mt-0.5 inline-block rounded bg-sky-100 px-1.5 text-xs font-bold text-sky-900">Based near the pickup</p>
                  )}
                  <p className="text-slate-600">
                    {o.vehicle_snapshot?.make_model ?? "Vehicle"} {o.vehicle_snapshot?.plate ?? ""}
                    {o.vehicle_snapshot?.seats ? ` · ${o.vehicle_snapshot.seats} seats` : ""} · {o.created_at.slice(0, 10)}
                  </p>
                  {o.note && <p className="text-slate-700 italic">&ldquo;{o.note}&rdquo;</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-extrabold ${Number(o.bid_amount) > Number(b.driver_payout ?? 0) ? "text-amber-700" : "text-emerald-700"}`}>
                    {usd(o.bid_amount)}
                  </span>
                  {o.status === "submitted" && b.status === "pending_bids" ? (
                    <ActionForm action={acceptOffer} submitLabel="Accept" savedLabel="Accepted" className="inline">
                      <input type="hidden" name="bid_id" value={o.id} />
                      <input type="hidden" name="booking_id" value={b.id} />
                    </ActionForm>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{o.status}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-extrabold text-slate-900">Dispatch</h2>
        <ActionForm action={updateBooking} className="mt-3 space-y-4">
          <input type="hidden" name="id" value={b.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              Status
              <select name="status" defaultValue={b.status} className={field}>
                {BOOKING_STATUSES.map(([s, label]) => (
                  <option key={s} value={s}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Driver and vehicle
              <select name="assignment" defaultValue={current} className={field}>
                <option value="">Nobody yet</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                    {o.problems.length ? ` ⚠ ${o.problems.join(", ")}` : " ✓"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Amount received (USD)
              <input name="amount_paid" inputMode="decimal" defaultValue={b.amount_paid} className={field} />
            </label>
          </div>
          <label className="block text-sm font-bold text-slate-700">
            Internal notes (never shown to the client or driver)
            <textarea name="admin_notes" rows={3} defaultValue={note?.notes ?? ""} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-normal" />
          </label>
        </ActionForm>
        {options.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">
            No approved drivers with an approved vehicle yet. Approve them in{" "}
            <Link href="/admin/drivers" className="font-bold text-emerald-700 underline">
              Drivers
            </Link>
            .
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-extrabold text-slate-900">Trip chat</h2>
        <p className="mt-1 mb-3 text-sm text-slate-600">
          With the traveller and, once assigned, the driver. Messages are emailed to them. You can share
          phone numbers here; travellers and drivers can&apos;t.
        </p>
        <ChatBox bookingId={b.id} viewer={{ kind: "staff" }} allowContactDetails />
      </section>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <>
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-semibold text-slate-900 break-words">{v || v === 0 ? v : "—"}</dd>
    </>
  );
}
