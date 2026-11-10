/** Booking statuses as stored in the database, with the words the team sees. */
export const BOOKING_STATUSES = [
  ["pending_payment", "New request · waiting for payment"],
  ["pending_bids", "Open for drivers (job board)"],
  ["confirmed", "Confirmed"],
  ["in_progress", "On the road"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number][0];

export const BOOKING_STATUS_LABEL = Object.fromEntries(BOOKING_STATUSES) as Record<BookingStatus, string>;

export const SERVICE_LABEL: Record<string, string> = {
  transfer: "Ride",
  day_tour: "Day tour",
  expedition: "Expedition",
};

/* Spanish words for the team pages and driver portal (src/lib/teamLang.ts). */
export const BOOKING_STATUS_LABEL_ES: Record<BookingStatus, string> = {
  pending_payment: "Solicitud nueva · esperando el pago",
  pending_bids: "Abierta para conductores (bolsa de trabajos)",
  confirmed: "Confirmado",
  in_progress: "En ruta",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const SERVICE_LABEL_ES: Record<string, string> = {
  transfer: "Traslado",
  day_tour: "Tour de un día",
  expedition: "Expedición",
};

export function bookingStatusLabel(status: string, lang: "en" | "es" = "en"): string {
  const map: Record<string, string> = lang === "es" ? BOOKING_STATUS_LABEL_ES : BOOKING_STATUS_LABEL;
  return map[status] ?? status;
}

export function serviceLabel(type: string, lang: "en" | "es" = "en"): string {
  return (lang === "es" ? SERVICE_LABEL_ES : SERVICE_LABEL)[type] ?? type;
}

export interface BookingRow {
  id: string;
  booking_ref: string;
  trip_id: string | null;
  service_type: string;
  catalog_item_id: string | null;
  origin: string | null;
  destination: string | null;
  /** Map point of each end (rides booked since 2026-11-09): { lat, lng, place_id, town, route? }. */
  origin_coords: Record<string, unknown> | null;
  destination_coords: Record<string, unknown> | null;
  sightseeing_stops: { id: string; price?: number }[];
  vehicle_class: string | null;
  lodging_tier: string | null;
  scheduled_at: string | null;
  passenger_count: number | null;
  flight_or_hotel_notes: string | null;
  pricing_mode: "fixed" | "bid";
  total_price: number;
  currency: string;
  amount_paid: number;
  /** deposit_20: retired 2026-11-08, only on older requests. */
  payment_mode: "full_100" | "cash_driver" | "deposit_20" | null;
  /** Cash booking fee (USD) on cash_driver bookings; 0 otherwise. Missing before migration 0012. */
  cash_fee?: number | string | null;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  status: BookingStatus;
  client_notes: string | null;
  preferences: Partial<import("./preferences").RidePrefs>;
  driver_notes: string | null;
  /** Driver payout and platform share (USD), migration 0017. Null on expeditions (arranged by the team). */
  driver_payout?: number | string | null;
  platform_fee?: number | string | null;
  /** Entrances, lunch, activities the company pays on this booking (migration 0023); part of platform_fee. */
  company_costs?: number | string | null;
  /** Set when the team accepted a driver's offer from the job board. */
  claimed_at?: string | null;
  created_at: string;
}

/** One open job as drivers see it (`driver_jobs()`): town-level route, payout, never the client's price. */
export interface DriverJob {
  id: string;
  booking_ref: string;
  service_type: string;
  catalog_item_id: string | null;
  origin_town: string | null;
  destination_town: string | null;
  sightseeing_stops: { id: string }[];
  vehicle_class: string | null;
  scheduled_at: string;
  passenger_count: number | null;
  preferences: Partial<import("./preferences").RidePrefs>;
  driver_notes: string | null;
  driver_payout: number | string | null;
  created_at: string;
  /** This driver's own offer on the job, if any. */
  my_offer: number | string | null;
  my_offer_status: "submitted" | "accepted" | "declined" | "withdrawn" | null;
  my_offer_id: string | null;
}

/** A driver's offer on a job-board booking (`bids` table). */
export interface OfferRow {
  id: string;
  booking_id: string;
  driver_id: string;
  bid_amount: number | string;
  vehicle_id: string | null;
  vehicle_snapshot: { make_model?: string | null; plate?: string | null; seats?: number | null };
  note: string | null;
  status: "submitted" | "accepted" | "declined" | "withdrawn";
  created_at: string;
}

/** One of the driver's own trips (`my_trips()`): everything needed to drive it, without the client's price. */
export type DriverTrip = Pick<
  BookingRow,
  | "id" | "booking_ref" | "trip_id" | "service_type" | "catalog_item_id" | "origin" | "destination"
  | "origin_coords" | "destination_coords" | "sightseeing_stops" | "vehicle_class" | "scheduled_at"
  | "passenger_count" | "flight_or_hotel_notes" | "preferences" | "driver_notes" | "status"
  | "payment_mode" | "cash_fee" | "assigned_vehicle_id" | "created_at"
> & {
  driver_payout: number | string | null;
  claimed_at: string | null;
  /** Cash trips only: what the driver collects from the traveller (price + cash fee). Migration 0025. */
  cash_to_collect?: number | string | null;
  driver_settled_at?: string | null;
  completed_at?: string | null;
  /** When the driver tapped "I'm on my way" (migration 0029). */
  en_route_at?: string | null;
};

export function usd(n: number | string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));
}

/** What the traveller owes on one booking: price + cash booking fee. */
export function bookingDue(b: Pick<BookingRow, "total_price" | "cash_fee">): number {
  return Math.round((Number(b.total_price) + Number(b.cash_fee ?? 0)) * 100) / 100;
}

/** Short payment label for the team, e.g. "Cash to driver" or "Online in full". */
export function paymentModeLabel(mode: BookingRow["payment_mode"], lang: "en" | "es" = "en"): string {
  const es = lang === "es";
  if (mode === "cash_driver") return es ? "Efectivo al conductor" : "Cash to driver";
  if (mode === "deposit_20") return es ? "Depósito del 20% (solicitud antigua)" : "20% deposit (old request)";
  return es ? "En línea, pago completo" : "Online in full";
}

/** Traveller contact details (server/admin only, never readable by drivers). */
export interface TripContact {
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
}

/** Private trip-page codes: 64 hex characters. */
export const TRIP_TOKEN = /^[0-9a-f]{64}$/;
