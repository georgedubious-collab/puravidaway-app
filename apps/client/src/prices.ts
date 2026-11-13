import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, type ApiResult } from "./api";
import { TOWNS } from "./format";
import type { Place, RideQuote, Tour } from "./types";

/**
 * Prices always come from the server (POST /client/quote, GET /client/tours).
 * This file only remembers answers while the app is open, so going back and
 * forth between booking steps never asks the same question twice.
 */

/** Today + n days in Costa Rica (UTC−6), as YYYY-MM-DD. */
export const crDatePlus = (n: number) => new Date(Date.now() - 6 * 3600000 + n * 86400000).toISOString().slice(0, 10);
export const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + "T00:00:00Z").getTime());

/** Our towns and airports, offered before anyone types. */
export const HUBS: Place[] = ["SJO", "LIR", "Arenal", "ManuelAntonio", "Monteverde", "Sierpe", "DrakeBay", "PuertoViejo", "Tamarindo", "PuertoJimenez"].map((id) => ({
  id: "hub:" + id,
  label: TOWNS[id],
}));
export const hub = (id: string): Place => ({ id: "hub:" + id, label: TOWNS[id] ?? id });

export { TIMES, isNightTime, nightLabel, type NightRule } from "./night";
export const time12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h % 12 === 0 ? 12 : h % 12) + ":" + String(m).padStart(2, "0") + (h < 12 ? " AM" : " PM");
};

export interface QuoteInput {
  from: string;
  to: string;
  date: string;
  /** Pickup time "HH:MM" (Costa Rica time), so a night pickup is priced with the night premium. Left out for "from" prices. */
  time?: string;
  pax: number;
  stopIds: string[];
  /** The app's language, so names and badges come back in it. */
  lang: "en" | "es";
}

const quotes = new Map<string, RideQuote>();

/** The price of a ride. The request body is exactly what the server expects; good answers are remembered. */
export async function fetchQuote(q: QuoteInput): Promise<ApiResult<{ quote: RideQuote }>> {
  const key = JSON.stringify([q.from, q.to, q.date, q.pax, q.stopIds, q.lang, q.time ?? ""]);
  const hit = quotes.get(key);
  if (hit) return { ok: true, data: { quote: hit } };
  const res = await api<{ quote: RideQuote }>("/client/quote", { from: q.from, to: q.to, date: q.date, ...(q.time ? { time: q.time } : {}), pax: q.pax, stopIds: q.stopIds, lang: q.lang });
  if (res.ok && res.data) quotes.set(key, res.data.quote);
  return res;
}

const tourLists = new Map<string, { tours: Tour[]; cashFeeBps: number }>();

/** The day tours with prices for a date and group size. */
export async function fetchTours(date: string, pax: number, lang: "en" | "es" = "en"): Promise<ApiResult<{ tours: Tour[]; cashFeeBps: number }>> {
  const key = date + "|" + pax + "|" + lang;
  const hit = tourLists.get(key);
  if (hit) return { ok: true, data: hit };
  const res = await api<{ tours: Tour[]; cashFeeBps: number }>("/client/tours?date=" + date + "&pax=" + pax + "&lang=" + lang);
  if (res.ok && res.data) tourLists.set(key, { tours: res.data.tours, cashFeeBps: res.data.cashFeeBps });
  return res;
}

/** The routes whose drive time is shown next to our towns in "Plan your ride" (BookWhere). */
export const POPULAR: { from: string; to: string }[] = [
  { from: "SJO", to: "Arenal" },
  { from: "SJO", to: "ManuelAntonio" },
  { from: "LIR", to: "Tamarindo" },
  { from: "SJO", to: "Monteverde" },
  { from: "SJO", to: "PuertoViejo" },
];

export interface PopularPrice {
  fromCents: number;
  minutes: number;
}

const POPULAR_KEY = "popular-prices-v1";
const POPULAR_MAX_AGE_MS = 12 * 3600 * 1000;

/**
 * "From $X" and the drive time of our most asked-for routes, for the day and
 * group size being planned. Asked one route at a time and kept on the
 * phone for 12 hours, so opening the app doesn't hammer the price server.
 * A route that can't be priced is simply left out.
 */
export async function popularPrices(date: string, pax: number, onUpdate: (prices: Record<string, PopularPrice>) => void): Promise<void> {
  const stamp = date + "|" + pax;
  let known: Record<string, PopularPrice> = {};
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(POPULAR_KEY)) ?? "null") as { stamp: string; at: number; prices: Record<string, PopularPrice> } | null;
    if (saved && saved.stamp === stamp && Date.now() - saved.at < POPULAR_MAX_AGE_MS) known = saved.prices;
  } catch {
    /* start fresh */
  }
  if (Object.keys(known).length) onUpdate({ ...known });
  let changed = false;
  for (const r of POPULAR) {
    const id = r.from + ">" + r.to;
    if (known[id]) continue;
    const res = await fetchQuote({ from: "hub:" + r.from, to: "hub:" + r.to, date, pax, stopIds: [], lang: "en" });
    const cheapest = res.data?.quote.vehicles.reduce((min, v) => Math.min(min, v.totalCents), Infinity);
    if (res.ok && res.data && cheapest !== undefined && Number.isFinite(cheapest)) {
      known[id] = { fromCents: cheapest, minutes: res.data.quote.minutes };
      changed = true;
      onUpdate({ ...known });
    }
  }
  if (changed) AsyncStorage.setItem(POPULAR_KEY, JSON.stringify({ stamp, at: Date.now(), prices: known })).catch(() => {});
}

/** "2 h 45 min" */
export const driveTime = (minutes: number) => ((minutes >= 60 ? Math.floor(minutes / 60) + " h " : "") + (minutes % 60 ? (minutes % 60) + " min" : "")).trim();

/** One vehicle type as the home screen lists it: what it is and who fits. Never a price (that needs a route). */
export type VehicleClass = Pick<RideQuote["vehicles"][number], "id" | "name" | "exampleModels" | "badge" | "maxPax" | "luggage">;

const CLASSES_KEY = "vehicle-classes-v1";
const CLASSES_MAX_AGE_MS = 12 * 3600 * 1000;
/** The ride whose price answer the list is read from: every vehicle type offered on an ordinary route comes back with it. */
const CLASSES_ROUTE = { from: "hub:SJO", to: "hub:Arenal" };

/**
 * Our vehicle types for the home screen ("Choose your ride"), in the app's
 * language. There is no separate list to keep in step: they are read from the
 * server's price answer for one ordinary ride (one traveller, so no type is
 * left out for being too small) and kept on the phone for 12 hours per
 * language. Null when the server can't be reached and nothing is saved.
 */
export async function vehicleClasses(lang: "en" | "es"): Promise<VehicleClass[] | null> {
  type Saved = Partial<Record<"en" | "es", { at: number; list: VehicleClass[] }>>;
  let saved: Saved = {};
  try {
    saved = (JSON.parse((await AsyncStorage.getItem(CLASSES_KEY)) ?? "null") as Saved | null) ?? {};
  } catch {
    /* start fresh */
  }
  const hit = saved[lang];
  const usable = hit && Array.isArray(hit.list) && hit.list.length ? hit : null;
  if (usable && Date.now() - usable.at < CLASSES_MAX_AGE_MS) return usable.list;
  const res = await fetchQuote({ ...CLASSES_ROUTE, date: crDatePlus(14), pax: 1, stopIds: [], lang });
  const list = res.data?.quote.vehicles.map(({ id, name, exampleModels, badge, maxPax, luggage }) => ({ id, name, exampleModels, badge, maxPax, luggage }));
  // Offline or the server said no: an older saved list is better than none.
  if (!res.ok || !list || !list.length) return usable ? usable.list : null;
  AsyncStorage.setItem(CLASSES_KEY, JSON.stringify({ ...saved, [lang]: { at: Date.now(), list } })).catch(() => {});
  return list;
}
