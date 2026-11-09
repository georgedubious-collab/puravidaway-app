import { resolvePlace } from "@/lib/googleMaps";
import { fail, json, sessionToken } from "../shared";

/** GET /api/places/lookup?id=<place id>&label=<name>&session=<uuid> → the place with its map point and nearest town. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const place = await resolvePlace(
      url.searchParams.get("id") ?? "",
      url.searchParams.get("label") ?? undefined,
      sessionToken(url.searchParams.get("session")),
    );
    return json({ place });
  } catch (e) {
    return fail(e);
  }
}
