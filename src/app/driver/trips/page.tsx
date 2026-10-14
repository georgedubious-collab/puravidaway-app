import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { BOOKING_STATUS_LABEL, SERVICE_LABEL, type BookingRow } from "@/lib/bookings";
import { getCatalog } from "@/lib/catalogSource";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DriverHeader } from "../DriverHeader";

export const metadata: Metadata = { title: "Your trips | PuraVidaWay Drivers", robots: { index: false, follow: false } };

export default function DriverTripsPage() {
  return (
    <main className="flex-1 bg-slate-50">
      <DriverHeader />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Suspense fallback={<p className="text-sm font-semibold text-slate-500">Loading…</p>}>
          <Trips />
        </Suspense>
      </div>
    </main>
  );
}

async function Trips() {
  const me = await requireUser("/driver/trips");
  const supabase = (await createSupabaseServerClient())!;
  const [{ data, error }, catalog] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .eq("assigned_driver_id", me.id)
      .order("scheduled_at", { ascending: true })
      .returns<BookingRow[]>(),
    getCatalog(),
  ]);
  if (error) return <p className="font-semibold text-red-700">Couldn&apos;t load your trips. Please reload.</p>;
  const trips = data ?? [];
  const name = (b: BookingRow) =>
    b.service_type === "transfer"
      ? `${b.origin} → ${b.destination}`
      : ([...catalog.dayTours, ...catalog.expeditions].find((x) => x.id === b.catalog_item_id)?.name ?? "Trip");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-900">Your trips</h1>
      {trips.length === 0 ? (
        <p className="text-sm text-slate-600">
          No trips assigned yet. When our team assigns you a ride, it appears here with the
          traveller&apos;s requests and a chat.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {trips.map((b) => (
            <li key={b.id}>
              <Link href={`/driver/trips/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                <span>
                  <span className="block text-xs font-bold text-slate-500">
                    {b.scheduled_at?.slice(0, 10)} · {SERVICE_LABEL[b.service_type]} · <span className="font-mono">{b.booking_ref}</span>
                  </span>
                  <span className="font-bold text-slate-900">{name(b)}</span>
                </span>
                <span className="text-sm font-semibold text-slate-600">{BOOKING_STATUS_LABEL[b.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
