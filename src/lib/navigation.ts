/**
 * "Open in Waze / Google Maps" links for drivers (driver trip page). The driver
 * navigates in the app they already use; we only hand over the destination.
 *
 * Rides booked since 2026-11-09 store each end's map point in
 * bookings.origin_coords / destination_coords. Older rides only have a name: for
 * our towns we use the town's map point, otherwise the apps search the text.
 * Places in Drake Bay are reached by car only as far as the Sierpe dock.
 */
import { HUBS, HUB_IDS, type HubId } from "./catalog";
import { HUB_POINTS, type LatLng } from "./places";

export interface NavTarget {
  /** What the driver sees, e.g. "Arenas Del Mar Resort, Manuel Antonio". */
  label: string;
  /** Map point to drive to, when known. */
  point?: LatLng;
  /** Google place id, so Google Maps opens the exact business. */
  placeId?: string;
  /** Shown under the buttons, e.g. "Drive to the Sierpe dock; the boat continues to Drake Bay." */
  note?: string;
}

const isHub = (v: unknown): v is HubId => typeof v === "string" && (HUB_IDS as readonly string[]).includes(v);

/** Where the car goes for one end of a booked ride. */
export function navTarget(text: string | null, coords: Record<string, unknown> | null): NavTarget | null {
  const label = (text ?? "").trim();
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  const town = coords?.town;
  if (town === "DrakeBay" || (!coords && label === HUBS.find((h) => h.id === "DrakeBay")!.name)) {
    return {
      label,
      point: HUB_POINTS.Sierpe,
      note: "Drive to the Sierpe boat dock; the boat covers the last part to Drake Bay.",
    };
  }
  if (Number.isFinite(lat) && Number.isFinite(lng) && coords) {
    const placeId = typeof coords.place_id === "string" && !coords.place_id.startsWith("hub:") ? coords.place_id : undefined;
    return { label, point: { lat, lng }, placeId };
  }
  // Older bookings: the name of one of our towns, or free text.
  const hub = HUBS.find((h) => h.name === label)?.id;
  if (hub && isHub(hub)) return { label, point: HUB_POINTS[hub] };
  return label ? { label } : null;
}

export function wazeUrl(t: NavTarget): string {
  return t.point
    ? `https://waze.com/ul?ll=${t.point.lat},${t.point.lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(t.label)}&navigate=yes`;
}

export function googleMapsUrl(t: NavTarget): string {
  const q = new URLSearchParams({ api: "1", travelmode: "driving", dir_action: "navigate" });
  q.set("destination", t.point ? `${t.point.lat},${t.point.lng}` : t.label);
  if (t.placeId) q.set("destination_place_id", t.placeId);
  return `https://www.google.com/maps/dir/?${q}`;
}
