import { saveDriverDetails } from "@/app/driver/actions";
import { formFrom, fromState, signedIn } from "../../shared";

/** POST → the driver's personal details (same rules as the website form). */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  return fromState(
    await saveDriverDetails({}, await formFrom(req, ["full_name", "phone", "cedula_number", "license_number", "license_expiry", "criminal_record_date", "ict_permit_number", "home_hub"])),
  );
}
