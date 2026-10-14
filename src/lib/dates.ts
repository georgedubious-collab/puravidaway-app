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
