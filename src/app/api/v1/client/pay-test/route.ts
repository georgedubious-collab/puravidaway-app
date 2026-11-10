import { TRIP_TOKEN } from "@/lib/bookings";
import { payTripForTesting } from "@/lib/testCheckout";
import { json, signedIn } from "../../shared";

/** POST { trip } → TEST checkout: marks the trip's online bookings as paid. No card, no money. Pre-launch only. */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as { trip?: unknown };
  if (typeof b.trip !== "string" || !TRIP_TOKEN.test(b.trip)) return json({ ok: false, error: "We couldn't find that trip." }, 400);
  const res = await payTripForTesting(b.trip, me.email ?? "");
  return json(res, res.ok ? 200 : 400);
}
