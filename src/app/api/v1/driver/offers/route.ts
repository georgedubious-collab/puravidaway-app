import { offerJob } from "@/app/driver/jobs/actions";
import { formFrom, fromState, signedIn } from "../../shared";

/** POST { booking_id, vehicle_id, amount, note? } → send or change the driver's offer on an open job. */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  return fromState(await offerJob({}, await formFrom(req, ["booking_id", "vehicle_id", "amount", "note"])));
}
