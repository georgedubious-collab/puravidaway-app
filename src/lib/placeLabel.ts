/**
 * The real town of a typed pickup / drop-off, for labels (Jorge, 2026-11-14).
 *
 * A typed place (a hotel, an address) is saved with `town`, its NEAREST pricing hub
 * (src/lib/places.ts), which keeps pricing, matching and suggestions working. But the hub is
 * not where the place is: a pickup on Puntarenas' Paseo de los Turistas has Monteverde as its
 * nearest hub, so labels built from `town` said "Monteverde → Monteverde". `locality` is the
 * place's own town or city, saved next to `town` when the booking is made (from Google's address
 * components, else read from the address text), and labels prefer it.
 *
 * Shared by the browser and the server; the database mirrors addressLocality() as
 * public.address_locality() (migration 0059) for the job board and the backfill.
 */
import { HUBS } from "./catalog";

export const LOCALITY_MAX = 40;

/** Open Location Code ("X5C9+HMQ"), which Google puts first in addresses without a street number. */
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}$/i;
const POSTAL = /^\d{4,6}$/;
const COUNTRY = /^costa rica$/i;
/** "Provincia de Puntarenas" (Spanish addresses: the town comes right after it). */
const PROVINCIA = /^provincia de\s/i;
/** "Puntarenas Province" (English addresses: the town comes right before it). */
const PROVINCE = /\sprovince$/i;

function usable(s: string | undefined): string | null {
  const v = (s ?? "").replace(/\s+/g, " ").trim();
  if (!v || v.length > LOCALITY_MAX || /\d/.test(v) || PLUS_CODE.test(v) || PROVINCIA.test(v) || PROVINCE.test(v)) return null;
  return v;
}

/**
 * The town in a Costa Rican address as Google writes it, or null when it can't be told safely.
 * "X5C9+HMQ, P.º de los Turistas, Provincia de Puntarenas, Puntarenas, Costa Rica" → "Puntarenas";
 * "…, Provincia de Puntarenas, Manuel Antonio, El Cerro, 60601, Costa Rica" → "Manuel Antonio";
 * "Hotel Tabacón, La Fortuna" → "La Fortuna". A single part (a bare hotel name) gives null, so a
 * label never shows more of the address than a town.
 */
export function addressLocality(text: string | null | undefined): string | null {
  const parts = (text ?? "")
    .split(",")
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p && !COUNTRY.test(p) && !POSTAL.test(p) && !PLUS_CODE.test(p));
  for (let i = parts.length - 1; i >= 0; i--) {
    if (PROVINCIA.test(parts[i])) return usable(parts[i + 1]);
    if (PROVINCE.test(parts[i])) return i > 0 ? usable(parts[i - 1]) : null;
  }
  return parts.length >= 2 ? usable(parts[parts.length - 1]) : null;
}

/** Google Places (New) address components, as requested with the "addressComponents" field. */
export interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

/**
 * The place's town from Google's address components: the locality, else the nearest smaller or
 * larger named area. Never the province (administrative_area_level_1): "Puntarenas" is also the
 * province that Monteverde and Manuel Antonio are in.
 */
const COMPONENT_ORDER = ["locality", "postal_town", "sublocality_level_1", "sublocality", "administrative_area_level_3", "administrative_area_level_2"];
export function localityFromComponents(components: unknown): string | null {
  if (!Array.isArray(components)) return null;
  const list = components as AddressComponent[];
  for (const type of COMPONENT_ORDER) {
    const c = list.find((x) => Array.isArray(x?.types) && x.types.includes(type));
    const v = usable(c?.longText ?? c?.shortText);
    if (v) return v;
  }
  return null;
}

/**
 * The real town of one saved end of a ride, or null for one of our towns (its own name is the
 * label) and for rides saved without a map point. Uses the saved `locality`, else reads it from
 * the saved address text (rides saved before 2026-11-14).
 */
export function placeLocality(text: string | null | undefined, coords: Record<string, unknown> | null | undefined): string | null {
  if (!coords) return null;
  const id = typeof coords.place_id === "string" ? coords.place_id : "";
  if (!id || id.startsWith("hub:")) return null;
  const saved = typeof coords.locality === "string" ? usable(coords.locality) : null;
  return saved ?? addressLocality(text);
}

const HUB_NAMES = new Map(HUBS.map((h) => [h.id as string, h.name]));

/**
 * A short label for one end of a ride: the place's real town when it is a typed place, else our
 * town's name (`hubName`, so each screen keeps its own wording and language), else the saved text.
 * Puntarenas (Paseo de los Turistas) → Santa Elena hotel gives "Puntarenas" and "Monteverde".
 */
export function placeShortName(
  text: string | null | undefined,
  coords: Record<string, unknown> | null | undefined,
  hubName: (id: string) => string | null | undefined = (id) => HUB_NAMES.get(id),
): string {
  const locality = placeLocality(text, coords);
  if (locality) return locality;
  const town = typeof coords?.town === "string" ? coords.town : null;
  return (town ? hubName(town) : null) ?? (text?.trim() || "—");
}
