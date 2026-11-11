import type { ImageSourcePropType } from "react-native";

/**
 * The app's image system. Every picture on screen is a <Photo name="…" />
 * (src/Photo.tsx) and the name is looked up here:
 *
 *   1. PHOTOS — a real photo file, when we have one for that name;
 *   2. otherwise PLACEHOLDERS — a designed stand-in (a soft two-colour gradient
 *      with a simple line drawing), so the app looks finished without photos.
 *
 * TO ADD A REAL PHOTO LATER
 *   a. Save the file in apps/client/assets/photos/, e.g. arenal.jpg
 *      (JPEG, landscape, about 1600 px wide, under ~400 KB).
 *   b. Add ONE line to PHOTOS below:
 *        arenal: require("../assets/photos/arenal.jpg"),
 *   That's all: every card, hero and list that shows "arenal" picks it up.
 *
 * Names in use
 *   Destinations: arenal, monteverde, manuel-antonio, tamarindo, santa-teresa,
 *                 puerto-viejo, drake-bay, sjo, lir
 *   Vehicles:     economy, sedan, suv, 4x4, van   (the ids the server sends)
 *   Tours:        tour:<id>   e.g. "tour:dt1"     (falls back to the tour's region)
 *   Stops:        stop:<id>   e.g. "stop:poas"    (falls back to a generic scene)
 *   Generic:      hero
 *
 * Only use photos we own or have licensed for this business. Never bundle a
 * photo that another company's site or app uses.
 */
export const PHOTOS: Record<string, ImageSourcePropType> = {
  // arenal: require("../assets/photos/arenal.jpg"),
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
  [/monteverde|cloud|celeste/i, "monteverde"],
  [/manuel\s*antonio|quepos|central pacific|jac[oó]|uvita|dominical/i, "manuel-antonio"],
  [/tamarindo|flamingo|conchal|guanacaste|papagayo|s[aá]mara|nosara/i, "tamarindo"],
  [/santa\s*teresa|nicoya|montezuma|mal\s*pa[ií]s|paquera/i, "santa-teresa"],
  [/puerto\s*viejo|cahuita|lim[oó]n|caribbean|tortuguero/i, "puerto-viejo"],
  [/drake|sierpe|\bosa\b|corcovado|\bca[ñn]o\b|mangrove|snorkel/i, "drake-bay"],
  [/liberia|\blir\b/i, "lir"],
  [/\bsjo\b|san\s*jos[eé]|alajuela|airport|aeropuerto/i, "sjo"],
  [/waterfall|catarata|sloth|wildlife|sanctuary/i, "waterfall"],
  [/volc[aá]n|volcano|po[aá]s|iraz[uú]/i, "arenal"],
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
