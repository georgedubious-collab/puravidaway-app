import { resolvePlace, rideRoute } from "@/lib/googleMaps";
import { fail, json } from "../shared";

/**
 * GET /api/places/route?from=<id>&to=<id> → road km and drive time for the price.
 * Ids are "hub:SJO" or Google place ids already looked up (served from cache).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const [from, to] = await Promise.all([
      resolvePlace(url.searchParams.get("from") ?? ""),
      resolvePlace(url.searchParams.get("to") ?? ""),
    ]);
    return json({ route: await rideRoute(from, to) });
  } catch (e) {
    return fail(e);
  }
}
