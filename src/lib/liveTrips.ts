/**
 * Which trips the "Viajes en vivo" page (/admin/live) shows, and the links into it (2026-11-13).
 * Plain TypeScript, no imports, so `npm run test:dispatch` runs it with Node.
 *
 * A trip is LIVE when it has a driver and is either on the road (in_progress), or confirmed with
 * a pickup in the next 3 hours or the driver already on the way ("Voy en camino"), and the pickup
 * was no more than 12 hours ago. Drivers share their location only inside this window, so this is
 * also when "Ver en el mapa" is offered (Inicio's "Hoy" list, the booking page's bottom bar).
 */

const HOUR = 3600_000;
/** Confirmed trips show this long before pickup. */
export const LIVE_BEFORE_HOURS = 3;
/** …and stop showing this long after pickup (a forgotten "end trip"). */
export const LIVE_AFTER_HOURS = 12;
/** A position older than this is "sin señal reciente". */
export const STALE_LOCATION_MINUTES = 10;

export interface LiveFields {
  status: string;
  scheduled_at: string | null;
  assigned_driver_id: string | null;
  en_route_at?: string | null;
}

export function isLiveTrip(b: LiveFields, nowMs: number): boolean {
  if (!b.assigned_driver_id) return false;
  if (b.status === "in_progress") return true;
  if (b.status !== "confirmed") return false;
  const at = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
  if (!Number.isFinite(at)) return false;
  return (at <= nowMs + LIVE_BEFORE_HOURS * HOUR || Boolean(b.en_route_at)) && at >= nowMs - LIVE_AFTER_HOURS * HOUR;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The live page focused on one booking: centres the map on its driver and opens its details. */
export function liveMapHref(bookingId: string): string {
  return `/admin/live?booking=${encodeURIComponent(bookingId)}`;
}

/**
 * The booking the live page focuses on: the ?booking= id when it is one of the live trips,
 * otherwise the first live trip (or null when there are none). Anything that isn't an id is ignored.
 */
export function liveFocusId(param: string | string[] | undefined, liveIds: readonly string[]): string | null {
  const raw = (Array.isArray(param) ? param[0] : param) ?? "";
  const id = UUID.test(raw) ? raw.toLowerCase() : "";
  if (id && liveIds.includes(id)) return id;
  return liveIds[0] ?? null;
}

/** Whether the last position is too old to trust. */
export function isStaleLocation(recordedAt: string, nowMs: number): boolean {
  const t = new Date(recordedAt).getTime();
  return !Number.isFinite(t) || nowMs - t > STALE_LOCATION_MINUTES * 60000;
}

/** "hace 2 min" / "2 min ago" for a position time. */
export function agoText(iso: string, nowMs: number, lang: "es" | "en"): string {
  const min = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60000));
  if (min < 1) return lang === "en" ? "just now" : "hace un momento";
  if (min < 60) return lang === "en" ? `${min} min ago` : `hace ${min} min`;
  return lang === "en" ? `${Math.floor(min / 60)} h ${min % 60} min ago` : `hace ${Math.floor(min / 60)} h ${min % 60} min`;
}

/**
 * A WhatsApp link to the DRIVER for the team (never shown to travellers or other drivers). The
 * same digits rule as the traveller buttons (waDigits in src/lib/whatsappMessages.ts): digits
 * only, a leading 00 dropped, 7–15 digits.
 */
export function driverWhatsAppHref(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  return d.length >= 7 && d.length <= 15 ? `https://wa.me/${d}` : null;
}

/** An OpenStreetMap embed around one position (the same map the live page already used). */
export function osmEmbedSrc(lat: number, lng: number, delta = 0.02): string {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}&layer=mapnik&marker=${lat},${lng}`;
}
