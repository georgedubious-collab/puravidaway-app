/**
 * Vehicle photo rules, shared by the website, the app's API and the tests
 * (scripts/test-vehicle-photos.mjs). No imports, so Node can run it directly.
 *
 * The driver app keeps its own copy of the cap (apps/driver/src/upload.ts); the test checks
 * they match. The database allows up to 12 (migration 0006) and refuses a driver's change
 * that leaves an approved vehicle with fewer than 2 (migration 0048).
 */

/** An approved vehicle never has fewer than this many photos. */
export const MIN_VEHICLE_PHOTOS = 2;
/** At most this many photos per vehicle: outside, inside and the luggage space. */
export const MAX_VEHICLE_PHOTOS = 8;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for a file inside this driver's own folder for this vehicle (`<driver>/vehicles/<vehicle>/…`). */
export function isOwnVehiclePath(driverId: string, vehicleId: string, path: string): boolean {
  return UUID.test(vehicleId) && path.startsWith(`${driverId}/vehicles/${vehicleId}/`) && !path.includes("..");
}

export type PhotoChange = { ok: true; photos: string[] } | { ok: false; reason: "missing" | "minimum" };

/** The list without `path`. Refused when the photo isn't on the list, or it would leave an approved vehicle below the minimum. */
export function withoutPhoto(photos: readonly string[], path: string, status: string): PhotoChange {
  if (!photos.includes(path)) return { ok: false, reason: "missing" };
  const next = photos.filter((p) => p !== path);
  if (status === "approved" && next.length < MIN_VEHICLE_PHOTOS) return { ok: false, reason: "minimum" };
  return { ok: true, photos: next };
}

/** The list with `path` moved to the front: the main photo travellers see first. */
export function withMainPhoto(photos: readonly string[], path: string): PhotoChange {
  if (!photos.includes(path)) return { ok: false, reason: "missing" };
  return { ok: true, photos: [path, ...photos.filter((p) => p !== path)] };
}

/**
 * The only files ever signed for a traveller: each assigned driver's profile photo and the
 * assigned vehicle's photos (main photo first, up to the cap). Never documents.
 */
export function travellerPhotoPaths(
  drivers: readonly { documents?: Record<string, string> | null }[],
  vehicles: readonly { photos?: readonly string[] | null }[],
): string[] {
  return [
    ...drivers.map((d) => d.documents?.driver_photo).filter((p): p is string => Boolean(p)),
    ...vehicles.flatMap((v) => (v.photos ?? []).slice(0, MAX_VEHICLE_PHOTOS)),
  ];
}
