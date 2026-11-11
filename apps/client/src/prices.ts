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
export const HUBS: Place[] = ["SJO", "LIR", "Arenal", "ManuelAntonio", "Monteverde", "Sierpe", "DrakeBay", "PuertoViejo", "Tamarindo"].map((id) => ({
  id: "hub:" + id,
  label: TOWNS[id],
}));
export const hub = (id: string): Place => ({ id: "hub:" + id, label: TOWNS[id] ?? id });

/**
 * Pickup times offered: every half hour, around the clock (Jorge, 2026-11-11: pickups at any
 * hour; it was 4:00 AM to 10:00 PM). Night hours cost the night premium, which the server
 * decides and reports in the quote (`quote.night`).
 */
export const TIMES = Array.from({ length: 48 }, (_, i) => {
  const m = i * 30;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
});
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

/** The rides shown on the home screen. `photo` is a name in src/images.ts. */
export const POPULAR: { from: string; to: string; photo: string }[] = [
  { from: "SJO", to: "Arenal", photo: "arenal" },
  { from: "SJO", to: "ManuelAntonio", photo: "manuel-antonio" },
  { from: "LIR", to: "Tamarindo", photo: "tamarindo" },
  { from: "SJO", to: "Monteverde", photo: "monteverde" },
  { from: "SJO", to: "PuertoViejo", photo: "puerto-viejo" },
];

export interface PopularPrice {
  fromCents: number;
  minutes: number;
}

const POPULAR_KEY = "popular-prices-v1";
const POPULAR_MAX_AGE_MS = 12 * 3600 * 1000;

/**
 * "From $X" and the drive time for the home screen's popular rides, for the
 * default date and two travellers. Asked one route at a time and kept on the
 * phone for 12 hours, so opening the app doesn't hammer the price server.
 * A route that can't be priced is simply left out (the card says "See price").
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

/** The night-pickup rule as the server reports it with a quote. */
export type NightRule = { percent: number; startHour: number; endHour: number; applies: boolean };

/**
 * Is this pickup time inside the night window the server reported? From the start hour up to,
 * but not including, the end hour; the window may cross midnight. Only used to mark the hours
 * in the time list: the price itself always comes from the server.
 */
export function isNightTime(time: string, night: NightRule | null | undefined): boolean {
  if (!night || !night.percent || night.startHour === night.endHour) return false;
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + m;
  const start = night.startHour * 60;
  const end = night.endHour * 60;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/** "Night pickup +20%" / "Recogida nocturna +20%". */
export const nightLabel = (night: NightRule, lang: "en" | "es") => (lang === "es" ? "Recogida nocturna +" : "Night pickup +") + night.percent + "%";
