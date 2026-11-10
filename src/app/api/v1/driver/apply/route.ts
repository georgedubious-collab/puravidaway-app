import { applyAsDriver } from "@/app/driver/actions";
import { formFrom, fromState, signedIn } from "../../shared";

/** POST { full_name, phone, agree: "on" } → start a driver application (same as the website's first step). */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  return fromState(await applyAsDriver({}, await formFrom(req, ["full_name", "phone", "agree"])));
}
