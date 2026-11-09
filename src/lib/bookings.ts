/** Booking statuses as stored in the database, with the words the team sees. */
export const BOOKING_STATUSES = [
  ["pending_payment", "New request · waiting for payment"],
  ["pending_bids", "Collecting driver offers"],
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

export interface BookingRow {
  id: string;
  booking_ref: string;
  trip_id: string | null;
  service_type: string;
  catalog_item_id: string | null;
  origin: string | null;
  destination: string | null;
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
  created_at: string;
}

export function usd(n: number | string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));
}

/** What the traveller owes on one booking: price + cash booking fee. */
export function bookingDue(b: Pick<BookingRow, "total_price" | "cash_fee">): number {
  return Math.round((Number(b.total_price) + Number(b.cash_fee ?? 0)) * 100) / 100;
}

/** Short payment label for the team, e.g. "Cash to driver" or "Online in full". */
export function paymentModeLabel(mode: BookingRow["payment_mode"]): string {
  if (mode === "cash_driver") return "Cash to driver";
  if (mode === "deposit_20") return "20% deposit (old request)";
  return "Online in full";
}

/** Traveller contact details (server/admin only, never readable by drivers). */
export interface TripContact {
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
}

/** Private trip-page codes: 64 hex characters. */
export const TRIP_TOKEN = /^[0-9a-f]{64}$/;
