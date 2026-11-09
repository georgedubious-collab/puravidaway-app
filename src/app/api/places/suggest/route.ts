import { mapsEnabled, suggestPlaces } from "@/lib/googleMaps";
import { fail, json, sessionToken } from "../shared";

/** GET /api/places/suggest?q=arenas&session=<uuid> → up to 5 places in Costa Rica. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const session = sessionToken(url.searchParams.get("session"));
  if (!mapsEnabled()) return json({ suggestions: [], disabled: true });
  if (q.length < 3 || q.length > 100 || !session) return json({ suggestions: [] });
  try {
    return json({ suggestions: await suggestPlaces(q, session) });
  } catch (e) {
    return fail(e);
  }
}
