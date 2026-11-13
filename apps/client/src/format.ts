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
  PuertoJimenez: "Puerto Jiménez",
  SouthNicoya: "Southern Nicoya",
};
/**
 * "Toyota Prado or similar" / "Toyota Prado o similar", or "" when the server sent no
 * example for the vehicle category (older servers never do). The only way example models
 * are shown, so "or similar" is never missing: an example, not a promise of a model.
 * Same rule as orSimilar() in the website's src/lib/catalog.ts.
 */
export function orSimilar(exampleModels: string | null | undefined, lang: Lang = "en"): string {
  const models = (exampleModels ?? "").trim().replace(/[\s,.;]*\b(or|o) similar(es)?\.?$/i, "").trim();
  if (!models) return "";
  return models + (lang === "es" ? " o similar" : " or similar");
}

export const townName = (id: string | null | undefined) => (id ? (TOWNS[id] ?? id) : "—");

export function usd(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

const DAYS = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] };
const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
};
const CR_OFFSET_MS = 6 * 3600 * 1000;

/** "Wed 2 Dec · 2:00 PM" ("mié 2 dic · 2:00 PM") in Costa Rica time (UTC−6 all year, no daylight saving). */
export function crDateTime(iso: string | null | undefined, lang: Lang = "en"): string {
  if (!iso) return lang === "es" ? "Hora por confirmar" : "Time to confirm";
  const d = new Date(new Date(iso).getTime() - CR_OFFSET_MS);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const hour = h % 12 === 0 ? 12 : h % 12;
  return DAYS[lang][d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[lang][d.getUTCMonth()] + " · " + hour + ":" + m + " " + (h < 12 ? "AM" : "PM");
}

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: "New request",
  pending_bids: "Open for drivers",
  confirmed: "Confirmed",
  in_progress: "On the road",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Spanish singular / plural for the words the app counts. */
const ES_WORDS: Record<string, [string, string]> = {
  traveller: ["viajero", "viajeros"],
  stop: ["parada", "paradas"],
  star: ["estrella", "estrellas"],
  seat: ["asiento", "asientos"],
  hour: ["hora", "horas"],
};

/** "1 traveller / 3 travellers", or "1 viajero / 3 viajeros" in Spanish. */
export function plural(n: number, word: string, lang: Lang = "en"): string {
  const es = lang === "es" ? ES_WORDS[word] : undefined;
  if (es) return n + " " + (n === 1 ? es[0] : es[1]);
  return n + " " + word + (n === 1 ? "" : "s");
}
