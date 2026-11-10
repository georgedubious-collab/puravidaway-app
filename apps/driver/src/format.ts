import type { Lang } from "./i18n";

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
/** The same towns in Spanish; ids missing here fall back to the English name. */
const TOWNS_ES: Record<string, string> = {
  SJO: "Aeropuerto SJO / San José",
  LIR: "Aeropuerto de Liberia (LIR)",
  Sierpe: "Muelle de Sierpe",
  DrakeBay: "Bahía Drake",
  SouthNicoya: "Sur de Nicoya",
};
/** All towns as [id, name] in the given language (for choice chips). */
export const townList = (lang: Lang = "es"): [string, string][] => Object.keys(TOWNS).map((id) => [id, townName(id, lang)]);
export const townName = (id: string | null | undefined, lang: Lang = "es") =>
  id ? ((lang === "es" ? TOWNS_ES[id] : undefined) ?? TOWNS[id] ?? id) : "—";

/** A short town name for tight spots (the Profile's "Your base"); the same in both languages except Drake Bay. */
const TOWNS_SHORT: Record<string, string> = { SJO: "San José", LIR: "Liberia", Arenal: "La Fortuna", Sierpe: "Sierpe", SouthNicoya: "Nicoya" };
export const townShort = (id: string | null | undefined, lang: Lang = "es") => (id && TOWNS_SHORT[id]) || townName(id, lang);

export function usd(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

const DAYS = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] };
const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
};
const CR_OFFSET_MS = 6 * 3600 * 1000;

/** "Wed 2 Dec · 2:00 PM" / "Mié 2 dic · 2:00 PM" in Costa Rica time (UTC−6 all year, no daylight saving). */
export function crDateTime(iso: string | null | undefined, lang: Lang = "es"): string {
  if (!iso) return lang === "en" ? "Time to confirm" : "Hora por confirmar";
  const d = new Date(new Date(iso).getTime() - CR_OFFSET_MS);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const hour = h % 12 === 0 ? 12 : h % 12;
  return DAYS[lang][d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[lang][d.getUTCMonth()] + " · " + hour + ":" + m + " " + (h < 12 ? "AM" : "PM");
}

export const STATUS_LABEL: Record<Lang, Record<string, string>> = {
  en: {
    pending_payment: "New request",
    pending_bids: "Open for drivers",
    confirmed: "Confirmed",
    in_progress: "On the road",
    completed: "Completed",
    cancelled: "Cancelled",
  },
  es: {
    pending_payment: "Solicitud nueva",
    pending_bids: "Abierto a conductores",
    confirmed: "Confirmado",
    in_progress: "En ruta",
    completed: "Completado",
    cancelled: "Cancelado",
  },
};

/**
 * "1 pasajero" / "3 pasajeros". Each language gets its own singular and plural, so
 * multi-word Spanish works too: plural(n, ["viaje completado", "viajes completados"], ["completed trip", "completed trips"], lang).
 */
export const plural = (n: number, es: [string, string], en: [string, string], lang: Lang = "es") =>
  n + " " + (lang === "en" ? en : es)[n === 1 ? 0 : 1];
