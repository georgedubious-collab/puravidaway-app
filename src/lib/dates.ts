/**
 * Date helpers that work on plain "YYYY-MM-DD" strings so client components
 * never call `new Date()` during render (which breaks server rendering in
 * Next.js and makes the page blank until JavaScript loads).
 */

export const COSTA_RICA_TZ = "America/Costa_Rica";

/** Today's calendar date in Costa Rica, as YYYY-MM-DD. Server-side only. */
export function todayInCostaRica(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COSTA_RICA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Add whole days to a YYYY-MM-DD string without touching local time zones. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d + days);
  return new Date(t).toISOString().slice(0, 10);
}

export function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
}

/** Rides: pickup time picked in the ride builder (Costa Rica time), 04:00–22:00 every 15 min. */
export const DEFAULT_PICKUP_TIME = "09:00";
/** Day tours and expeditions have no time picker yet: these defaults are stored until the team confirms. */
export const DEFAULT_TOUR_TIME = "07:00";
export const DEFAULT_EXPEDITION_TIME = "06:00";

const HHMM = /^([01]\d|2[0-3]):(00|15|30|45)$/;

/** Strict check for an untrusted pickup time: "HH:MM", quarter hours, 04:00–22:00. */
export function isValidPickupTime(s: unknown): s is string {
  return typeof s === "string" && HHMM.test(s) && s >= "04:00" && s <= "22:00";
}

export const PICKUP_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let m = 4 * 60; m <= 22 * 60; m += 15) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
})();

/**
 * "09:00" → "9:00 AM" ("9:00 a. m." for the Spanish team pages). The 24-hour
 * value is what gets stored.
 */
export function formatTime12h(hhmm: string, lang: "en" | "es" = "en"): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return hhmm;
  const half = lang === "es" ? (h < 12 ? "a. m." : "p. m.") : h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${half}`;
}

/** A Costa Rica date + time as a timestamptz value (Costa Rica is UTC−6 all year, no daylight saving). */
export function costaRicaTimestamp(ymd: string, hhmm: string): string {
  return `${ymd}T${hhmm}:00-06:00`;
}

/** Costa Rica calendar date (YYYY-MM-DD) and time (HH:MM) of a stored timestamp. */
export function scheduledParts(iso: string | null | undefined): { ymd: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COSTA_RICA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return { ymd: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/**
 * A stored timestamp (bookings.scheduled_at comes back in UTC) shown as the
 * Costa Rica date and time, e.g. "2026-11-22 · 9:00 AM". Taking the first 10
 * characters of the UTC value would show the wrong day for evening pickups.
 */
export function formatScheduledAt(iso: string | null | undefined, lang: "en" | "es" = "en"): string {
  const p = scheduledParts(iso);
  return p ? `${p.ymd} · ${formatTime12h(p.time, lang)}` : "";
}

/**
 * A calendar date for travellers in their language: English keeps "2026-11-22"
 * (as in every English email so far); Spanish reads "22 de noviembre de 2026" (es-CR).
 */
export function formatYmdFor(ymd: string, lang: "en" | "es"): string {
  if (lang !== "es" || !isValidYmd(ymd)) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/**
 * formatScheduledAt for travellers (emails, push notifications, the trip page), in
 * Costa Rica time: "2026-11-22 · 9:00 AM" in English, "22 de noviembre de 2026 · 9:00 a. m."
 * in Spanish.
 */
export function formatScheduledAtFor(iso: string | null | undefined, lang: "en" | "es"): string {
  if (lang !== "es") return formatScheduledAt(iso);
  const p = scheduledParts(iso);
  return p ? `${formatYmdFor(p.ymd, "es")} · ${formatTime12h(p.time, "es")}` : "";
}

/** The current time in milliseconds, for server pages that compare against "now" on each request. */
export function nowMs(): number {
  return Date.now();
}

const DOW = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] };
const MON = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
};

/**
 * A calendar date as travellers read it in the booking app: "Mon, Nov 23" in
 * English, "lun, 23 nov" in Spanish. Built by hand (no Intl) so the server and
 * every browser print exactly the same text.
 */
export function formatShortDate(ymd: string, lang: "en" | "es" = "en"): string {
  if (!isValidYmd(ymd)) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return lang === "es" ? `${DOW.es[dow]}, ${d} ${MON.es[m - 1]}` : `${DOW.en[dow]}, ${MON.en[m - 1]} ${d}`;
}
