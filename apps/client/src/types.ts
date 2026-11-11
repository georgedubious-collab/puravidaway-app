import type { Lang } from "./i18n";

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
  /** Unread chat messages from the driver or our team. Older servers don't send it. */
  unreadChat?: number;
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

/** What GET / POST /api/v1/chat/<booking> answer (src/app/chat/actions.ts on the website). */
export interface ChatAnswer {
  messages: ChatMessage[];
  /** False once the chat is read-only (48 hours after the trip, or cancelled). Older servers don't send it. */
  open?: boolean;
  closedNote?: string;
  /** Set when the server hid contact details from the message just sent. */
  notice?: string;
  /** The team's phone / WhatsApp number (digits). */
  support?: string;
}

/** What travellers see for each booking status. */
export const TRAVELLER_STATUS: Record<Lang, Record<string, string>> = {
  en: {
    pending_payment: "Request received · we're confirming availability",
    pending_bids: "Finding your driver",
    confirmed: "Confirmed",
    in_progress: "On the road",
    completed: "Completed",
    cancelled: "Cancelled",
  },
  es: {
    pending_payment: "Solicitud recibida · estamos confirmando la disponibilidad",
    pending_bids: "Buscando su conductor",
    confirmed: "Confirmado",
    in_progress: "En ruta",
    completed: "Completado",
    cancelled: "Cancelado",
  },
};

/* Shapes returned by the website's /api/v1/client/quote and /tours (src/lib/appQuote.ts). */
export interface Place {
  id: string;
  label: string;
  /** The map point the place search gave (typed places only). Only used to draw the map; the server looks the place up again for prices. */
  lat?: number;
  lng?: number;
}
export interface RideQuote {
  base: Record<string, unknown>;
  originLabel: string;
  destinationLabel: string;
  airportPickup: boolean;
  minutes: number;
  km: number | null;
  ferries: number;
  season: { name: string; percent: number };
  cashFeeBps: number;
  /** Lowest "Driver bids" offer. Older servers don't send it. */
  minOfferCents?: number;
  vehicles: {
    id: string;
    name: string;
    badge: string;
    maxPax: number;
    luggage: string;
    allowsStops: boolean;
    spanishSpeakingDriver: boolean;
    totalCents: number;
    perPersonCents?: number;
    perPersonShare?: number;
  }[];
  stops: { id: string; name: string; description: string; durationMin: number; cents: number; tourPerPersonCents?: number; entrance: string }[];
}
export interface Tour {
  id: string;
  name: string;
  durationHours: number;
  highlights: string[];
  perPersonCents: number;
  totalCents: number;
  region?: string;
  regionName?: string;
  /** With the Smart En-Route Transfer. Older servers don't send it. */
  totalWithUpgradeCents?: number;
}

/** The driver preferences the website sends (src/lib/preferences.ts RidePrefs). */
export interface Prefs {
  language: "english" | "spanish_ok";
  wifi: boolean;
  stroller: boolean;
  childSeats: number;
  pets: boolean;
}

/** What the traveller has chosen and is about to send. */
export interface Chosen {
  title: string;
  detail: string;
  date: string;
  totalCents: number;
  cashFeeBps: number;
  spec: Record<string, unknown>;
}

/** What the "request sent" screen needs. */
export interface Sent {
  tripToken: string | null;
  payOnline: boolean;
  totalCents: number;
  testCheckout: boolean;
}
