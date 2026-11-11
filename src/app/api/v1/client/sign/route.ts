import { saveSign } from "@/app/trip/[token]/actions";
import { formFrom, fromState, signedIn } from "../../shared";

/**
 * POST { token, booking_id, sign_text?, hide_name? } → change what the driver's name sign says
 * (same rules as the trip page: rides only, until the driver is on the way). `hide_name` true =
 * "Don't show my name" (the sign shows our brand name); an empty `sign_text` without it = the
 * traveller's first name + last initial.
 */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  return fromState(await saveSign({}, await formFrom(req, ["token", "booking_id", "sign_text", "hide_name"])));
}
