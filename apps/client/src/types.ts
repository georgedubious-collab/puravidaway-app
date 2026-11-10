/** What GET /api/v1/client/trips returns (see src/lib/travellerTrips.ts on the website). */
export interface AppBooking {
  id: string;
  ref: string;
  kind: string;
  title: string;
  scheduledAt: string | null;
  status: string;
  driverOnTheWay: boolean;
  passengers: number | null;
  dueUsd: number;
  paymentMode: string | null;
  cashFeeUsd: number;
  driver: { firstName: string; bio: string | null; english: string | null; ict: boolean; photo: string | null; rating: string | null } | null;
  car: { name: string; color: string | null; plate: string | null; seats: number | null; photos: string[] } | null;
  myRating: number | null;
  /** Where the driver is, only while they share location for this booking. */
  driverLocation: { lat: number; lng: number; recordedAt: string; etaAt: string | null; lateMin: number | null } | null;
}

export interface AppTrip {
  /** The private trip code, needed for the chat and for rating. */
  token: string;
  createdAt: string;
  bookings: AppBooking[];
}

export interface ChatMessage {
  id: string;
  party: "client" | "driver" | "admin";
  name: string;
  text: string;
  at: string;
  mine: boolean;
}

/** What travellers see for each booking status. */
export const TRAVELLER_STATUS: Record<string, string> = {
  pending_payment: "Request received · we're confirming availability",
  pending_bids: "Finding your driver",
  confirmed: "Confirmed",
  in_progress: "On the road",
  completed: "Completed",
  cancelled: "Cancelled",
};
