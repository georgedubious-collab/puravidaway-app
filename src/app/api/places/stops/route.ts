import { getCatalog } from "@/lib/catalogSource";
import { isGooglePlaceId } from "@/lib/places";
import { resolveCustomStops, resolvePlace } from "@/lib/googleMaps";
import { fail, json } from "../shared";

/**
 * GET /api/places/stops?from=<id>&to=<id>&stops=<id>,<id> → what each of the traveller's own
 * stops adds to the drive (src/lib/customStops.ts): [{ id, detourKm, detourMin }] in the same
 * order, for the price shown on the website. Ids are "hub:SJO" or Google place ids already
 * looked up by the place search (served from cache); routes are cached for 30 days. More stops
 * than the limit, a far-off place or a stop only a boat reaches come back as a readable error.
 * The server works all of this out again when the trip is sent.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get("stops") ?? "").split(",").filter(Boolean).slice(0, 10);
  if (ids.length === 0) return json({ stops: [] });
  if (!ids.every(isGooglePlaceId)) return json({ error: "That place isn't valid. Please search for it again." }, 400);
  try {
    const [from, to, catalog] = await Promise.all([
      resolvePlace(url.searchParams.get("from") ?? ""),
      resolvePlace(url.searchParams.get("to") ?? ""),
      getCatalog(),
    ]);
    // Minutes at each stop don't change the detour; the page adds them.
    const stops = await resolveCustomStops(from, to, ids.map((id) => ({ id, label: "", minutes: 0 })), catalog.customStopLimits);
    return json({ stops: stops.map((s) => ({ id: s.id, detourKm: s.detourKm, detourMin: s.detourMin })) });
  } catch (e) {
    return fail(e);
  }
}
