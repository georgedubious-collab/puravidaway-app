import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatBox } from "@/components/ChatBox";
import { requireUser } from "@/lib/auth";
import { BOOKING_STATUS_LABEL, SERVICE_LABEL, type BookingRow } from "@/lib/bookings";
import { getCatalog } from "@/lib/catalogSource";
import { addDays, todayInCostaRica } from "@/lib/dates";
import { prefsSummary } from "@/lib/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DriverHeader } from "../../DriverHeader";

export const metadata: Metadata = { title: "Trip | PuraVidaWay Drivers", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function DriverTripPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="flex-1 bg-slate-50">
      <DriverHeader />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Suspense fallback={<p className="text-sm font-semibold text-slate-500">Loading…</p>}>
          <Trip params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Trip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser(`/driver/trips/${id}`);
  if (!UUID.test(id)) notFound();
  const supabase = (await createSupabaseServerClient())!;
  const [{ data: b }, catalog] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", id).eq("assigned_driver_id", me.id).maybeSingle<BookingRow>(),
    getCatalog(),
  ]);
  if (!b) notFound();

  const date = b.scheduled_at?.slice(0, 10) ?? "";
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

  return (
    <div className="space-y-5">
      <Link href="/driver/trips" className="text-sm font-bold text-emerald-700 underline">
        ← Your trips
      </Link>
      <div>
        <p className="font-mono text-sm font-bold text-slate-500">{b.booking_ref}</p>
        <h1 className="text-2xl font-extrabold text-slate-900">{name}</h1>
        <p className="text-sm text-slate-600">
          {date} · {SERVICE_LABEL[b.service_type]} · {BOOKING_STATUS_LABEL[b.status]}
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <Item k="Traveller" v={(b.guest_name ?? "").split(" ")[0] || "—"} />
          <Item k="WhatsApp / phone" v={showPhone ? b.guest_phone : "Shown the day before the trip"} />
          {b.passenger_count && <Item k="Passengers" v={b.passenger_count} />}
          {b.vehicle_class && <Item k="Vehicle class" v={catalog.vehicles.find((v) => v.id === b.vehicle_class)?.name ?? b.vehicle_class} />}
          {stops && <Item k="Stops / extras" v={stops} />}
          {asked.length > 0 && <Item k="Asked for" v={asked.join(", ")} />}
          {b.flight_or_hotel_notes && <Item k="Flight / hotel" v={b.flight_or_hotel_notes} />}
          {b.driver_notes && <Item k="Message for you" v={b.driver_notes} />}
        </dl>
        <p className="mt-3 text-xs text-slate-500">Pickup time and place are confirmed in the chat below.</p>
      </section>

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

function Item({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <>
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-semibold text-slate-900 break-words">{v || v === 0 ? v : "—"}</dd>
    </>
  );
}
