/**
 * Every picture on the public site: real photos (files in public/photos) and the
 * drawn placeholders that stand in where we don't have a suitable photo yet.
 *
 * Rules (full version in docs/PHOTOS.md):
 * - Our own photos wherever we have one, checked against the exclusion list.
 * - Where we have none yet: temporary free stock photos from Pexels or Unsplash only
 *   (Jorge, 2026-11-11), made with stock() below so each carries its source page and
 *   licence (internal, never shown) and can be swapped for one of ours later.
 * - An own photo used here is never used by any other business, and the other way round.
 * - A photo shows what its caption says: never one place standing in for another. A stock
 *   vehicle photo is an example of the body type: its alt text says "Example vehicle".
 * - No identifiable people, readable plates, logos or watermarks.
 * - Files in public/photos carry no metadata (no GPS, camera, date or author).
 *
 * To replace a placeholder with a real photo: put the cleaned file in
 * public/photos and add `file`, `width` and `height` to its line below. Nothing
 * else changes: every page reads the picture through <Photo id="…" />.
 */
import type { HubId } from "./catalog";
import type { PublicLang } from "./publicLang";

export const PHOTO_CREDIT = "Costa Rica Private Transfers";

/** Line drawings used while a picture has no photo. */
export type PlaceholderArt = "volcano" | "cloudforest" | "riverboat" | "rainforest" | "coast" | "sedan" | "suv" | "van";

export interface PhotoEntry {
  /** File name in public/photos. Missing = the placeholder drawing is shown. */
  file?: string;
  width?: number;
  height?: number;
  alt: Record<PublicLang, string>;
  /** The part of the photo to keep when it is cropped to its frame (CSS object-position). */
  focal?: string;
  /** Drawing shown while there is no file. */
  art: PlaceholderArt;
  credit: string;
  /** Stock photos only: the page it was downloaded from. Internal: for replacing it with an own photo later. */
  source?: string;
  /** Stock photos only: the free licence it is used under. */
  licence?: "Pexels" | "Unsplash";
}

const photo = (
  file: string,
  width: number,
  height: number,
  en: string,
  es: string,
  focal = "50% 50%",
  art: PlaceholderArt = "coast",
): PhotoEntry => ({ file: `${file}.jpg`, width, height, alt: { en, es }, focal, art, credit: PHOTO_CREDIT });

/** A temporary stock photo (docs/PHOTOS.md): the same as photo(), plus where it came from. */
const stock = (
  file: string,
  width: number,
  height: number,
  en: string,
  es: string,
  focal: string,
  art: PlaceholderArt,
  licence: "Pexels" | "Unsplash",
  source: string,
): PhotoEntry => ({ file: `${file}.jpg`, width, height, alt: { en, es }, focal, art, credit: licence, source, licence });

const placeholder = (art: PlaceholderArt, en: string, es: string): PhotoEntry => ({
  alt: { en, es },
  art,
  credit: PHOTO_CREDIT,
});

export const PHOTOS = {
  // ── Coast and beaches ──
  "pacific-beach-aerial": photo(
    "pacific-beach-aerial", 2000, 1333,
    "Aerial view of a long, empty palm-lined beach on Costa Rica's Pacific coast",
    "Vista aérea de una playa larga y solitaria bordeada de palmeras en el Pacífico de Costa Rica",
    "62% 60%",
  ),
  "pacific-bay-aerial": photo(
    "pacific-bay-aerial", 1600, 1067,
    "Turquoise bay and rainforest on the Nicoya Peninsula, with mountains behind",
    "Bahía turquesa y bosque en la península de Nicoya, con montañas al fondo",
    "50% 65%",
  ),
  "manuel-antonio-sunset": photo(
    "manuel-antonio-sunset", 2000, 1125,
    "Deep red sunset over the Pacific at Manuel Antonio",
    "Atardecer rojo intenso sobre el Pacífico en Manuel Antonio",
    "50% 40%",
  ),
  "manuel-antonio-hills-sunset": photo(
    "manuel-antonio-hills-sunset", 1600, 1067,
    "Sun rays over the forested hills and the sea at Manuel Antonio",
    "Rayos de sol sobre las colinas boscosas y el mar en Manuel Antonio",
    "60% 40%",
  ),
  "guanacaste-beach-sunset": photo(
    "guanacaste-beach-sunset", 2000, 1125,
    "Sunset behind a headland and islets on a Guanacaste beach",
    "Atardecer detrás de una punta e islotes en una playa de Guanacaste",
    "60% 50%",
  ),
  "guanacaste-beach-islet": photo(
    "guanacaste-beach-islet", 1600, 1067,
    "Empty beach under a blue sky with a small island offshore, northern Guanacaste",
    "Playa solitaria bajo un cielo azul con un islote al frente, en el norte de Guanacaste",
    "70% 45%",
  ),
  // ── On the road ──
  "gulf-sunset-ferry": photo(
    "gulf-sunset-ferry", 1600, 1067,
    "Sun setting behind the Nicoya Peninsula, seen from the ferry across the gulf",
    "El sol poniéndose detrás de la península de Nicoya, visto desde el ferry que cruza el golfo",
    "55% 45%",
  ),
  "gulf-ferry-crossing": photo(
    "gulf-ferry-crossing", 1200, 800,
    "Car ferry crossing the Gulf of Nicoya in front of green hills",
    "Ferry de vehículos cruzando el golfo de Nicoya frente a colinas verdes",
    "45% 60%",
  ),
  "route-27-highway": photo(
    "route-27-highway", 1200, 800,
    "Route 27, the highway from San José to the Pacific coast, under a blue sky",
    "La Ruta 27, la autopista de San José a la costa del Pacífico, bajo un cielo azul",
    "55% 60%",
  ),
  "central-valley-view": photo(
    "central-valley-view", 1200, 800,
    "The Central Valley around San José, seen from the hills above it",
    "El Valle Central alrededor de San José, visto desde las colinas",
    "50% 50%",
  ),
  "central-valley-dusk": photo(
    "central-valley-dusk", 1200, 800,
    "Hydrangeas and the valley lights at dusk, in the hills on the road from San José to La Fortuna",
    "Hortensias y las luces del valle al anochecer, en las colinas de la carretera de San José a La Fortuna",
    "50% 60%",
  ),
  "mountain-sunset": photo(
    "mountain-sunset", 1200, 800,
    "Sunset above the clouds from the mountain road in the Talamanca range",
    "Atardecer sobre las nubes desde la carretera de montaña en la cordillera de Talamanca",
    "50% 40%",
  ),
  "la-fortuna-hot-river": photo(
    "la-fortuna-hot-river", 1600, 1067,
    "Warm river running through the rainforest near La Fortuna, at the foot of Arenal",
    "Río de aguas termales entre el bosque cerca de La Fortuna, al pie del Arenal",
    "50% 55%",
    "rainforest",
  ),
  // ── Wildlife ──
  "sloth-resting": photo(
    "sloth-resting", 2000, 1333,
    "Two-toed sloth asleep on a railing in Puerto Viejo, on the Caribbean coast",
    "Perezoso de dos dedos dormido sobre una baranda en Puerto Viejo, en el Caribe",
    "35% 40%",
    "rainforest",
  ),
  "wildlife-sloth": photo(
    "wildlife-sloth", 900, 1125,
    "Two-toed sloth resting, Puerto Viejo",
    "Perezoso de dos dedos descansando, Puerto Viejo",
    "50% 45%",
    "rainforest",
  ),
  "wildlife-capuchin": photo(
    "wildlife-capuchin", 900, 1125,
    "White-faced capuchin monkey in a tree, Guanacaste",
    "Mono carablanca en un árbol, Guanacaste",
    "55% 45%",
    "rainforest",
  ),
  "wildlife-toucan": photo(
    "wildlife-toucan", 900, 1125,
    "Toucan on a branch at dusk, Manuel Antonio",
    "Tucán en una rama al atardecer, Manuel Antonio",
    "50% 45%",
    "rainforest",
  ),
  "wildlife-blue-morpho": photo(
    "wildlife-blue-morpho", 900, 1125,
    "Blue morpho butterfly with its wings open",
    "Mariposa morfo azul con las alas abiertas",
    "50% 45%",
    "rainforest",
  ),
  "wildlife-dolphins": photo(
    "wildlife-dolphins", 900, 1125,
    "Dolphins swimming beside the boat off the Central Pacific coast",
    "Delfines nadando junto al bote frente al Pacífico Central",
    "60% 65%",
    "coast",
  ),
  "wildlife-deer": photo(
    "wildlife-deer", 900, 1125,
    "White-tailed deer at the forest edge, Nicoya Peninsula",
    "Venado cola blanca al borde del bosque, península de Nicoya",
    "50% 65%",
    "rainforest",
  ),

  // ── Placeholders: no suitable photo yet (add file + width + height to drop one in) ──
  arenal: placeholder("volcano", "Illustration of Arenal Volcano above La Fortuna", "Ilustración del volcán Arenal sobre La Fortuna"),
  corcovado: placeholder("rainforest", "Illustration of the Corcovado rainforest", "Ilustración del bosque lluvioso de Corcovado"),
  poas: placeholder("volcano", "Illustration of the Poás Volcano crater", "Ilustración del cráter del volcán Poás"),
  "vehicle-suv": placeholder("suv", "Illustration of an SUV", "Ilustración de un SUV"),
  "vehicle-boat": placeholder("riverboat", "Illustration of a 4x4 ride and river boat", "Ilustración de un traslado en 4x4 y lancha"),

  // ── Temporary stock photos (Pexels), until we have our own. Listed in docs/PHOTOS.md. ──
  monteverde: stock(
    "monteverde-hanging-bridge", 1481, 1600,
    "Red hanging bridge through the misty cloud forest in Monteverde",
    "Puente colgante rojo entre la neblina del bosque nuboso de Monteverde",
    "50% 45%", "cloudforest", "Pexels", "https://www.pexels.com/photo/iron-bridge-in-a-jungle-16806198/",
  ),
  "drake-bay": stock(
    "drake-bay-coast", 1600, 900,
    "The forested coast of Drake Bay on the Osa Peninsula, seen from the air",
    "La costa boscosa de Bahía Drake, en la península de Osa, vista desde el aire",
    "35% 55%", "riverboat", "Pexels", "https://www.pexels.com/photo/aerial-photography-of-body-of-water-824223/",
  ),
  "vehicle-economy": stock(
    "vehicle-economy", 1200, 761,
    "Example vehicle: a compact sedan",
    "Vehículo de ejemplo: un sedán compacto",
    "50% 60%", "sedan", "Pexels", "https://www.pexels.com/photo/white-car-on-the-roadside-9544521/",
  ),
  "vehicle-sedan": stock(
    "vehicle-sedan", 1200, 789,
    "Example vehicle: a sedan",
    "Vehículo de ejemplo: un sedán",
    "50% 55%", "sedan", "Pexels", "https://www.pexels.com/photo/sleek-white-car-parked-by-spring-blooms-37140081/",
  ),
  "vehicle-mpv": stock(
    "vehicle-mpv", 1200, 800,
    "Example vehicle: a minivan (MPV)",
    "Vehículo de ejemplo: una minivan (MPV)",
    "50% 50%", "van", "Pexels", "https://www.pexels.com/photo/sleek-modern-minivan-driving-on-scenic-road-30195580/",
  ),
  "vehicle-4x4": stock(
    "vehicle-4x4", 1200, 768,
    "Example vehicle: a large 4x4",
    "Vehículo de ejemplo: un 4x4 grande",
    "50% 60%", "suv", "Pexels", "https://www.pexels.com/photo/black-suv-parked-on-road-at-sunset-37049414/",
  ),
  "vehicle-van": stock(
    "vehicle-van", 1200, 1101,
    "Example vehicle: a high-roof passenger van",
    "Vehículo de ejemplo: una microbús de pasajeros de techo alto",
    "60% 55%", "van", "Pexels", "https://www.pexels.com/photo/white-van-on-a-mountain-road-in-oman-37989724/",
  ),
} satisfies Record<string, PhotoEntry>;

export type PhotoId = keyof typeof PHOTOS;

export function photoEntry(id: PhotoId): PhotoEntry {
  return PHOTOS[id];
}

/** Home page hero. */
export const HOME_HERO_PHOTO: PhotoId = "pacific-beach-aerial";

/** The picture that stands for each town (route pages, "popular routes" cards). Airports have none. */
export const HUB_PHOTO: Partial<Record<HubId, PhotoId>> = {
  ManuelAntonio: "manuel-antonio-sunset",
  Arenal: "la-fortuna-hot-river",
  Monteverde: "monteverde",
  Tamarindo: "guanacaste-beach-sunset",
  PuertoViejo: "sloth-resting",
  Sierpe: "drake-bay",
  DrakeBay: "drake-bay",
};

/** Hero picture of a route page: where the ride ends (or starts, for rides back to an airport). */
export function routePhoto(origin: HubId, destination: HubId): PhotoId {
  return HUB_PHOTO[destination] ?? HUB_PHOTO[origin] ?? "central-valley-view";
}

/**
 * "The drive" picture of a route page, only where we have a photo taken on that
 * road: Route 27 for rides from San José to the Pacific, the Naranjo–Zarcero
 * hills for San José → La Fortuna, the Central Valley for other San José departures.
 */
export function drivePhoto(origin: HubId, destination: HubId): PhotoId | null {
  if (origin !== "SJO") return null;
  if (destination === "ManuelAntonio" || destination === "Tamarindo") return "route-27-highway";
  if (destination === "Arenal") return "central-valley-dusk";
  return "central-valley-view";
}

/** Day tours (and the retired multi-day trips, for old bookings), by catalog id. Unknown ids (added in /admin/pricing) get a neutral drawing. */
const TOUR_PHOTO: Record<string, PhotoId> = {
  dt1: "la-fortuna-hot-river",
  dt2: "manuel-antonio-hills-sunset",
  dt3: "drake-bay",
  dt4: "monteverde",
  md1: "corcovado",
  md2: "manuel-antonio-sunset",
};

export function tourPhoto(id: string): PhotoId {
  return TOUR_PHOTO[id] ?? "corcovado";
}

/**
 * Vehicle classes, by catalog id: stock photos of an example of each body type until the
 * photos of our own vehicles arrive (the 4x4 + boat combo keeps its drawing: no honest photo).
 */
const VEHICLE_PHOTO: Record<string, PhotoId> = {
  economy: "vehicle-economy",
  sedan: "vehicle-sedan",
  suv: "vehicle-mpv", // the 4-traveller class is a minivan (MPV), not an SUV
  "4x4": "vehicle-4x4",
  van: "vehicle-van",
  sierpe_combo: "vehicle-boat",
};

export function vehiclePhoto(id: string): PhotoId {
  return VEHICLE_PHOTO[id] ?? "vehicle-suv";
}

/** "On the road in Costa Rica" band on the home page. */
export const ON_THE_ROAD_PHOTOS: PhotoId[] = ["route-27-highway", "central-valley-view", "gulf-ferry-crossing", "mountain-sunset"];

/** Wildlife strip on the home page. */
export const WILDLIFE_PHOTOS: PhotoId[] = [
  "wildlife-sloth",
  "wildlife-capuchin",
  "wildlife-toucan",
  "wildlife-blue-morpho",
  "wildlife-dolphins",
  "wildlife-deer",
];
