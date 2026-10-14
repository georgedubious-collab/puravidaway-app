import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { requireRole } from "@/lib/auth";
import { BOOKING_STATUSES, BOOKING_STATUS_LABEL, SERVICE_LABEL, usd, type BookingRow } from "@/lib/bookings";
import { getCatalog } from "@/lib/catalogSource";
import { todayInCostaRica } from "@/lib/dates";
import { canTakeTrips, type DriverRecord, type VehicleRecord } from "@/lib/driverKyc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateBooking } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type DriverRow = DriverRecord & { profiles: { full_name: string | null } | null; driver_vehicles: VehicleRecord[] };

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("admin", `/admin/bookings/${id}`);
  if (!UUID.test(id)) notFound();
  const supabase = (await createSupabaseServerClient())!;
  const [{ data: b, error }, { data: drivers }, catalog] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", id).maybeSingle<BookingRow>(),
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
  const { data: siblings } = b.trip_id
    ? await supabase.from("bookings").select("id, booking_ref, service_type, scheduled_at").eq("trip_id", b.trip_id).neq("id", b.id)
    : { data: [] };

  const today = todayInCostaRica();
  const seats = b.passenger_count ?? 1;
  // Approved drivers and their approved vehicles that can legally take trips and fit the group.
  const options = (drivers ?? []).flatMap((d) =>
    d.driver_vehicles
      .filter((v) => v.status === "approved")
      .map((v) => ({
        value: `${d.id}:${v.id}`,
        label: `${d.profiles?.full_name ?? "Driver"} — ${v.make_model ?? "vehicle"} ${v.plate ?? ""} (${v.passenger_capacity ?? "?"} seats)`,
        ok: canTakeTrips(d, [v], today) && (v.passenger_capacity ?? 0) >= seats,
      })),
  );
  const current = b.assigned_driver_id && b.assigned_vehicle_id ? `${b.assigned_driver_id}:${b.assigned_vehicle_id}` : "";
  const name =
    b.service_type === "transfer"
      ? `${b.origin} → ${b.destination}`
      : ([...catalog.dayTours, ...catalog.expeditions].find((x) => x.id === b.catalog_item_id)?.name ?? b.catalog_item_id);
  const stops = (b.sightseeing_stops ?? [])
    .map((s) => (s.id === "en_route_upgrade" ? "Smart En-Route Transfer" : (catalog.stops.find((x) => x.id === s.id)?.name ?? s.id)))
    .join(", ");
  const due = b.payment_mode === "deposit_20" ? Math.round(Number(b.total_price) * 20) / 100 : Number(b.total_price);
  const phoneDigits = b.guest_phone?.replace(/\D/g, "") ?? "";
  const field = "mt-1 block w-full min-h-10 rounded-lg border border-slate-300 px-2 font-normal";

  return (
    <div className="space-y-6">
      <Link href="/admin/bookings" className="text-sm font-bold text-emerald-700 underline">
        ← All bookings
      </Link>
      <div>
        <p className="font-mono text-sm font-bold text-slate-500">{b.booking_ref}</p>
        <h1 className="text-2xl font-extrabold text-slate-900">
          {SERVICE_LABEL[b.service_type]}: {name}
        </h1>
        <p className="text-sm text-slate-600">
          {b.scheduled_at?.slice(0, 10)} · {BOOKING_STATUS_LABEL[b.status]} · sent {b.created_at.slice(0, 10)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold text-slate-900">Client</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <Item k="Name" v={b.guest_name} />
            <Item k="Email" v={b.guest_email} />
            <Item k="WhatsApp" v={b.guest_phone} />
            <Item k="Their notes" v={b.client_notes} />
          </dl>
          {phoneDigits && (
            <a
              href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hi ${b.guest_name ?? ""}! This is PuraVidaWay about your trip request ${b.booking_ref}.`)}`}
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
            <Item k="Date" v={b.scheduled_at?.slice(0, 10)} />
            {b.service_type === "transfer" && <Item k="Vehicle class" v={catalog.vehicles.find((v) => v.id === b.vehicle_class)?.name ?? b.vehicle_class} />}
            {b.passenger_count && <Item k="Passengers" v={b.passenger_count} />}
            {stops && <Item k="Stops / extras" v={stops} />}
            {b.lodging_tier && <Item k="Lodging" v={catalog.lodgingTiers.find((t) => t.id === b.lodging_tier)?.name ?? b.lodging_tier} />}
            {b.flight_or_hotel_notes && <Item k="Ride notes" v={b.flight_or_hotel_notes} />}
            <Item k="Price" v={`${usd(b.total_price)}${b.pricing_mode === "bid" ? " (client's offer)" : ""}`} />
            <Item k="Payment" v={b.payment_mode === "deposit_20" ? `20% deposit: ${usd(due)}` : `In full: ${usd(due)}`} />
            <Item k="Received" v={usd(b.amount_paid)} />
          </dl>
        </section>
      </div>

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
                    {o.ok ? "" : " — check documents / seats"}
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
