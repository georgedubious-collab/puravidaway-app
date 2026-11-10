/** Our towns, as on the website (ids come from the database). */
export const TOWNS: Record<string, string> = {
  SJO: "SJO Airport / San José",
  LIR: "Liberia Airport (LIR)",
  Arenal: "La Fortuna / Arenal",
  ManuelAntonio: "Manuel Antonio",
  Monteverde: "Monteverde",
  Sierpe: "Sierpe Boat Dock",
  DrakeBay: "Drake Bay",
  PuertoViejo: "Puerto Viejo",
  Tamarindo: "Tamarindo",
  SouthNicoya: "Southern Nicoya",
};
export const townName = (id: string | null | undefined) => (id ? (TOWNS[id] ?? id) : "—");

export function usd(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CR_OFFSET_MS = 6 * 3600 * 1000;

/** "Wed 2 Dec · 2:00 PM" in Costa Rica time (UTC−6 all year, no daylight saving). */
export function crDateTime(iso: string | null | undefined): string {
  if (!iso) return "Time to confirm";
  const d = new Date(new Date(iso).getTime() - CR_OFFSET_MS);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const hour = h % 12 === 0 ? 12 : h % 12;
  return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " · " + hour + ":" + m + " " + (h < 12 ? "AM" : "PM");
}

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: "New request",
  pending_bids: "Open for drivers",
  confirmed: "Confirmed",
  in_progress: "On the road",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const plural = (n: number, word: string) => n + " " + word + (n === 1 ? "" : "s");
