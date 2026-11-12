import { deleteVehiclePhoto, makeMainVehiclePhoto } from "@/app/driver/actions";
import { fromState, json, signedIn } from "../../shared";

/**
 * POST → change the photos of one of the driver's OWN vehicles:
 *   { action: "remove", vehicle_id, path }  remove a photo (and delete its file)
 *   { action: "main", vehicle_id, path }    make it the main photo (first)
 * Same actions as the website: ownership is checked as the signed-in driver (row-level
 * security), and an approved vehicle never drops below 2 photos.
 */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  if (b.action === "remove") return fromState(await deleteVehiclePhoto(str(b.vehicle_id), str(b.path)));
  if (b.action === "main") return fromState(await makeMainVehiclePhoto(str(b.vehicle_id), str(b.path)));
  return json({ ok: false, error: "Unknown photo action." }, 400);
}
