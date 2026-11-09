import { addVehicle } from "@/app/driver/actions";
import { formFrom, fromState, signedIn, VEHICLE_FIELDS } from "../../shared";

/** POST → add a vehicle (plate and make/model required). */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  return fromState(await addVehicle({}, await formFrom(req, VEHICLE_FIELDS)));
}
