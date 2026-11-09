import { checkDriverEta } from "@/lib/eta";
import { json, signedIn } from "../../shared";

/**
 * POST → the driver app asks the server to check, from the position the server
 * already has, whether this driver will reach the pickup on time (live traffic).
 * The server throttles it; the answer is only informative for the app.
 */
export async function POST() {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const res = await checkDriverEta(me.id);
  return json({ ok: true, ...res });
}
