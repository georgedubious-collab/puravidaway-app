import { saveDriverProfile } from "@/app/driver/actions";
import { formFrom, fromState, signedIn } from "../../shared";

/** POST { bio, english_level } → what travellers see about the driver. */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  return fromState(await saveDriverProfile({}, await formFrom(req, ["bio", "english_level"])));
}
