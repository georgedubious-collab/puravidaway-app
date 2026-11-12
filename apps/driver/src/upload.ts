import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { api } from "./api";
import { tr } from "./i18n";
import { supabase } from "./supabase";

/** What a file is for: a personal document, a vehicle document, or a vehicle photo. */
export type UploadTarget =
  | { type: "driver"; key: string }
  | { type: "vehicle"; vehicleId: string; key: string }
  | { type: "photo"; vehicleId: string };

const MAX_BYTES = 10 * 1024 * 1024;
/** Same as the website (src/lib/vehiclePhotos.ts); `npm run test:photos` checks they match. */
export const MAX_VEHICLE_PHOTOS = 8;
export const MIN_VEHICLE_PHOTOS = 2;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export type UploadSource = "camera" | "library" | "file";

type Picked = { uri: string; mime?: string };

/** The picked file as a local address and type, or an error, or null when cancelled. */
async function pick(from: UploadSource, allowPdf: boolean): Promise<Picked | string | null> {
  if (from === "file") {
    const res = await DocumentPicker.getDocumentAsync({
      type: allowPdf ? ["application/pdf", "image/*"] : ["image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.length) return null;
    const f = res.assets[0];
    // Some phones don't report the type; fall back to the file name.
    const mime = f.mimeType ?? (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : undefined);
    return { uri: f.uri, mime };
  }
  if (from === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return tr("Permita la cámara en los ajustes del teléfono para tomar una foto.", "Allow the camera in the phone's settings to take a photo.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
  const result = from === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  return { uri: result.assets[0].uri, mime: result.assets[0].mimeType };
}

/**
 * Take a photo, choose one, or pick a file (PDF or image) and attach it. The file goes straight into the
 * driver's private folder in storage; the server then links it to the right
 * document, with the same checks as the website. Returns an error message, or
 * null when it worked or the driver cancelled.
 */
export async function pickAndUpload(userId: string, target: UploadTarget, from: UploadSource, renewed?: string): Promise<string | null> {
  const allowPdf = pdfAllowed(target);
  const asset = await pick(from, allowPdf);
  if (asset === null || typeof asset === "string") return asset;
  return uploadOne(userId, target, asset, from, renewed);
}

/** What happened when adding several vehicle photos at once. */
export interface PhotosResult {
  /** Photos added to the vehicle. */
  added: number;
  /** Photos chosen beyond the cap, not uploaded. */
  skipped: number;
  /** The first error, if one stopped the uploads; null when they all worked or nothing was chosen. */
  error: string | null;
}

/**
 * Vehicle photos: from the gallery the driver can choose several at once (up to the room
 * left under the cap); the camera stays one at a time. They upload one after the other and
 * `onProgress(n, total)` reports each one as it starts ("Subiendo 2 de 4…").
 * Uses expo-image-picker's own options (allowsMultipleSelection / selectionLimit), already
 * in the installed app: no new native code, so this ships as an over-the-air update.
 */
export async function pickAndUploadPhotos(
  userId: string,
  vehicleId: string,
  from: "camera" | "library",
  have: number,
  onProgress: (n: number, total: number) => void,
): Promise<PhotosResult> {
  const room = MAX_VEHICLE_PHOTOS - have;
  if (room <= 0) return { added: 0, skipped: 0, error: capMessage() };
  let assets: Picked[];
  if (from === "camera") {
    const one = await pick("camera", false);
    if (one === null) return { added: 0, skipped: 0, error: null };
    if (typeof one === "string") return { added: 0, skipped: 0, error: one };
    assets = [one];
  } else {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: room > 1,
      selectionLimit: room,
      orderedSelection: true,
    });
    if (result.canceled || !result.assets?.length) return { added: 0, skipped: 0, error: null };
    assets = result.assets.map((a) => ({ uri: a.uri, mime: a.mimeType ?? undefined }));
  }
  // Some phones ignore the selection limit: keep the first ones that fit.
  const take = assets.slice(0, room);
  const skipped = assets.length - take.length;
  let added = 0;
  for (const [i, a] of take.entries()) {
    onProgress(i + 1, take.length);
    const err = await uploadOne(userId, { type: "photo", vehicleId }, a, from);
    if (err) return { added, skipped: skipped + (take.length - i - 1), error: err };
    added++;
  }
  return { added, skipped, error: null };
}

/** Why no more photos can be added. */
export function capMessage(): string {
  return tr(
    "Ya tiene " + MAX_VEHICLE_PHOTOS + " fotos, el máximo. Elimine una para agregar otra.",
    "You already have " + MAX_VEHICLE_PHOTOS + " photos, the most allowed. Remove one to add another.",
  );
}

/** Vehicle photos and the licence plate photo must be pictures; other documents may also be PDFs. */
function pdfAllowed(target: UploadTarget): boolean {
  return target.type === "driver" || (target.type === "vehicle" && target.key !== "plate_photo");
}

async function uploadOne(userId: string, target: UploadTarget, asset: Picked, from: UploadSource, renewed?: string): Promise<string | null> {
  const allowPdf = pdfAllowed(target);
  if (from === "file" && (!asset.mime || !EXT[asset.mime])) return allowPdf
      ? tr("Use un PDF o una foto (JPG, PNG, WEBP, HEIC).", "Use a PDF or a photo (JPG, PNG, WEBP, HEIC).")
      : tr("Use una foto (JPG, PNG, WEBP, HEIC).", "Use a photo (JPG, PNG, WEBP, HEIC).");
  if (asset.mime === "application/pdf" && !allowPdf) return tr("Las fotos del vehículo deben ser imágenes, no PDF.", "Vehicle photos must be pictures, not PDFs.");
  const type = asset.mime && EXT[asset.mime] ? asset.mime : "image/jpeg";
  const ext = EXT[type];
  let bytes: ArrayBuffer;
  try {
    bytes = await (await fetch(asset.uri)).arrayBuffer();
  } catch {
    return tr("No pudimos leer ese archivo. Intente de nuevo.", "We couldn't read that file. Please try again.");
  }
  if (bytes.byteLength > MAX_BYTES) return tr("Ese archivo pesa más de 10 MB. Use uno más pequeño.", "That file is over 10 MB. Use a smaller one.");

  const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  const name = target.type === "photo" ? "photo-" + stamp + "." + ext : target.key + "-" + stamp + "." + ext;
  const path = target.type === "driver" ? userId + "/" + name : userId + "/vehicles/" + target.vehicleId + "/" + name;
  const up = await supabase.storage.from("driver-kyc-docs").upload(path, bytes, { contentType: type, upsert: false });
  if (up.error) return tr("No se pudo subir. Revise su conexión e intente de nuevo.", "Upload failed. Check your connection and try again.");

  const body: Record<string, unknown> =
    target.type === "driver"
      ? { target: "driver", key: target.key, path, renewed }
      : target.type === "vehicle"
        ? { target: "vehicle", vehicle_id: target.vehicleId, key: target.key, path, renewed }
        : { target: "photo", vehicle_id: target.vehicleId, path };
  const res = await api("/driver/documents", body);
  return res.ok ? null : (res.error ?? tr("El archivo se subió pero no se pudo vincular. Intente de nuevo.", "The file uploaded but couldn't be linked. Please try again."));
}
