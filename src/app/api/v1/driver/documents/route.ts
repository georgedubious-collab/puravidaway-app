import { addVehiclePhoto, attachDriverDocument, attachVehicleDocument } from "@/app/driver/actions";
import { fromState, json, signedIn } from "../../shared";

/**
 * POST → link a file the app just uploaded to the driver's private folder:
 *   { target: "driver", key, path, renewed? }
 *   { target: "vehicle", vehicle_id, key, path, renewed? }
 *   { target: "photo", vehicle_id, path }
 * The actions check the path is inside the driver's own folder.
 */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const renewed = str(b.renewed) || undefined;
  if (b.target === "driver") return fromState(await attachDriverDocument(str(b.key), str(b.path), renewed));
  if (b.target === "vehicle") return fromState(await attachVehicleDocument(str(b.vehicle_id), str(b.key), str(b.path), renewed));
  if (b.target === "photo") return fromState(await addVehiclePhoto(str(b.vehicle_id), str(b.path)));
  return json({ ok: false, error: "Unknown upload type." }, 400);
}
