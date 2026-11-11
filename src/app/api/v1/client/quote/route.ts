import { QuoteError, rideQuote } from "@/lib/appQuote";
import { json } from "../../shared";

/**
 * POST { from, to, date, time?, pax, stopIds?, lang? } → vehicles with exact totals, the stops on this
 * route and the route itself. `time` is the pickup time "HH:MM" in Costa Rica time: at night
 * the totals include the night premium (`quote.night`). App builds from before night pickups
 * send no time and get the daytime price, as before (they can't choose a night hour). `from` / `to` are "hub:SJO" or a Google place id from
 * /api/places/suggest + /api/places/lookup. Public, like the website's price display.
 */
export async function POST(req: Request) {
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  try {
    const quote = await rideQuote({
      from: String(b.from ?? ""),
      to: String(b.to ?? ""),
      date: String(b.date ?? ""),
      time: typeof b.time === "string" ? b.time : null,
      pax: Number(b.pax),
      stopIds: Array.isArray(b.stopIds) ? b.stopIds.slice(0, 10).map(String) : [],
      lang: b.lang === "es" ? "es" : "en",
    });
    return json({ ok: true, quote });
  } catch (e) {
    if (e instanceof QuoteError) return json({ ok: false, error: e.message }, 400);
    console.error("[app quote]", e);
    return json({ ok: false, error: "We couldn't price that ride. Please try again." }, 500);
  }
}
