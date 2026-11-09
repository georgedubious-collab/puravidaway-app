import { setTripStatus } from "@/app/driver/trips/actions";
import { formFrom, fromState, signedIn } from "../../../shared";

/** POST { booking_id, step: "in_progress" | "completed" } → the driver starts or completes their trip. */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  return fromState(await setTripStatus({}, await formFrom(req, ["booking_id", "step"])));
}
