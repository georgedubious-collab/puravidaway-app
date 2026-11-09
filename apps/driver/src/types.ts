/** Rows returned by the database functions the app calls (see supabase/migrations 0017–0025). */
export interface Job {
  id: string;
  booking_ref: string;
  service_type: string;
  catalog_item_id: string | null;
  origin_town: string | null;
  destination_town: string | null;
  sightseeing_stops: { id: string }[] | null;
  vehicle_class: string | null;
  scheduled_at: string;
  passenger_count: number | null;
  preferences: Record<string, unknown> | null;
  driver_notes: string | null;
  driver_payout: number | string | null;
  my_offer: number | string | null;
  my_offer_status: "submitted" | "accepted" | "declined" | "withdrawn" | null;
  my_offer_id: string | null;
}

export interface Coords {
  lat?: number;
  lng?: number;
  town?: string;
  place_id?: string;
}

export interface Trip {
  id: string;
  booking_ref: string;
  service_type: string;
  catalog_item_id: string | null;
  origin: string | null;
  destination: string | null;
  origin_coords: Coords | null;
  destination_coords: Coords | null;
  sightseeing_stops: { id: string }[] | null;
  vehicle_class: string | null;
  scheduled_at: string | null;
  passenger_count: number | null;
  flight_or_hotel_notes: string | null;
  preferences: Record<string, unknown> | null;
  driver_notes: string | null;
  status: string;
  driver_payout: number | string | null;
  payment_mode: string | null;
  cash_to_collect: number | string | null;
  driver_settled_at: string | null;
  completed_at: string | null;
  /** When the driver tapped "I'm on my way". */
  en_route_at: string | null;
}

export interface Vehicle {
  id: string;
  make_model: string | null;
  plate: string | null;
  passenger_capacity: number | null;
  status: string;
}

export interface DriverInfo {
  kyc_status: string;
  home_hub: string | null;
  rating_avg: number | string | null;
  rating_count: number | null;
  /** Set when the driver agreed to share location around trips. */
  location_consent_at: string | null;
}

/** Names of tours and stops, read once from the public catalog tables. */
export interface Names {
  tours: Record<string, string>;
  stops: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  party: "client" | "driver" | "admin";
  name: string;
  text: string;
  at: string;
  mine: boolean;
}
