import { saveVehicle } from "@/app/driver/actions";
import { formFrom, fromState, signedIn, VEHICLE_FIELDS } from "../../../shared";

/** POST { vehicle_id, …fields } → update one of the driver's vehicles. */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  return fromState(await saveVehicle({}, await formFrom(req, ["vehicle_id", ...VEHICLE_FIELDS])));
}
