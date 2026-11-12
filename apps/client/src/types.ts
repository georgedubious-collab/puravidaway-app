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
  /** `electric`: our team marked the assigned vehicle as electric. Older servers don't send it. */
  car: { name: string; color: string | null; plate: string | null; seats: number | null; photos: string[]; electric?: boolean } | null;
  myRating: number | null;
  /** Where the driver is, only while they share location for this booking. */
  driverLocation: { lat: number; lng: number; recordedAt: string; etaAt: string | null; lateMin: number | null } | null;
  /** Unread chat messages from the driver or our team. Older servers don't send it. */
  unreadChat?: number;
  /**
   * The driver's name sign (rides only): the traveller's own text, whether they chose "Don't show
   * my name", what the sign will say, and whether it can still be changed (until the driver is on
   * the way). Older servers don't send it.
   */
  sign?: { text: string | null; hideName: boolean; shown: string; editable: boolean } | null;
  /** Day tours: the hotel or address where we pick them up. Older servers don't send it. */
  pickupPlace?: string | null;
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
  /**
   * Night pickups: the premium in percent, the window's hours (Costa Rica time, from startHour up
   * to, not including, endHour) and whether it applies to the pickup time of this quote. When it
   * applies, every vehicle's totalCents already includes it. Older servers don't send it.
   */
  night?: { percent: number; startHour: number; endHour: number; applies: boolean };
  cashFeeBps: number;
  vehicles: {
    id: string;
    name: string;
    /** Example models ("Toyota Prado"), shown as "... or similar". Older servers don't send it. */
    exampleModels?: string;
    badge: string;
    maxPax: number;
    luggage: string;
    allowsStops: boolean;
    spanishSpeakingDriver: boolean;
    totalCents: number;
    /** Night-pickup premium inside totalCents (0 by day). Older servers don't send it. */
    nightCents?: number;
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
  /** Booster seats for older children. */
  boosters?: number;
  pets: boolean;
  /** "Electric vehicle, if available": a free request, never a guarantee. Older servers ignore it. */
  electric?: boolean;
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
