import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { api } from "./api";
import { supabase } from "./supabase";

/** What a file is for: a personal document, a vehicle document, or a vehicle photo. */
export type UploadTarget =
  | { type: "driver"; key: string }
  | { type: "vehicle"; vehicleId: string; key: string }
  | { type: "photo"; vehicleId: string };

const MAX_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export type UploadSource = "camera" | "library" | "file";

/** The picked file as a local address and type, or an error, or null when cancelled. */
async function pick(from: UploadSource, allowPdf: boolean): Promise<{ uri: string; mime?: string } | string | null> {
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
    if (!perm.granted) return "Allow the camera in the phone's settings to take a photo.";
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
  // Vehicle photos must be pictures; documents may also be PDFs.
  const allowPdf = target.type !== "photo";
  const asset = await pick(from, allowPdf);
  if (asset === null || typeof asset === "string") return asset;

  if (from === "file" && (!asset.mime || !EXT[asset.mime])) return allowPdf ? "Use a PDF or a photo (JPG, PNG, WEBP, HEIC)." : "Use a photo (JPG, PNG, WEBP, HEIC).";
  if (asset.mime === "application/pdf" && !allowPdf) return "Vehicle photos must be pictures, not PDFs.";
  const type = asset.mime && EXT[asset.mime] ? asset.mime : "image/jpeg";
  const ext = EXT[type];
  let bytes: ArrayBuffer;
  try {
    bytes = await (await fetch(asset.uri)).arrayBuffer();
  } catch {
    return "We couldn't read that file. Please try again.";
  }
  if (bytes.byteLength > MAX_BYTES) return "That file is over 10 MB. Use a smaller one.";

  const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  const name = target.type === "photo" ? "photo-" + stamp + "." + ext : target.key + "-" + stamp + "." + ext;
  const path = target.type === "driver" ? userId + "/" + name : userId + "/vehicles/" + target.vehicleId + "/" + name;
  const up = await supabase.storage.from("driver-kyc-docs").upload(path, bytes, { contentType: type, upsert: false });
  if (up.error) return "Upload failed. Check your connection and try again.";

  const body: Record<string, unknown> =
    target.type === "driver"
      ? { target: "driver", key: target.key, path, renewed }
      : target.type === "vehicle"
        ? { target: "vehicle", vehicle_id: target.vehicleId, key: target.key, path, renewed }
        : { target: "photo", vehicle_id: target.vehicleId, path };
  const res = await api("/driver/documents", body);
  return res.ok ? null : (res.error ?? "The file uploaded but couldn't be linked. Please try again.");
}
