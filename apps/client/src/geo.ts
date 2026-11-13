import { TOWNS } from "./format";

/**
 * Map points the app already knows, for drawing pins and a route line. Nothing
 * here is used for prices or drive times: those always come from the server.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Where each of our towns sits (same points as the website, src/lib/places.ts HUB_POINTS). */
export const HUB_POINTS: Record<string, LatLng> = {
  SJO: { lat: 9.9939, lng: -84.2088 },
  LIR: { lat: 10.5933, lng: -85.5444 },
  Arenal: { lat: 10.4714, lng: -84.6453 },
  ManuelAntonio: { lat: 9.4075, lng: -84.1555 },
  Monteverde: { lat: 10.3126, lng: -84.8252 },
  Sierpe: { lat: 8.8593, lng: -83.4725 },
  DrakeBay: { lat: 8.6948, lng: -83.6683 },
  PuertoViejo: { lat: 9.6559, lng: -82.7544 },
  Tamarindo: { lat: 10.2993, lng: -85.8371 },
  PuertoJimenez: { lat: 8.5336, lng: -83.3058 },
};

/** The whole country, for a map with nothing (or one pin) on it. */
export const COSTA_RICA = { minLat: 8.0, maxLat: 11.25, minLng: -86.0, maxLng: -82.5 };

/** The map point for a town name as it appears in a trip's title ("La Fortuna / Arenal"). Null for hotels and addresses. */
export function pointForLabel(label: string | null | undefined): LatLng | null {
  const want = (label ?? "").trim().toLowerCase();
  if (!want) return null;
  for (const [id, name] of Object.entries(TOWNS)) {
    if (name.toLowerCase() === want && HUB_POINTS[id]) return HUB_POINTS[id];
  }
  return null;
}

/** "SJO Airport / San José" → "SJO Airport": a short name for a pin label or a tight line. */
export function shortPlace(label: string | null | undefined, max = 24): string {
  const first = (label ?? "").split(" / ")[0].split(",")[0].trim();
  return first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
}

/** One thing on the map. */
export interface MapPoint extends LatLng {
  kind: "pickup" | "dropoff" | "driver";
  /** A short name shown next to the pin. */
  label?: string;
}
