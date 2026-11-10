import "server-only";
import { WHATSAPP_NUMBER } from "./catalog";
import { getCatalog } from "./catalogSource";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * A traveller's trips for the customer app. Travellers have no bookings "of
 * their own" in the database (requests are made as guests); the app proves who
 * they are by signing in with the email they booked with, and the server then
 * looks up the trips sent with that email. Only traveller-safe fields are
 * returned, the same ones the private trip page shows: never the driver's
 * documents, phone or payout. The driver's position is included only while
 * they are sharing it for that traveller's own booking.
 */
export interface AppBooking {
  id: string;
  ref: string;
  kind: string;
  title: string;
  scheduledAt: string | null;
  status: string;
  /** "On the way" once the driver has set off for the pickup. */
  driverOnTheWay: boolean;
  passengers: number | null;
  dueUsd: number;
  paymentMode: string | null;
  cashFeeUsd: number;
  driver: { firstName: string; bio: string | null; english: string | null; ict: boolean; photo: string | null; rating: string | null } | null;
  car: { name: string; color: string | null; plate: string | null; seats: number | null; photos: string[] } | null;
  myRating: number | null;
  /**
   * Where the driver is, while they are sharing location for THIS booking (from 3 hours
   * before the pickup, or once on the way, until the trip ends). Null otherwise.
   */
  driverLocation: { lat: number; lng: number; recordedAt: string; etaAt: string | null; lateMin: number | null } | null;
}

export interface AppTrip {
  /** The private trip code: lets the app open the chat and send a rating for this trip. */
  token: string;
  createdAt: string;
  bookings: AppBooking[];
}

export async function tripsForEmail(email: string): Promise<{ trips: AppTrip[]; whatsapp: string }> {
  const out = { trips: [] as AppTrip[], whatsapp: WHATSAPP_NUMBER };
  const db = createSupabaseAdminClient();
  const clean = email.trim().toLowerCase();
  if (!db || !clean) return out;

  const { data: trips } = await db
    .from("trips")
    .select("id, access_token, created_at")
    .ilike("guest_email", clean.replace(/[%_\\]/g, "\\$&"))
    .order("created_at", { ascending: false })
    .limit(30);
  if (!trips?.length) return out;

  const { data: bookings } = await db
    .from("bookings")
    .select(
      "id, trip_id, booking_ref, service_type, catalog_item_id, origin, destination, scheduled_at, status, en_route_at, passenger_count, total_price, cash_fee, amount_paid, payment_mode, assigned_driver_id, assigned_vehicle_id",
    )
    .in("trip_id", trips.map((t) => t.id))
    .order("scheduled_at");
  const rows = bookings ?? [];
  const shown = rows.filter((b) => b.assigned_driver_id && ["confirmed", "in_progress", "completed"].includes(b.status));
  const driverIds = [...new Set(shown.map((b) => b.assigned_driver_id as string))];
  const vehicleIds = [...new Set(shown.map((b) => b.assigned_vehicle_id as string).filter(Boolean))];

  const [locations, drivers, vehicles, reviews, catalog] = await Promise.all([
    driverIds.length
      ? db.from("driver_locations").select("driver_id, booking_id, lat, lng, recorded_at, eta_at, late_min").in("driver_id", driverIds)
      : Promise.resolve({ data: [] }),
    driverIds.length
      ? db.from("drivers").select("id, bio, english_level, ict_permit_number, documents, rating_avg, rating_count, profiles!drivers_id_fkey(full_name)").in("id", driverIds)
      : Promise.resolve({ data: [] }),
    vehicleIds.length
      ? db.from("driver_vehicles").select("id, make_model, year, color, plate, passenger_capacity, photos").in("id", vehicleIds)
      : Promise.resolve({ data: [] }),
    rows.length ? db.from("driver_reviews").select("booking_id, stars").in("booking_id", rows.map((b) => b.id)) : Promise.resolve({ data: [] }),
    getCatalog(),
  ]);
  type D = {
    id: string;
    bio: string | null;
    english_level: string | null;
    ict_permit_number: string | null;
    documents: Record<string, string> | null;
    rating_avg: number | string | null;
    rating_count: number | null;
    profiles: { full_name: string | null } | null;
  };
  type V = { id: string; make_model: string | null; year: number | null; color: string | null; plate: string | null; passenger_capacity: number | null; photos: string[] | null };
  const dRows = (drivers.data ?? []) as unknown as D[];
  const vRows = (vehicles.data ?? []) as unknown as V[];

  // Only the driver's profile photo and the car photos are ever signed for travellers.
  const paths = [
    ...dRows.map((d) => d.documents?.driver_photo).filter((p): p is string => Boolean(p)),
    ...vRows.flatMap((v) => (v.photos ?? []).slice(0, 6)),
  ];
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await db.storage.from("driver-kyc-docs").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  }

  type L = { driver_id: string; booking_id: string | null; lat: number; lng: number; recorded_at: string; eta_at: string | null; late_min: number | null };
  // The position row names the booking it is being shared for, so a traveller only ever
  // sees the driver while that driver is on the way to, or driving, their own trip.
  const locationFor = (bookingId: string, driverId: string | null): AppBooking["driverLocation"] => {
    const l = ((locations.data ?? []) as L[]).find((x) => x.driver_id === driverId && x.booking_id === bookingId);
    return l ? { lat: l.lat, lng: l.lng, recordedAt: l.recorded_at, etaAt: l.eta_at, lateMin: l.late_min } : null;
  };

  const view = (b: (typeof rows)[number]): AppBooking => {
    const visible = shown.includes(b);
    const d = visible ? dRows.find((x) => x.id === b.assigned_driver_id) : undefined;
    const v = visible ? vRows.find((x) => x.id === b.assigned_vehicle_id) : undefined;
    const photo = d?.documents?.driver_photo;
    return {
      id: b.id,
      ref: b.booking_ref,
      kind: b.service_type,
      title:
        b.service_type === "transfer"
          ? `${b.origin ?? ""} → ${b.destination ?? ""}`
          : ([...catalog.dayTours, ...catalog.expeditions].find((x) => x.id === b.catalog_item_id)?.name ?? "Trip"),
      scheduledAt: b.scheduled_at,
      status: b.status,
      driverOnTheWay: b.status === "confirmed" && Boolean(b.en_route_at),
      passengers: b.passenger_count,
      dueUsd: Math.max(0, Math.round((Number(b.total_price) + Number(b.cash_fee ?? 0) - Number(b.amount_paid ?? 0)) * 100) / 100),
      paymentMode: b.payment_mode,
      cashFeeUsd: Number(b.cash_fee ?? 0),
      driver: d
        ? {
            firstName: (d.profiles?.full_name ?? "Your driver").split(" ")[0],
            bio: d.bio,
            english: d.english_level,
            ict: Boolean(d.ict_permit_number),
            photo: photo ? (urls[photo] ?? null) : null,
            rating: d.rating_count ? Number(d.rating_avg).toFixed(1) : null,
          }
        : null,
      car: v
        ? {
            name: [v.make_model, v.year].filter(Boolean).join(" ") || "Vehicle",
            color: v.color,
            plate: v.plate,
            seats: v.passenger_capacity,
            photos: (v.photos ?? []).map((p) => urls[p]).filter((u): u is string => Boolean(u)),
          }
        : null,
      myRating: (reviews.data as { booking_id: string; stars: number }[] | null)?.find((r) => r.booking_id === b.id)?.stars ?? null,
      driverLocation: locationFor(b.id, visible ? (b.assigned_driver_id as string) : null),
    };
  };

  out.trips = trips
    .map((t) => ({ token: t.access_token as string, createdAt: t.created_at as string, bookings: rows.filter((b) => b.trip_id === t.id).map(view) }))
    .filter((t) => t.bookings.length > 0);
  return out;
}
