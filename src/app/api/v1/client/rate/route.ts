import { rateDriver } from "@/app/trip/[token]/actions";
import { formFrom, fromState, signedIn } from "../../shared";

/** POST { token, booking_id, stars, comment? } → rate the driver of a completed trip (same rules as the trip page). */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  return fromState(await rateDriver({}, await formFrom(req, ["token", "booking_id", "stars", "comment"])));
}
