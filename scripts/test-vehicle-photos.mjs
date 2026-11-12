/**
 * Cases for vehicle photos (src/lib/vehiclePhotos.ts): removing, choosing the main photo,
 * whose files a driver may touch, and which files are ever signed for a traveller.
 *
 *   npm run test:photos        (Node 22.6+; Node runs the TypeScript directly)
 *
 * The database side (a driver can't change another driver's vehicle, can't go below 2 photos
 * on an approved vehicle, can't delete storage files) is checked by `npm run test:db`.
 */
import { readFileSync } from "node:fs";
import * as photos from "../src/lib/vehiclePhotos.ts";

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) passed++;
  else failures.push(`${name}: expected ${w}, got ${g}`);
};
const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(root + p, "utf8");

// --- The cap and the minimum, the same on the website and in the driver app ---------------------
check("cap", photos.MAX_VEHICLE_PHOTOS, 8);
check("minimum", photos.MIN_VEHICLE_PHOTOS, 2);
const app = read("apps/driver/src/upload.ts");
check("driver app cap matches", Number(/export const MAX_VEHICLE_PHOTOS = (\d+);/.exec(app)?.[1]), photos.MAX_VEHICLE_PHOTOS);
check("driver app minimum matches", Number(/export const MIN_VEHICLE_PHOTOS = (\d+);/.exec(app)?.[1]), photos.MIN_VEHICLE_PHOTOS);
check("gallery allows several at once", /allowsMultipleSelection:/.test(app) && /selectionLimit: room/.test(app), true);

// --- Whose files: only the driver's own folder for that vehicle ----------------------------------
const ME = "00000000-0000-0000-0000-00000000000d";
const OTHER = "00000000-0000-0000-0000-0000000000e0";
const V = "30000000-0000-0000-0000-000000000001";
check("own photo", photos.isOwnVehiclePath(ME, V, `${ME}/vehicles/${V}/photo-1.jpg`), true);
check("another driver's photo", photos.isOwnVehiclePath(ME, V, `${OTHER}/vehicles/${V}/photo-1.jpg`), false);
check("own photo of another vehicle", photos.isOwnVehiclePath(ME, V, `${ME}/vehicles/30000000-0000-0000-0000-000000000002/photo-1.jpg`), false);
check("own document, not a vehicle photo", photos.isOwnVehiclePath(ME, V, `${ME}/license-1.pdf`), false);
check("climbing out of the folder", photos.isOwnVehiclePath(ME, V, `${ME}/vehicles/${V}/../../${OTHER}/license.pdf`), false);
check("not a vehicle id", photos.isOwnVehiclePath(ME, "x", `${ME}/vehicles/x/photo-1.jpg`), false);

// --- Removing ------------------------------------------------------------------------------------
const three = ["a", "b", "c"];
check("remove from three (approved)", photos.withoutPhoto(three, "b", "approved"), { ok: true, photos: ["a", "c"] });
check("approved vehicle stops at two", photos.withoutPhoto(["a", "b"], "a", "approved"), { ok: false, reason: "minimum" });
check("pending vehicle may go lower", photos.withoutPhoto(["a", "b"], "a", "pending"), { ok: true, photos: ["b"] });
check("rejected vehicle may go lower", photos.withoutPhoto(["a"], "a", "rejected"), { ok: true, photos: [] });
check("photo not on the list", photos.withoutPhoto(three, "z", "pending"), { ok: false, reason: "missing" });
check("list is not changed in place", three, ["a", "b", "c"]);

// --- Main photo ----------------------------------------------------------------------------------
check("make the third main", photos.withMainPhoto(three, "c"), { ok: true, photos: ["c", "a", "b"] });
check("already main", photos.withMainPhoto(three, "a"), { ok: true, photos: ["a", "b", "c"] });
check("main photo not on the list", photos.withMainPhoto(three, "z"), { ok: false, reason: "missing" });

// --- What a traveller's links are made for -------------------------------------------------------
const drivers = [
  { documents: { driver_photo: "d1/photo.jpg", license: "d1/license.pdf", id_front: "d1/id.jpg", criminal_record: "d1/cr.pdf" } },
  { documents: { license: "d2/license.pdf" } },
  { documents: null },
];
const vehicles = [
  { photos: ["d1/vehicles/v1/1.jpg", "d1/vehicles/v1/2.jpg"], documents: { insurance: "d1/vehicles/v1/ins.pdf" } },
  { photos: Array.from({ length: 10 }, (_, i) => `d1/vehicles/v2/${i}.jpg`) },
  { photos: null },
];
const signed = photos.travellerPhotoPaths(drivers, vehicles);
check("profile photo + car photos only", signed.slice(0, 3), ["d1/photo.jpg", "d1/vehicles/v1/1.jpg", "d1/vehicles/v1/2.jpg"]);
check("never a document", signed.some((p) => /license|id\.jpg|cr\.pdf|ins\.pdf/.test(p)), false);
check("all car photos up to the cap, main first", signed.filter((p) => p.includes("/v2/")), Array.from({ length: 8 }, (_, i) => `d1/vehicles/v2/${i}.jpg`));

// The licence plate photo is a vehicle document for the team only: never signed for travellers.
const withPlate = [{ photos: ["d1/vehicles/v1/1.jpg"], documents: { plate_photo: "d1/vehicles/v1/plate_photo-1.jpg" } }];
check("plate photo never signed for travellers", photos.travellerPhotoPaths(drivers, withPlate).some((p) => p.includes("plate_photo")), false);
const kyc = read("src/lib/driverKyc.ts");
check("plate photo is a required vehicle document", /key: "plate_photo"[\s\S]{0,400}required: true/.test(kyc), true);
check("plate photo listed in the driver app", /key: "plate_photo"/.test(read("apps/driver/src/screens/Documents.tsx")), true);
check("plate photo is a picture only in the app", /target\.key !== "plate_photo"/.test(app), true);

// Both traveller views sign only through travellerPhotoPaths, and only for assigned bookings.
const trips = read("src/lib/travellerTrips.ts");
const page = read("src/app/trip/[token]/page.tsx");
for (const [name, src] of [["customer app API", trips], ["trip page", page]]) {
  check(`${name} signs through travellerPhotoPaths`, /createSignedUrls\(paths,/.test(src) && /const paths = travellerPhotoPaths\(/.test(src), true);
  check(`${name} signs nothing else`, (src.match(/createSignedUrls\(/g) ?? []).length, 1);
  check(`${name} shows drivers only once confirmed`, /\["confirmed", "in_progress", "completed"\]\.includes\(b\.status\)/.test(src), true);
}

// --- The app's API route runs the website's checked actions --------------------------------------
const route = read("src/app/api/v1/driver/photos/route.ts");
check("route requires sign-in", /await signedIn\(\)/.test(route), true);
check("route uses the checked actions", /deleteVehiclePhoto\(/.test(route) && /makeMainVehiclePhoto\(/.test(route), true);
const actions = read("src/app/driver/actions.ts");
check("actions check the folder", /if \(!isOwnVehiclePath\(meId, vehicleId, path\)\)/.test(actions), true);
check("storage file deleted only after the list is saved", actions.indexOf('.remove([path])') > actions.indexOf("update({ photos: next.photos })"), true);

console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
