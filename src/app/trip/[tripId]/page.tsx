import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Car, CheckCircle2, Compass, Languages, ShieldCheck } from "lucide-react";
import { ChatBox } from "@/components/ChatBox";
import { SERVICE_LABEL, usd, type BookingRow, type BookingStatus } from "@/lib/bookings";
import { getCatalog } from "@/lib/catalogSource";
import { ENGLISH_LEVEL_LABEL, prefsSummary } from "@/lib/preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Your trip | PuraVidaWay",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What travellers see for each status. */
const TRAVELLER_STATUS: Record<BookingStatus, string> = {
  pending_payment: "Request received · we're confirming availability",
  pending_bids: "Collecting driver offers",
  confirmed: "Confirmed",
  in_progress: "On the road",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface DriverCard {
  firstName: string;
  bio: string | null;
  english: "fluent" | "basic" | null;
  ict: boolean;
  photo: string | null;
}
interface CarCard {
  name: string;
  color: string | null;
  plate: string | null;
  seats: number | null;
  offers: string[];
  photos: string[];
}

/**
 * Private trip page, reached by the link shown after sending a request (the
 * trip id is a long random code). Shows each booking and, once a driver is
 * assigned, their profile and car photos. Read with the server key because
 * travellers don't have accounts; only safe, traveller-facing fields are shown.
 */
export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  await connection();
  const { tripId } = await params;
  if (!UUID.test(tripId)) notFound();
  const db = createSupabaseAdminClient();
  if (!db) notFound();

  const { data: bookings } = await db
    .from("bookings")
    .select("*")
    .eq("trip_id", tripId)
    .order("scheduled_at")
    .returns<BookingRow[]>();
  if (!bookings?.length) notFound();
  const catalog = await getCatalog();

  // Driver + car cards for confirmed bookings only.
  const assigned = bookings.filter(
    (b) => b.assigned_driver_id && b.assigned_vehicle_id && ["confirmed", "in_progress", "completed"].includes(b.status),
  );
  const driverIds = [...new Set(assigned.map((b) => b.assigned_driver_id!))];
  const vehicleIds = [...new Set(assigned.map((b) => b.assigned_vehicle_id!))];
  const [drivers, vehicles] = await Promise.all([
    driverIds.length
      ? db.from("drivers").select("id, bio, english_level, ict_permit_number, documents, profiles!drivers_id_fkey(full_name)").in("id", driverIds)
      : Promise.resolve({ data: [] as never[] }),
    vehicleIds.length
      ? db
          .from("driver_vehicles")
          .select("id, make_model, year, color, plate, passenger_capacity, has_wifi, child_seats, stroller_space, pet_friendly, photos")
          .in("id", vehicleIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  type DriverRow = {
    id: string;
    bio: string | null;
    english_level: "fluent" | "basic" | null;
    ict_permit_number: string | null;
    documents: Record<string, string>;
    profiles: { full_name: string | null } | null;
  };
  type VehicleRow = {
    id: string;
    make_model: string | null;
    year: number | null;
    color: string | null;
    plate: string | null;
    passenger_capacity: number | null;
    has_wifi: boolean;
    child_seats: number;
    stroller_space: boolean;
    pet_friendly: boolean;
    photos: string[];
  };
  const driverRows = (drivers.data ?? []) as unknown as DriverRow[];
  const vehicleRows = (vehicles.data ?? []) as unknown as VehicleRow[];

  // Only the driver's profile photo and the car photos are ever signed for travellers.
  const paths = [
    ...driverRows.map((d) => d.documents?.driver_photo).filter((p): p is string => Boolean(p)),
    ...vehicleRows.flatMap((v) => v.photos ?? []),
  ];
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await db.storage.from("driver-kyc-docs").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  }
  const driverCard = (id: string | null): DriverCard | null => {
    const d = driverRows.find((x) => x.id === id);
    if (!d) return null;
    const photo = d.documents?.driver_photo;
    return {
      firstName: (d.profiles?.full_name ?? "Your driver").split(" ")[0],
      bio: d.bio,
      english: d.english_level,
      ict: Boolean(d.ict_permit_number),
      photo: photo ? (urls[photo] ?? null) : null,
    };
  };
  const carCard = (id: string | null): CarCard | null => {
    const v = vehicleRows.find((x) => x.id === id);
    if (!v) return null;
    return {
      name: [v.make_model, v.year].filter(Boolean).join(" ") || "Vehicle",
      color: v.color,
      plate: v.plate,
      seats: v.passenger_capacity,
      offers: [
        v.has_wifi && "Wi-Fi",
        v.child_seats > 0 && `${v.child_seats} child seat${v.child_seats > 1 ? "s" : ""}`,
        v.stroller_space && "Room for a stroller",
        v.pet_friendly && "Pets welcome",
      ].filter((x): x is string => Boolean(x)),
      photos: (v.photos ?? []).map((p) => urls[p]).filter((u): u is string => Boolean(u)),
    };
  };

  const first = bookings[0];
  const itemName = (b: BookingRow) =>
    b.service_type === "transfer"
      ? `${b.origin} → ${b.destination}`
      : ([...catalog.dayTours, ...catalog.expeditions].find((x) => x.id === b.catalog_item_id)?.name ?? "Trip");

  return (
    <div className="flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950 text-amber-400">
              <Compass className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">PuraVidaWay</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {first.guest_name ? `${first.guest_name.split(" ")[0]}'s trip` : "Your trip"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Keep this page: your driver&apos;s profile and car photos appear here once each ride is confirmed.
          </p>
        </div>

        {bookings.map((b) => {
          const driver = driverCard(b.assigned_driver_id);
          const car = carCard(b.assigned_vehicle_id);
          const asked = prefsSummary(b.preferences);
          const showDriver = driver && car && ["confirmed", "in_progress", "completed"].includes(b.status);
          return (
            <section key={b.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-500">
                    {b.scheduled_at?.slice(0, 10)} · {SERVICE_LABEL[b.service_type]} ·{" "}
                    <span className="font-mono">{b.booking_ref}</span>
                  </p>
                  <h2 className="text-lg font-extrabold text-slate-900">{itemName(b)}</h2>
                  {asked.length > 0 && <p className="text-sm text-slate-600">You asked for: {asked.join(", ")}</p>}
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-emerald-700">{usd(b.total_price)}</p>
                  <p className={`text-xs font-bold ${b.status === "confirmed" ? "text-emerald-700" : "text-slate-500"}`}>
                    {TRAVELLER_STATUS[b.status]}
                  </p>
                </div>
              </div>

              {showDriver ? (
                <div className="grid gap-4 rounded-xl bg-emerald-50 p-4 sm:grid-cols-[96px_1fr]">
                  {driver.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived private link
                    <img src={driver.photo} alt={`${driver.firstName}, your driver`} className="h-24 w-24 rounded-full object-cover" />
                  ) : (
                    <div className="h-24 w-24 rounded-full bg-emerald-200" />
                  )}
                  <div>
                    <p className="flex items-center gap-1.5 font-extrabold text-emerald-950">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {driver.firstName} is your driver
                    </p>
                    <p className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                      {driver.english && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-emerald-900">
                          <Languages className="h-3.5 w-3.5" /> {ENGLISH_LEVEL_LABEL[driver.english]}
                        </span>
                      )}
                      {driver.ict && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-emerald-900">
                          <ShieldCheck className="h-3.5 w-3.5" /> ICT tourist-transport permit
                        </span>
                      )}
                    </p>
                    {driver.bio && <p className="mt-2 whitespace-pre-line text-sm text-emerald-950">{driver.bio}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <p className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-950">
                      <Car className="h-4 w-4" /> {car.name}
                      {car.color && <span className="font-semibold">· {car.color}</span>}
                      {car.plate && <span className="rounded bg-white px-1.5 font-mono text-xs">{car.plate}</span>}
                    </p>
                    {(car.offers.length > 0 || car.seats) && (
                      <p className="mt-1 text-xs text-emerald-900">
                        {[car.seats && `${car.seats} passenger seats`, ...car.offers].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {car.photos.length > 0 && (
                      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {car.photos.map((u) => (
                          <li key={u}>
                            <a href={u} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private link */}
                              <img src={u} alt={`${car.name}`} className="aspect-square w-full rounded-lg object-cover" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                b.status !== "cancelled" && (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    We&apos;re matching you with a hand-picked local driver. Their profile and car photos will show here.
                  </p>
                )
              )}

              {b.status !== "cancelled" && (
                <div>
                  <h3 className="mb-2 text-sm font-extrabold text-slate-900">Chat about this {SERVICE_LABEL[b.service_type].toLowerCase()}</h3>
                  <ChatBox
                    bookingId={b.id}
                    viewer={{ kind: "traveller", tripId }}
                    intro={
                      showDriver
                        ? `Questions for ${driver.firstName} or our team? Write here. We'll email you when someone replies.`
                        : "Questions about this booking? Write here. Our team replies here and we'll email you when we do."
                    }
                  />
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
