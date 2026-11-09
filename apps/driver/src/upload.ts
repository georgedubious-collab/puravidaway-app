import * as ImagePicker from "expo-image-picker";
import { api } from "./api";
import { supabase } from "./supabase";

/** What a file is for: a personal document, a vehicle document, or a vehicle photo. */
export type UploadTarget =
  | { type: "driver"; key: string }
  | { type: "vehicle"; vehicleId: string; key: string }
  | { type: "photo"; vehicleId: string };

const MAX_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };

/**
 * Take a photo (or choose one) and attach it. The file goes straight into the
 * driver's private folder in storage; the server then links it to the right
 * document, with the same checks as the website. Returns an error message, or
 * null when it worked or the driver cancelled.
 */
export async function pickAndUpload(userId: string, target: UploadTarget, from: "camera" | "library", renewed?: string): Promise<string | null> {
  if (from === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return "Allow the camera in the phone's settings to take a photo.";
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
  const result = from === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  const type = asset.mimeType && EXT[asset.mimeType] ? asset.mimeType : "image/jpeg";
  const ext = EXT[type];
  let bytes: ArrayBuffer;
  try {
    bytes = await (await fetch(asset.uri)).arrayBuffer();
  } catch {
    return "We couldn't read that photo. Please try again.";
  }
  if (bytes.byteLength > MAX_BYTES) return "That photo is over 10 MB. Try again a little further away.";

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
  return res.ok ? null : (res.error ?? "The photo uploaded but couldn't be linked. Please try again.");
}
