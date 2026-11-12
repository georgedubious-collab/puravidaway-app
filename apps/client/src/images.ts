import type { ImageSourcePropType } from "react-native";

/**
 * The app's image system. Every picture on screen is a <Photo name="…" />
 * (src/Photo.tsx) and the name is looked up here:
 *
 *   1. PHOTOS — a real photo file, when we have one for that name;
 *   2. otherwise PLACEHOLDERS — a designed stand-in (a soft two-colour gradient
 *      with a simple line drawing), so the app looks finished without photos.
 *
 * TO ADD OR REPLACE A PHOTO
 *   a. Clean it first (docs/PHOTOS.md: no metadata, no people, plates or logos)
 *      and save it in apps/client/assets/photos/ (JPEG, about 1200 px on the
 *      long side, 600 px for a vehicle).
 *   b. Add or change ONE line in PHOTOS below:
 *        arenal: require("../assets/photos/la-fortuna-hot-river.jpg"),
 *   That's all: every card, hero and list that shows "arenal" picks it up.
 *
 * Names in use
 *   Destinations: arenal, monteverde, manuel-antonio, tamarindo, santa-teresa,
 *                 puerto-viejo, drake-bay, sjo, lir (and, drawings only:
 *                 central-pacific, caribbean, corcovado, rio-celeste, volcano)
 *   Vehicles:     economy, sedan, suv, 4x4, van   (the ids the server sends)
 *   Tours:        tour:<id>   e.g. "tour:dt1"     (falls back to the tour's region)
 *   Stops:        stop:<id>   e.g. "stop:poas"    (falls back to a generic scene)
 *   Generic:      hero
 *
 * WHICH PHOTOS (docs/PHOTOS.md has the full list and the rules)
 *   - Our own photos, the same files the website publishes, wherever we have one.
 *   - Where we have none yet: temporary free stock photos from Pexels (Jorge,
 *     2026-11-11), each listed in STOCK_PHOTOS below with its source page so it
 *     can be swapped for one of ours later. A place photo is always of that
 *     place. A vehicle photo is an EXAMPLE of the body type, never "our car".
 *   - A photo shows what the screen says: a name that only resembles a place
 *     (Jacó, Tortuguero, Río Celeste…) keeps its drawing rather than borrow
 *     another place's photo.
 */
export const PHOTOS: Record<string, ImageSourcePropType> = {
  // ── Our own photos (also on the website, public/photos) ──
  arenal: require("../assets/photos/la-fortuna-hot-river.jpg"),
  "manuel-antonio": require("../assets/photos/manuel-antonio-sunset.jpg"),
  tamarindo: require("../assets/photos/guanacaste-beach-sunset.jpg"),
  "puerto-viejo": require("../assets/photos/sloth-resting.jpg"),
  // dt1 ends in the hot springs; dt2 is Manuel Antonio (same pictures as the website's tour cards).
  "tour:dt1": require("../assets/photos/la-fortuna-hot-river.jpg"),
  "tour:dt2": require("../assets/photos/manuel-antonio-hills-sunset.jpg"),
  // ── Temporary stock photos (see STOCK_PHOTOS) ──
  monteverde: require("../assets/photos/monteverde-hanging-bridge.jpg"),
  "drake-bay": require("../assets/photos/drake-bay-coast.jpg"),
  "tour:dt3": require("../assets/photos/drake-bay-coast.jpg"),
  "tour:dt4": require("../assets/photos/monteverde-hanging-bridge.jpg"),
  economy: require("../assets/photos/vehicle-economy.jpg"),
  sedan: require("../assets/photos/vehicle-sedan.jpg"),
  suv: require("../assets/photos/vehicle-mpv.jpg"),
  "4x4": require("../assets/photos/vehicle-4x4.jpg"),
  van: require("../assets/photos/vehicle-van.jpg"),
};

/**
 * Stock photos in use, by file in assets/photos: where each came from and under
 * which licence. Internal only (never shown to travellers): the list to work
 * through when our own photos arrive. Keep in step with docs/PHOTOS.md and the
 * website's src/lib/photos.ts.
 */
export const STOCK_PHOTOS: Record<string, { shows: string; source: string; licence: "Pexels" | "Unsplash" }> = {
  "monteverde-hanging-bridge.jpg": { shows: "Hanging bridge in the Monteverde cloud forest", source: "https://www.pexels.com/photo/iron-bridge-in-a-jungle-16806198/", licence: "Pexels" },
  "drake-bay-coast.jpg": { shows: "The coast of Drake Bay, Osa Peninsula, from the air", source: "https://www.pexels.com/photo/aerial-photography-of-body-of-water-824223/", licence: "Pexels" },
  "vehicle-economy.jpg": { shows: "Example vehicle: compact sedan", source: "https://www.pexels.com/photo/white-car-on-the-roadside-9544521/", licence: "Pexels" },
  "vehicle-sedan.jpg": { shows: "Example vehicle: sedan", source: "https://www.pexels.com/photo/sleek-white-car-parked-by-spring-blooms-37140081/", licence: "Pexels" },
  "vehicle-mpv.jpg": { shows: "Example vehicle: minivan (MPV)", source: "https://www.pexels.com/photo/sleek-modern-minivan-driving-on-scenic-road-30195580/", licence: "Pexels" },
  "vehicle-4x4.jpg": { shows: "Example vehicle: large 4x4", source: "https://www.pexels.com/photo/black-suv-parked-on-road-at-sunset-37049414/", licence: "Pexels" },
  "vehicle-van.jpg": { shows: "Example vehicle: high-roof passenger van", source: "https://www.pexels.com/photo/white-van-on-a-mountain-road-in-oman-37989724/", licence: "Pexels" },
};

/** The line drawings a placeholder can carry. */
export type Art = "volcano" | "beach" | "bridge" | "wave" | "boat" | "plane" | "waterfall" | "hills" | "car-economy" | "car-sedan" | "car-suv" | "car-4x4" | "car-van";

export interface Placeholder {
  art: Art;
  /** Gradient, top-left to bottom-right. */
  from: string;
  to: string;
  /** The colour of the soft sun / accent disc. */
  accent: string;
}

const GOLD = "#F9D56B";
const MINT = "#D9F5E7";

export const PLACEHOLDERS: Record<string, Placeholder> = {
  // Destinations
  arenal: { art: "volcano", from: "#9FDCC0", to: "#2E9B7B", accent: GOLD },
  monteverde: { art: "bridge", from: "#BFE4DC", to: "#4E9E96", accent: MINT },
  "manuel-antonio": { art: "beach", from: "#A8E3D8", to: "#1F9A8C", accent: GOLD },
  tamarindo: { art: "wave", from: "#F8DE9A", to: "#3DAA9A", accent: "#FFF1BF" },
  "santa-teresa": { art: "wave", from: "#F6D58A", to: "#5DB7A0", accent: "#FFF1BF" },
  "puerto-viejo": { art: "beach", from: "#B5E6EA", to: "#2D9AA6", accent: GOLD },
  "drake-bay": { art: "boat", from: "#A9DCD2", to: "#1E8C80", accent: GOLD },
  sjo: { art: "plane", from: "#C9EBD8", to: "#56B091", accent: GOLD },
  lir: { art: "plane", from: "#F5E3A6", to: "#6DBE9E", accent: "#FFF4CC" },
  // Places near one we have a photo of: always a drawing, never the neighbour's photo.
  "central-pacific": { art: "beach", from: "#A8E3D8", to: "#1F9A8C", accent: GOLD },
  caribbean: { art: "beach", from: "#B5E6EA", to: "#2D9AA6", accent: GOLD },
  corcovado: { art: "boat", from: "#A9DCD2", to: "#1E8C80", accent: GOLD },
  "rio-celeste": { art: "bridge", from: "#BFE4DC", to: "#4E9E96", accent: MINT },
  volcano: { art: "volcano", from: "#9FDCC0", to: "#2E9B7B", accent: GOLD },
  // Vehicles: quiet, so the car's outline is what you see
  economy: { art: "car-economy", from: "#E4F4EC", to: "#A8D9C4", accent: "#FFF1BF" },
  sedan: { art: "car-sedan", from: "#E4F4EC", to: "#9FD5BE", accent: "#FFF1BF" },
  // The server's id "suv" is the 4-traveller minivan (MPV) class, so it is drawn as a van.
  suv: { art: "car-van", from: "#DDF1EC", to: "#93CFC2", accent: "#FFF1BF" },
  "4x4": { art: "car-4x4", from: "#E9F0D9", to: "#9CCBA6", accent: "#FFF1BF" },
  van: { art: "car-van", from: "#DCF0EE", to: "#8CCAC4", accent: "#FFF1BF" },
  // Generic
  hero: { art: "hills", from: "#A6E0C6", to: "#27957A", accent: GOLD },
  waterfall: { art: "waterfall", from: "#B4E6D6", to: "#2C9684", accent: MINT },
};

/** Words in a place, tour or stop name → the picture that suits it. First match wins. */
const KEYWORDS: [RegExp, string][] = [
  [/sloth|wildlife sanctuary|waterfall gardens/i, "waterfall"],
  [/arenal|fortuna/i, "arenal"],
  [/monteverde/i, "monteverde"],
  [/cloud|celeste/i, "rio-celeste"],
  [/manuel\s*antonio|quepos/i, "manuel-antonio"],
  [/central pacific|jac[oó]|uvita|dominical/i, "central-pacific"],
  // The photo is a Guanacaste beach, so it may stand for the Guanacaste coast.
  [/tamarindo|flamingo|conchal|guanacaste|papagayo|s[aá]mara|nosara/i, "tamarindo"],
  [/santa\s*teresa|nicoya|montezuma|mal\s*pa[ií]s|paquera/i, "santa-teresa"],
  [/puerto\s*viejo/i, "puerto-viejo"],
  [/cahuita|lim[oó]n|caribbean|tortuguero/i, "caribbean"],
  [/drake|sierpe|\bosa\b|\bca[ñn]o\b/i, "drake-bay"],
  [/corcovado|mangrove|snorkel/i, "corcovado"],
  [/liberia|\blir\b/i, "lir"],
  [/\bsjo\b|san\s*jos[eé]|alajuela|airport|aeropuerto/i, "sjo"],
  [/waterfall|catarata|sloth|wildlife|sanctuary/i, "waterfall"],
  [/volc[aá]n|volcano|po[aá]s|iraz[uú]/i, "volcano"],
];

/** The picture name for free text (a town, a hotel, a trip title). */
export function photoFor(text: string | null | undefined): string {
  if (!text) return "hero";
  for (const [re, key] of KEYWORDS) if (re.test(text)) return key;
  return "hero";
}

/** A trip title reads "From → To": the picture is of where you're going. */
export function photoForTrip(title: string): string {
  const parts = title.split("→");
  const to = photoFor(parts[parts.length - 1]);
  return to !== "hero" || parts.length === 1 ? to : photoFor(parts[0]);
}

/** The server's vehicle ids are the picture names; anything new falls back by its name. */
export function photoForVehicle(id: string, name: string): string {
  if (PLACEHOLDERS[id] || PHOTOS[id]) return id;
  if (/van|hiace|staria|bus/i.test(name)) return "van";
  if (/4x4|prado|fortuner/i.test(name)) return "4x4";
  if (/suv/i.test(name)) return "suv";
  if (/economy/i.test(name)) return "economy";
  return "sedan";
}

/** What <Photo> should draw for a name: a real photo, or a placeholder. */
export function resolvePhoto(name: string, fallback?: string): { source?: ImageSourcePropType; placeholder: Placeholder } {
  const source = PHOTOS[name] ?? (fallback ? PHOTOS[fallback] : undefined);
  const placeholder = PLACEHOLDERS[name] ?? (fallback ? PLACEHOLDERS[fallback] : undefined) ?? PLACEHOLDERS.hero;
  return { source, placeholder };
}
