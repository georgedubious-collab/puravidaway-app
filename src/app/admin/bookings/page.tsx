import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { BOOKING_STATUSES, BOOKING_STATUS_LABEL, SERVICE_LABEL, usd, type BookingRow, type BookingStatus } from "@/lib/bookings";
import { getCatalog } from "@/lib/catalogSource";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OPEN: BookingStatus[] = ["pending_payment", "pending_bids", "confirmed", "in_progress"];

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("admin", "/admin/bookings");
  const { status } = await searchParams;
  const filter = BOOKING_STATUSES.some(([s]) => s === status) ? (status as BookingStatus) : null;

  const supabase = (await createSupabaseServerClient())!;
  let q = supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(300);
  q = filter ? q.eq("status", filter) : q.in("status", OPEN);
  const [{ data, error }, catalog] = await Promise.all([q.returns<BookingRow[]>(), getCatalog()]);
  const itemName = (b: BookingRow) =>
    b.service_type === "transfer"
      ? `${b.origin} → ${b.destination}`
      : ([...catalog.dayTours, ...catalog.expeditions].find((x) => x.id === b.catalog_item_id)?.name ?? b.catalog_item_id);
  if (error) return <p className="font-semibold text-red-700">Couldn&apos;t load bookings: {error.message}</p>;

  // One card per trip request (its items share a trip_id).
  const trips = new Map<string, BookingRow[]>();
  for (const b of data ?? []) {
    const key = b.trip_id ?? b.id;
    trips.set(key, [...(trips.get(key) ?? []), b]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Bookings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Trip requests from the website, newest first. Open a booking to confirm it, assign a driver
          and record payment.
        </p>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2 text-sm font-bold">
        <Chip href="/admin/bookings" on={!filter} label="Open" />
        {BOOKING_STATUSES.map(([s, label]) => (
          <Chip key={s} href={`/admin/bookings?status=${s}`} on={filter === s} label={label} />
        ))}
      </nav>

      {trips.size === 0 && <p className="text-sm text-slate-500">No bookings here yet.</p>}
      <ul className="space-y-3">
        {[...trips.values()].map((items) => {
          const first = items[0];
          const total = items.reduce((n, b) => n + Number(b.total_price), 0);
          return (
            <li key={first.trip_id ?? first.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-extrabold text-slate-900">
                  {first.guest_name ?? "Client"}{" "}
                  <span className="text-sm font-semibold text-slate-500">
                    · {first.guest_phone} · sent {first.created_at.slice(0, 10)}
                  </span>
                </p>
                <p className="text-sm font-bold text-slate-700">
                  {usd(total)} · {first.payment_mode === "deposit_20" ? "20% deposit" : "pays in full"}
                </p>
              </div>
              <ul className="mt-2 divide-y divide-slate-100">
                {items.map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 hover:bg-slate-50">
                      <span className="text-sm">
                        <span className="font-mono font-bold">{b.booking_ref}</span> · {b.scheduled_at?.slice(0, 10)} ·{" "}
                        {SERVICE_LABEL[b.service_type]}{" "}
                        {itemName(b)}
                        {b.pricing_mode === "bid" && <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs font-bold">offer</span>}
                      </span>
                      <span className="text-sm font-semibold">
                        {usd(b.total_price)} ·{" "}
                        <span className={b.assigned_driver_id ? "text-emerald-700" : "text-amber-700"}>
                          {b.assigned_driver_id ? "driver assigned" : "no driver"}
                        </span>{" "}
                        · {BOOKING_STATUS_LABEL[b.status]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Chip({ href, on, label }: { href: string; on: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`rounded-full px-3 py-2 ${on ? "bg-emerald-950 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
    >
      {label}
    </Link>
  );
}
