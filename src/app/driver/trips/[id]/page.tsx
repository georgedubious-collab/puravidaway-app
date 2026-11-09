import type { Metadata } from "next";
import { Navigation } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { ChatBox } from "@/components/ChatBox";
import { setTripStatus } from "../actions";
import { requireUser } from "@/lib/auth";
import { BOOKING_STATUS_LABEL, SERVICE_LABEL, usd, type DriverTrip } from "@/lib/bookings";
import { getCatalog } from "@/lib/catalogSource";
import { addDays, formatScheduledAt, scheduledParts, todayInCostaRica } from "@/lib/dates";
import { googleMapsUrl, navTarget, wazeUrl, type NavTarget } from "@/lib/navigation";
import { prefsSummary } from "@/lib/preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DriverHeader } from "../../DriverHeader";

export const metadata: Metadata = { title: "Trip | PuraVidaWay Drivers", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function DriverTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ claimed?: string }>;
}) {
  return (
    <main className="flex-1 bg-slate-50">
      <DriverHeader />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Suspense fallback={<p className="text-sm font-semibold text-slate-500">Loading…</p>}>
          <Trip params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Trip({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ claimed?: string }> }) {
  const { id } = await params;
  const { claimed } = await searchParams;
  await requireUser(`/driver/trips/${id}`);
  if (!UUID.test(id)) notFound();
  const supabase = (await createSupabaseServerClient())!;
  // my_trips(): only this driver's trips, without the client's price (migration 0017).
  const [{ data: mine }, catalog] = await Promise.all([
    supabase.rpc("my_trips").then((r) => r as { data: DriverTrip[] | null }),
    getCatalog(),
  ]);
  const b = (mine ?? []).find((x) => x.id === id);
  if (!b) notFound();

  // Traveller contact details are server-only: read them here, after the database
  // confirmed (through the driver's own sign-in) that this trip is assigned to them.
  const admin = createSupabaseAdminClient();
  const { data: guest } =
    admin && b.trip_id
      ? await admin.from("trips").select("guest_name, guest_phone").eq("id", b.trip_id).maybeSingle()
      : { data: null };

  // Costa Rica date of the pickup (scheduled_at comes back in UTC).
  const date = scheduledParts(b.scheduled_at)?.ymd ?? "";
  // The traveller's phone shows from the day before the trip, for the pickup itself.
  const showPhone = Boolean(date) && todayInCostaRica() >= addDays(date, -1);
  const name =
    b.service_type === "transfer"
      ? `${b.origin} → ${b.destination}`
      : ([...catalog.dayTours, ...catalog.expeditions].find((x) => x.id === b.catalog_item_id)?.name ?? "Trip");
  const stops = (b.sightseeing_stops ?? [])
    .map((s) => (s.id === "en_route_upgrade" ? "Smart En-Route Transfer" : (catalog.stops.find((x) => x.id === s.id)?.name ?? s.id)))
    .join(", ");
  const asked = prefsSummary(b.preferences);
  const pickup = b.service_type === "transfer" ? navTarget(b.origin, b.origin_coords) : null;
  const dropoff = b.service_type === "transfer" ? navTarget(b.destination, b.destination_coords) : null;

  return (
    <div className="space-y-5">
      <Link href="/driver/trips" className="text-sm font-bold text-emerald-700 underline">
        ← Your trips
      </Link>
      {claimed === "1" && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          This ride is yours. Introduce yourself in the chat below and confirm the pickup time.
        </p>
      )}
      {(b.status === "confirmed" || b.status === "in_progress") && (
        <section className="rounded-xl border-2 border-emerald-600 bg-white p-5">
          <h2 className="font-extrabold text-slate-900">
            {b.status === "confirmed" ? "When your travellers are on board" : "When you've dropped your travellers off"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {b.status === "confirmed"
              ? "Tap this as you set off (available from 3 hours before the pickup time)."
              : "Tap this at the drop-off. The traveller is then asked to rate the trip, and your payout is recorded."}
          </p>
          <ActionForm
            action={setTripStatus}
            submitLabel={b.status === "confirmed" ? "Start trip" : "Complete trip"}
            savedLabel="Done"
            className="mt-3"
          >
            <input type="hidden" name="booking_id" value={b.id} />
            <input type="hidden" name="step" value={b.status === "confirmed" ? "in_progress" : "completed"} />
          </ActionForm>
        </section>
      )}
      <div>
        <p className="font-mono text-sm font-bold text-slate-500">{b.booking_ref}</p>
        <h1 className="text-2xl font-extrabold text-slate-900">{name}</h1>
        <p className="text-sm text-slate-600">
          {formatScheduledAt(b.scheduled_at)} · {SERVICE_LABEL[b.service_type]} · {BOOKING_STATUS_LABEL[b.status]}
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {b.driver_payout != null && <Item k="Your payout" v={usd(b.driver_payout)} />}
          {b.cash_to_collect != null && Number(b.cash_to_collect) > 0 && (
            <Item k="Collect in cash" v={`${usd(b.cash_to_collect)} from the traveller (you keep your payout; the rest is settled weekly)`} />
          )}
          <Item k="Traveller" v={(guest?.guest_name ?? "").split(" ")[0] || "—"} />
          <Item k="WhatsApp / phone" v={showPhone ? guest?.guest_phone : "Shown the day before the trip"} />
          {b.passenger_count && <Item k="Passengers" v={b.passenger_count} />}
          {b.vehicle_class && <Item k="Vehicle class" v={catalog.vehicles.find((v) => v.id === b.vehicle_class)?.name ?? b.vehicle_class} />}
          {stops && <Item k="Stops / extras" v={stops} />}
          {asked.length > 0 && <Item k="Asked for" v={asked.join(", ")} />}
          {b.flight_or_hotel_notes && <Item k="Flight / hotel" v={b.flight_or_hotel_notes} />}
          {b.driver_notes && <Item k="Message for you" v={b.driver_notes} />}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Times are Costa Rica time. The exact pickup place (and any time change) is confirmed in the chat below.
        </p>
      </section>

      {(pickup || dropoff) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-600" aria-hidden /> Navigate
          </h2>
          <p className="mt-1 text-xs text-slate-500">Opens the app on your phone with the place filled in.</p>
          <div className="mt-3 space-y-4">
            {pickup && <NavRow title="To the pickup" t={pickup} />}
            {dropoff && <NavRow title="To the drop-off (once your travellers are on board)" t={dropoff} />}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-extrabold text-slate-900">Chat with the traveller and our team</h2>
        <ChatBox
          bookingId={b.id}
          viewer={{ kind: "staff" }}
          intro="Introduce yourself and confirm the pickup time. Please keep phone numbers and links out of the chat."
        />
      </section>
    </div>
  );
}

function NavRow({ title, t }: { title: string; t: NavTarget }) {
  const btn =
    "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-extrabold transition";
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <p className="text-sm font-semibold text-slate-900 break-words">{t.label}</p>
      {t.note && <p className="text-xs text-amber-800">{t.note}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <a href={wazeUrl(t)} target="_blank" rel="noopener noreferrer" className={`${btn} bg-sky-500 text-white hover:bg-sky-400`}>
          Open in Waze
        </a>
        <a href={googleMapsUrl(t)} target="_blank" rel="noopener noreferrer" className={`${btn} border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50`}>
          Google Maps
        </a>
      </div>
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
