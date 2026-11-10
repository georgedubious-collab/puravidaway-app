import { tripsForEmail } from "@/lib/travellerTrips";
import { json, signedIn } from "../../shared";

/** GET → the signed-in traveller's trips (found by the verified email they booked with). */
export async function GET() {
  const me = await signedIn();
  if (me instanceof Response) return me;
  return json({ ok: true, ...(await tripsForEmail(me.email ?? "")) });
}
