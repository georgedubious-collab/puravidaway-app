import { withdrawOffer } from "@/app/driver/jobs/actions";
import { formFrom, fromState, signedIn } from "../../../shared";

/** POST { bid_id } → take back an open offer. */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  return fromState(await withdrawOffer({}, await formFrom(req, ["bid_id"])));
}
