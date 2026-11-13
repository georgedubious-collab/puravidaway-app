/**
 * Costa Rica Private Transfers catalog — source: docs/PROJECT.md §5.
 *
 * Phase 2a: static TypeScript data so the storefront works end to end.
 * Phase 2b: these move to Supabase tables (sightseeing_stops, vehicle_classes,
 * day_tours, seasons) and the admin pricing manager. (expeditions and lodging_tiers are the
 * retired multi-day trips: see RETIRED_EXPEDITIONS.)
 *
 * All prices are USD, stored in whole cents to avoid floating-point errors.
 */

/** Hub ids in a fixed order; the drive-time table below follows this order. */
export const HUB_IDS = [
  "SJO",
  "LIR",
  "Arenal",
  "ManuelAntonio",
  "Monteverde",
  "Sierpe",
  "DrakeBay",
  "PuertoViejo",
  "Tamarindo",
  "PuertoJimenez",
] as const;

export type HubId = (typeof HUB_IDS)[number];

export interface Hub {
  id: HubId;
  name: string;
}

export const HUBS: Hub[] = [
  { id: "SJO", name: "SJO Airport / San José" },
  { id: "LIR", name: "Liberia Airport (LIR)" },
  { id: "Arenal", name: "La Fortuna / Arenal" },
  { id: "ManuelAntonio", name: "Manuel Antonio" },
  { id: "Monteverde", name: "Monteverde Cloud Forest" },
  { id: "Sierpe", name: "Sierpe Boat Dock (Osa)" },
  { id: "DrakeBay", name: "Drake Bay (via Sierpe boat)" },
  { id: "PuertoViejo", name: "Puerto Viejo (Caribbean)" },
  { id: "Tamarindo", name: "Tamarindo / Guanacaste" },
  { id: "PuertoJimenez", name: "Puerto Jiménez (Osa)" },
];

/**
 * Door-to-door times in minutes between every pair of hubs (all 45 pairs), for
 * real Costa Rican roads: mountain stretches, single-lane bridges, trucks on
 * Route 32 and the slow last climb into Monteverde. Never straight-line.
 *
 * Sources: Daytrip's route times (docs/COMPETITORS.md §2b, checked 2026-10-14)
 * where they exist — SJO→La Fortuna 2h30, SJO→Manuel Antonio 2h50,
 * SJO→Tamarindo 4h40, SJO→Sierpe ~4h15, SJO→Puerto Viejo 4h, LIR→La Fortuna
 * 2h40, LIR→Tamarindo 1h30, Monteverde→Manuel Antonio 3h40, La Fortuna→Manuel
 * Antonio 4h50 — rounded up a little for door-to-door pickups (SJO→Monteverde
 * is set to 3h, not Daytrip's 2h30, for the slow final climb). The other pairs
 * are built from those legs along the usual roads (Routes 1, 27, 34 Costanera,
 * 32, 2, 4 and the Lake Arenal road via Tilarán).
 * Drake Bay = road to the Sierpe dock + the boat (~60–75 min), so
 * Drake Bay ↔ X = Sierpe ↔ X + 75.
 * Puerto Jiménez (added 2026-11-12, for Jorge to review): Route 245 round the Golfo Dulce from
 * the Interamericana at Chacarita. From the north it is the Sierpe road as far as Palmar Norte,
 * then ~1 h 45 more (Palmar Norte → Chacarita → Puerto Jiménez, ~122 km), so roughly
 * X ↔ Puerto Jiménez = X ↔ Sierpe + 105 min. SJO 6 h (Daytrip says 5 h 35), Manuel Antonio
 * ~4 h, Sierpe 2 h. Drake Bay ↔ Puerto Jiménez = drive to the Sierpe dock + the boat, like every
 * other town (there is no road we sell into Drake Bay).
 *
 *                 LIR  Arenal  ManuelAnt  Monteverde  Sierpe  DrakeBay  PuertoViejo  Tamarindo  PuertoJiménez
 *   SJO           240   165       175        180        255     330         240         290         360
 *   LIR                 160       270        180        395     470         420          90         500
 *   Arenal                        290        210        415     490         330         240         520
 *   ManuelAntonio                            220        140     215         390         300         245
 *   Monteverde                                          345     420         420         210         450
 *   Sierpe                                                       75         480         425         120
 *   DrakeBay                                                                555         500         195
 *   PuertoViejo                                                                         510         585
 *   Tamarindo                                                                                       530
 *
 * The type makes every pair required: adding a hub to HUB_IDS without its
 * times fails `npx tsc --noEmit`.
 * TODO(Jorge): confirm these against your real driving experience.
 */
type PairsAfter<T extends readonly string[]> = T extends readonly [
  infer H extends string,
  ...infer R extends string[],
]
  ? { [K in H]: Record<R[number], number> } & PairsAfter<R>
  : unknown;

const ROUTE_MINUTES: PairsAfter<typeof HUB_IDS> = {
  SJO: {
    LIR: 240,
    Arenal: 165,
    ManuelAntonio: 175,
    Monteverde: 180,
    Sierpe: 255,
    DrakeBay: 330,
    PuertoViejo: 240,
    Tamarindo: 290,
    PuertoJimenez: 360,
  },
  LIR: {
    Arenal: 160,
    ManuelAntonio: 270,
    Monteverde: 180,
    Sierpe: 395,
    DrakeBay: 470,
    PuertoViejo: 420,
    Tamarindo: 90,
    PuertoJimenez: 500,
  },
  Arenal: {
    ManuelAntonio: 290,
    Monteverde: 210, // around Lake Arenal via Tilarán
    Sierpe: 415,
    DrakeBay: 490,
    PuertoViejo: 330,
    Tamarindo: 240,
    PuertoJimenez: 520,
  },
  ManuelAntonio: { Monteverde: 220, Sierpe: 140, DrakeBay: 215, PuertoViejo: 390, Tamarindo: 300, PuertoJimenez: 245 },
  Monteverde: { Sierpe: 345, DrakeBay: 420, PuertoViejo: 420, Tamarindo: 210, PuertoJimenez: 450 },
  Sierpe: { DrakeBay: 75, PuertoViejo: 480, Tamarindo: 425, PuertoJimenez: 120 },
  DrakeBay: { PuertoViejo: 555, Tamarindo: 500, PuertoJimenez: 195 },
  PuertoViejo: { Tamarindo: 510, PuertoJimenez: 585 },
  Tamarindo: { PuertoJimenez: 530 },
  PuertoJimenez: {},
};

/** Safety net only (e.g. an unknown id in old data); every real pair is in the table. */
const FALLBACK_ROUTE_MINUTES = 240;

function pairValue(table: unknown, from: HubId, to: HubId): number | undefined {
  const [a, b] = HUB_IDS.indexOf(from) < HUB_IDS.indexOf(to) ? [from, to] : [to, from];
  return (table as Record<string, Record<string, number> | undefined>)[a]?.[b];
}

export function routeMinutes(from: HubId, to: HubId): number {
  if (from === to) return 0;
  return pairValue(ROUTE_MINUTES, from, to) ?? FALLBACK_ROUTE_MINUTES;
}

/**
 * Road kilometres between hubs, for the ride price formula (docs/PRICING.md §4).
 * Drake Bay is reached by road to Sierpe + the river boat, so its km are the
 * road km to Sierpe (the boat is priced separately). Daytrip's published
 * distances where they exist (COMPETITORS.md §2b), otherwise estimates by
 * main road. Replaced by Google Routes in build step 3.
 * TODO(Jorge): sanity-check the estimates.
 */
const ROUTE_KM: PairsAfter<typeof HUB_IDS> = {
  SJO: { LIR: 220, Arenal: 116, ManuelAntonio: 159, Monteverde: 132, Sierpe: 265, DrakeBay: 265, PuertoViejo: 232, Tamarindo: 273, PuertoJimenez: 370 },
  LIR: { Arenal: 144, ManuelAntonio: 255, Monteverde: 150, Sierpe: 370, DrakeBay: 370, PuertoViejo: 450, Tamarindo: 69, PuertoJimenez: 475 },
  Arenal: { ManuelAntonio: 235, Monteverde: 111, Sierpe: 350, DrakeBay: 350, PuertoViejo: 300, Tamarindo: 215, PuertoJimenez: 455 },
  ManuelAntonio: { Monteverde: 193, Sierpe: 113, DrakeBay: 113, PuertoViejo: 390, Tamarindo: 250, PuertoJimenez: 220 },
  Monteverde: { Sierpe: 306, DrakeBay: 306, PuertoViejo: 364, Tamarindo: 190, PuertoJimenez: 410 },
  Sierpe: { DrakeBay: 0, PuertoViejo: 440, Tamarindo: 363, PuertoJimenez: 135 },
  DrakeBay: { PuertoViejo: 440, Tamarindo: 363, PuertoJimenez: 135 },
  PuertoViejo: { Tamarindo: 500, PuertoJimenez: 545 },
  Tamarindo: { PuertoJimenez: 470 },
  PuertoJimenez: {},
};

/** Sierpe → Drake Bay river boat, included in ROUTE_MINUTES for Drake Bay pairs. */
export const DRAKE_BOAT_MINUTES = 75;

export function routeKm(from: HubId, to: HubId): number {
  if (from === to) return 0;
  return pairValue(ROUTE_KM, from, to) ?? 0;
}

/** Time behind the wheel (drive time without the Drake Bay boat), used for pricing. */
export function routeDrivingMinutes(from: HubId, to: HubId): number {
  const total = routeMinutes(from, to);
  const boat = from === "DrakeBay" || to === "DrakeBay" ? DRAKE_BOAT_MINUTES : 0;
  return Math.max(0, total - boat);
}

/** The Sierpe ↔ Drake Bay leg is the boat: no road stops on it. */
function isBoatLeg(from: HubId, to: HubId): boolean {
  return (from === "Sierpe" && to === "DrakeBay") || (from === "DrakeBay" && to === "Sierpe");
}

/**
 * Is this sightseeing stop offered on the ride from → to?
 * - A stop with two or more hubs sits on the road between them: offered only
 *   when BOTH the pickup and the drop-off are on its list.
 * - A stop with a single hub is in that town (e.g. the La Fortuna sloth
 *   trail): offered on any ride to or from it.
 * - Never on the Sierpe ↔ Drake Bay boat.
 * Shared by the ride builder, the route pages and the server re-check.
 * TODO(Jorge): confirm (PROJECT.md §9 #4).
 */
export function stopFitsRoute(stop: { corridors: readonly string[] }, from: HubId, to: HubId): boolean {
  if (from === to || isBoatLeg(from, to)) return false;
  if (stop.corridors.length === 1) return stop.corridors[0] === from || stop.corridors[0] === to;
  return stop.corridors.includes(from) && stop.corridors.includes(to);
}

export interface SightseeingStop {
  id: string;
  name: string;
  /** Time spent at the stop (the driver waits), minutes. */
  durationMin: number;
  /** Extra road km / minutes the stop adds to the ride, there and back (0 when it's on the way). */
  detourKm: number;
  detourMin: number;
  /**
   * The tour part of the stop, per traveller: guide, entrance, activity (0 for a plain
   * stop). Priced per person like Jorge's tours on costaricatravelplanner.com.
   */
  tourPerPersonCents: number;
  /**
   * The driver's part of the stop's price in cents (waiting + detour), computed by
   * stopPriceCents() from the inputs above and the live rates; never typed by hand
   * since 2026-11-09. The full price for a group is stopTotalCents(stop, pax).
   */
  priceCents: number;
  description: string;
  /**
   * Hubs this stop sits between: offered when both the pickup and the
   * drop-off are listed (a single hub = a stop in that town). See stopFitsRoute().
   */
  corridors: HubId[];
  /**
   * Entrance at this stop (sightseeing_stops.entrance, chosen in /admin/pricing):
   * free (no ticket, e.g. a roadside bridge), included in our stop price, or paid at the gate.
   */
  entrance: StopEntrance;
}

export type StopEntrance = "free" | "included" | "gate";
export const STOP_ENTRANCES: StopEntrance[] = ["free", "included", "gate"];

/** Customer-facing wording on stop cards. */
export const ENTRANCE_LABEL: Record<StopEntrance, string> = {
  free: "Free stop, no entrance fee",
  included: "Park entrance included",
  gate: "Park entrance paid at the gate",
};

/** Admin dropdown wording. */
export const ENTRANCE_ADMIN_LABEL: Record<StopEntrance, string> = {
  free: "Free, no ticket needed",
  included: "Included in our stop price",
  gate: "Customer pays at the gate",
};

export function isStopEntrance(v: unknown): v is StopEntrance {
  return typeof v === "string" && (STOP_ENTRANCES as string[]).includes(v);
}

/**
 * Corridors (both ends must be listed, see stopFitsRoute). Kept in sync with
 * migration 20261108000011_stop_corridors.sql; the live lists are in the
 * database (sightseeing_stops.corridors) and edited at /admin/pricing.
 * - Tárcoles / Carara sit on Route 34 just south of the Route 27 exit:
 *   SJO or Monteverde ↔ Manuel Antonio / Sierpe / Drake Bay.
 * - Poás: on the scenic SJO ↔ La Fortuna road (Vara Blanca).
 * - Río Celeste: Bijagua, on the Arenal ↔ Liberia road (Route 4 / 6).
 * - Sloth trail: in La Fortuna itself, so any ride to or from Arenal.
 */
const STOPS_WITHOUT_PRICE: Omit<SightseeingStop, "priceCents">[] = [
  {
    id: "tarcoles",
    name: "Tárcoles Crocodile Bridge",
    durationMin: 45,
    detourKm: 0,
    detourMin: 0,
    tourPerPersonCents: 0,
    description:
      "Watch 15-ft American crocodiles from the famous bridge while your driver stays with the bags.",
    corridors: ["SJO", "Monteverde", "ManuelAntonio", "Sierpe", "DrakeBay"],
    entrance: "free",
  },
  {
    id: "carara",
    name: "Carara National Park Scarlet Macaw Walk",
    durationMin: 90,
    detourKm: 2,
    detourMin: 5,
    tourPerPersonCents: 4500,
    description:
      "Guided trail walk through transitional rainforest full of wild scarlet macaws.",
    corridors: ["SJO", "Monteverde", "ManuelAntonio", "Sierpe", "DrakeBay"],
    entrance: "gate",
  },
  {
    id: "poas",
    name: "Poás Volcano Crater & Doka Coffee Estate",
    durationMin: 120,
    detourKm: 24,
    detourMin: 40,
    tourPerPersonCents: 5500,
    description:
      "Peer into an active turquoise crater lake, then sample highland Arabica coffee. Timed-entry tickets required.",
    corridors: ["SJO", "Arenal"],
    entrance: "gate",
  },
  {
    id: "rioceleste",
    name: "Río Celeste Waterfall Hike",
    durationMin: 120,
    detourKm: 18,
    detourMin: 35,
    tourPerPersonCents: 3500,
    description:
      "Hike to the sky-blue river inside Tenorio Volcano National Park.",
    corridors: ["Arenal", "LIR"],
    entrance: "gate",
  },
  {
    id: "sloth",
    name: "La Fortuna Sloth & Wildlife Sanctuary Trail",
    durationMin: 75,
    detourKm: 0,
    detourMin: 0,
    tourPerPersonCents: 3000,
    description:
      "Spot two- and three-toed sloths on a guided boardwalk trail near La Fortuna.",
    corridors: ["Arenal"],
    entrance: "gate",
  },
];

export interface VehicleClass {
  id: string;
  /** Short category name, without model names ("Executive 4x4"). */
  name: string;
  /**
   * Example models for the category ("Toyota Prado"), or "" for none. Travellers always
   * see it through orSimilar() ("Toyota Prado or similar"): an example, never a promise
   * of a specific model. Edited in /admin/pricing (vehicle_classes.example_models).
   */
  exampleModels: string;
  /** Multiplies the Standard ride price, in basis points (10000 = 1.00×). */
  priceFactorBps: number;
  /** Fixed amount added per ride, e.g. the Sierpe boat in the combo. */
  extraFeeCents: number;
  /** Economy is a direct ride: no sightseeing stops. */
  allowsStops: boolean;
  /** Economy: Spanish-speaking driver (basic English at most). */
  spanishSpeakingDriver: boolean;
  maxPax: number;
  luggage: string;
  badge: string;
  /** Only offered on routes touching these hubs. Empty = all routes. */
  onlyForHubs?: HubId[];
}

/**
 * "Toyota Prado or similar" / "Toyota Prado o similar", or "" when the category has no
 * example. The only way example models reach a traveller, so the words "or similar" can
 * never be missing. If the text typed in /admin/pricing already ends with them, they are
 * not repeated.
 */
export function orSimilar(exampleModels: string | null | undefined, lang: "en" | "es" = "en"): string {
  const models = (exampleModels ?? "").trim().replace(/[\s,.;]*\b(or|o) similar(es)?\.?$/i, "").trim();
  if (!models) return "";
  return `${models} ${lang === "es" ? "o similar" : "or similar"}`;
}

export const VEHICLE_CLASSES: VehicleClass[] = [
  {
    id: "economy",
    name: "Economy Sedan",
    exampleModels: "Toyota Yaris",
    priceFactorBps: 9000,
    extraFeeCents: 0,
    allowsStops: false,
    spanishSpeakingDriver: true,
    maxPax: 3,
    luggage: "3 suitcases",
    badge: "Spanish-speaking driver · direct ride",
  },
  {
    id: "sedan",
    name: "Standard Sedan",
    exampleModels: "Toyota Corolla",
    priceFactorBps: 10000,
    extraFeeCents: 0,
    allowsStops: true,
    spanishSpeakingDriver: false,
    maxPax: 3,
    luggage: "3 suitcases",
    badge: "Best value",
  },
  {
    // The 4-traveller class is a minivan / MPV (Jorge, 2026-11-11): a compact SUV has a
    // sedan-size boot, so it drives the sedan classes. The id stays "suv" because bookings,
    // quotes and saved prices use it (docs/PROJECT.md §5.3).
    id: "suv",
    name: "Minivan (MPV)",
    exampleModels: "Mitsubishi Xpander",
    priceFactorBps: 12000,
    extraFeeCents: 0,
    allowsStops: true,
    spanishSpeakingDriver: false,
    maxPax: 4,
    luggage: "4 suitcases",
    badge: "Roomy for 4 + bags",
  },
  {
    id: "4x4",
    name: "Executive 4x4",
    exampleModels: "Toyota Prado",
    priceFactorBps: 13000,
    extraFeeCents: 0,
    allowsStops: true,
    spanishSpeakingDriver: false,
    maxPax: 4,
    luggage: "4 suitcases",
    badge: "Osa / Monteverde roads",
  },
  {
    id: "van",
    name: "Private Van",
    exampleModels: "Toyota HiAce",
    priceFactorBps: 13500,
    extraFeeCents: 0,
    allowsStops: true,
    spanishSpeakingDriver: false,
    maxPax: 10,
    luggage: "10 suitcases",
    badge: "Families & groups",
  },
  {
    id: "sierpe_combo",
    name: "4x4 Transfer + Sierpe River Boat",
    exampleModels: "Toyota Prado",
    priceFactorBps: 13000,
    extraFeeCents: 7500, // Sierpe river boat
    allowsStops: true,
    spanishSpeakingDriver: false,
    maxPax: 4,
    luggage: "Wet/dry assist",
    badge: "Drake Bay / Corcovado",
    onlyForHubs: ["Sierpe", "DrakeBay"],
  },
];

export type Region = "Arenal" | "ManuelAntonio" | "Osa" | "Monteverde";

/** Airport hubs: pickups there get flight tracking and the wait starts when the flight lands. */
export const AIRPORT_HUBS: readonly HubId[] = ["SJO", "LIR"];

/**
 * Which tour region a ride's drop-off is in, for "while you're there" suggestions
 * after a ride is added. Hubs without a region (airports, Tamarindo, Puerto Viejo)
 * fall back to the first tours in the catalog order.
 */
export const HUB_REGION: Partial<Record<HubId, Region>> = {
  Arenal: "Arenal",
  ManuelAntonio: "ManuelAntonio",
  Monteverde: "Monteverde",
  Sierpe: "Osa",
  DrakeBay: "Osa",
  PuertoJimenez: "Osa",
};

export const REGION_NAMES: Record<Region, string> = {
  Arenal: "La Fortuna / Arenal",
  ManuelAntonio: "Manuel Antonio / Central Pacific",
  Osa: "Osa Peninsula / Sierpe / Drake Bay / Puerto Jiménez",
  Monteverde: "Monteverde & Río Celeste",
};

/** Per-person prices by group size (Jorge, 2026-11-09, like his tours): 1 / 2–3 / 4 or more travellers. */
export interface PerPersonTiers {
  soloCents: number;
  smallCents: number;
  groupCents: number;
}

export interface DayTour {
  id: string;
  region: Region;
  name: string;
  durationHours: number;
  /** Private vehicle, guide, entrances and lunch, per person, by group size. */
  perPerson: PerPersonTiers;
  /** What the company pays per traveller (entrances, lunch, activities); deducted before the driver's share. */
  costPerPersonCents: number;
  highlights: string[];
  /** Per-tour Smart En-Route price; falls back to EN_ROUTE_UPGRADE_CENTS. */
  enRouteUpgradeCents?: number;
}

export const EN_ROUTE_UPGRADE_CENTS = 6500;

/** The per-person rate that applies to a group of `pax`. */
export function perPersonTierCents(t: PerPersonTiers, pax: number): number {
  if (pax <= 1) return t.soloCents;
  if (pax <= 3) return t.smallCents;
  return t.groupCents;
}

/** What a group of `pax` pays for a day tour (before the en-route upgrade and the season). */
export function dayTourCents(tour: Pick<DayTour, "perPerson">, pax: number): number {
  const n = Math.max(1, pax);
  return perPersonTierCents(tour.perPerson, n) * n;
}

export const DAY_TOURS: DayTour[] = [
  {
    id: "dt1",
    region: "Arenal",
    name: "Arenal Volcano 1968 Lava Trails, La Fortuna Waterfall & Hot Springs",
    durationHours: 8,
    perPerson: { soloCents: 35000, smallCents: 29500, groupCents: 27500 },
    costPerPersonCents: 9500,
    highlights: ["Lava-field trails", "La Fortuna Waterfall", "Hot springs soak"],
  },
  {
    id: "dt2",
    region: "ManuelAntonio",
    name: "Manuel Antonio National Park Wildlife Walk + Catamaran Snorkel",
    durationHours: 7.5,
    perPerson: { soloCents: 33000, smallCents: 28000, groupCents: 26000 },
    costPerPersonCents: 11000,
    highlights: ["Naturalist guide & scope", "Sloths, monkeys, toucans", "Afternoon catamaran"],
  },
  {
    id: "dt3",
    region: "Osa",
    name: "Sierpe Mangrove Boat Safari & Caño Island Snorkeling",
    durationHours: 7,
    perPerson: { soloCents: 37500, smallCents: 30000, groupCents: 27500 },
    costPerPersonCents: 14000,
    highlights: ["Mangrove wildlife", "Caño Island reef", "Dolphins in season"],
  },
  {
    id: "dt4",
    region: "Monteverde",
    name: "Monteverde Hanging Bridges, Zipline & Night Walk",
    durationHours: 7,
    perPerson: { soloCents: 28000, smallCents: 23000, groupCents: 21000 },
    costPerPersonCents: 12500,
    highlights: ["Cloud-forest canopy", "Zipline", "Guided night walk"],
  },
];

/**
 * Multi-day trips ("expeditions") were retired on 2026-11-11 (Jorge: transfers and 1-day tours
 * only). They are no longer sold, priced or shown on the website. This list only lets bookings
 * made before then still show their name and length (admin, driver and traveller trip pages,
 * the trip chat). The database rows are kept, inactive (migration 0043).
 */
export interface RetiredExpedition {
  id: string;
  name: string;
  nameEs: string;
  days: number;
}

export const RETIRED_EXPEDITIONS: RetiredExpedition[] = [
  {
    id: "md1",
    name: "Corcovado National Park — Overnight at Sirena Station (via Sierpe)",
    nameEs: "Parque Nacional Corcovado — noche en la Estación Sirena (vía Sierpe)",
    days: 3,
  },
  {
    id: "md2",
    name: "Classic Costa Rica Trifecta: Arenal, Monteverde & Manuel Antonio",
    nameEs: "La trilogía clásica de Costa Rica: Arenal, Monteverde y Manuel Antonio",
    days: 7,
  },
];

/** Lodging levels of the retired multi-day trips, for old bookings (bookings.lodging_tier). */
export const RETIRED_LODGING_TIERS: Record<string, { en: string; es: string }> = {
  base: { en: "Base (ranger station / standard)", es: "Básico (estación de guardaparques / estándar)" },
  boutique: { en: "4-star boutique eco-resort", es: "Eco-resort boutique de 4 estrellas" },
  luxury: { en: "5-star luxury lodge", es: "Lodge de lujo de 5 estrellas" },
};

/**
 * Name of a booked tour (catalog_item_id): a current day tour, else a retired multi-day trip,
 * else null. `dayTours` may be the localized list; `lang` picks the retired trip's name.
 */
export function bookedItemName(
  dayTours: { id: string; name: string }[],
  id: string | null | undefined,
  lang: "en" | "es" = "en",
): string | null {
  if (!id) return null;
  const tour = dayTours.find((t) => t.id === id);
  if (tour) return tour.name;
  const old = RETIRED_EXPEDITIONS.find((e) => e.id === id);
  return old ? (lang === "es" ? old.nameEs : old.name) : null;
}

export interface Season {
  id: string;
  name: string;
  /** Stored as basis points: 10000 = 1.00x, 11500 = 1.15x */
  multiplierBps: number;
}

export const SEASONS: Season[] = [
  { id: "green", name: "Green season", multiplierBps: 10000 },
  { id: "high", name: "High season (Dec–Apr)", multiplierBps: 11500 },
  { id: "peak", name: "Peak holiday (Christmas / New Year / Easter)", multiplierBps: 12500 },
];

/**
 * Cash booking fee when the traveller pays the driver in cash, in basis points
 * of the ride / day-tour price (1000 = 10%). Built-in fallback only: the live
 * value is pricing_settings.cash_fee_bps, edited at /admin/pricing.
 */
export const CASH_FEE_BPS_DEFAULT = 1000;

/** Ride price formula, Standard class (Jorge, 2026-11-09; docs/PRICING.md §4.2). Edited at /admin/pricing. */
export interface RideFormula {
  baseFareCents: number;
  perKmCents: number;
  perHourCents: number;
  minimumFareCents: number;
}

/**
 * Price level (Jorge, 2026-11-09): on par with, or a few dollars under, Daytrip's lowest
 * published prices, so partner drivers earn a proper rate. SJO → La Fortuna $162 (Daytrip
 * $161), SJO → Manuel Antonio $202 ($205), SJO → Tamarindo $324 ($338). Live values:
 * pricing_settings (migration 0016), edited at /admin/pricing.
 */
export const RIDE_FORMULA_DEFAULT: RideFormula = {
  baseFareCents: 3000,
  perKmCents: 90,
  perHourCents: 1000,
  minimumFareCents: 12000,
};

/** USD per hour the driver waits at a stop (Jorge, 2026-11-09: $20). Live value: pricing_settings.wait_per_hour. */
export const WAIT_PER_HOUR_CENTS_DEFAULT = 2000;

/**
 * The driver's part of a sightseeing stop (docs/PRICING.md §5, built 2026-11-09):
 *   waiting time × wait rate + detour km × per-km + detour minutes × per-hour,
 * rounded to whole dollars. The tour part (guide, entrance, activity) is per person,
 * see stopTotalCents(). Park entrance labels are separate (free / included / gate).
 */
export function stopPriceCents(
  stop: Pick<SightseeingStop, "durationMin" | "detourKm" | "detourMin">,
  formula: Pick<RideFormula, "perKmCents" | "perHourCents"> = RIDE_FORMULA_DEFAULT,
  waitPerHourCents: number = WAIT_PER_HOUR_CENTS_DEFAULT,
): number {
  const raw =
    (waitPerHourCents * stop.durationMin) / 60 + formula.perKmCents * stop.detourKm + (formula.perHourCents * stop.detourMin) / 60;
  return Math.round(raw / 100) * 100;
}

/** What a group of `pax` pays for a stop: the driver's part + the tour part per person. */
export function stopTotalCents(stop: Pick<SightseeingStop, "priceCents" | "tourPerPersonCents">, pax: number): number {
  return stop.priceCents + stop.tourPerPersonCents * Math.max(1, pax);
}

/** Built-in stops with their prices at the default rates (the live catalog recomputes them). */
export const SIGHTSEEING_STOPS: SightseeingStop[] = STOPS_WITHOUT_PRICE.map((s) => ({ ...s, priceCents: stopPriceCents(s) }));

/**
 * Pricing areas that aren't one of our towns (docs/PRICING.md §4.4). A typed place
 * inside one gets its area factor whether it is the pickup or the drop-off, but only
 * when the route takes the ferry: the factor pays for the queue and the driver's
 * crossing back. Shapes are in src/lib/places.ts.
 */
export const EXTRA_AREAS = [
  { id: "SouthNicoya", name: "Southern Nicoya (Santa Teresa, Montezuma, Paquera)" },
] as const;

export type ExtraAreaId = (typeof EXTRA_AREAS)[number]["id"];
export type AreaId = HubId | ExtraAreaId;
export const AREA_IDS: readonly AreaId[] = [...HUB_IDS, ...EXTRA_AREAS.map((a) => a.id)];

/**
 * Area factors (basis points): a town's applies to rides that start there (drivers are
 * scarcer in Guanacaste and Osa); an extra area's applies to ferry rides starting or ending in it.
 * Southern Nicoya 1.35 (Jorge, 2026-11-09): ferry queues and the driver's crossing back,
 * putting SJO → Santa Teresa a few dollars under Daytrip ($346 vs $356, 2 pax, ferry included).
 */
export const AREA_FACTOR_BPS_DEFAULT: Record<AreaId, number> = {
  SJO: 10000,
  LIR: 11000,
  Arenal: 10000,
  ManuelAntonio: 10000,
  Monteverde: 10000,
  Sierpe: 11500,
  DrakeBay: 11500,
  PuertoViejo: 10000,
  Tamarindo: 11000,
  PuertoJimenez: 11500,
  SouthNicoya: 13500,
};

/**
 * Car ferries across the Gulf of Nicoya (Puntarenas ↔ Paquera / Playa Naranjo), per
 * crossing, in colones as the ferry company charges them: about ₡15,000 for the vehicle
 * with its driver and ₡1,500 per passenger (Jorge, 2026-11-09). Converted to dollars at
 * the exchange rate below when a ride is priced, and added on top of the ride price (no
 * season multiplier) for every ferry on Google's route. Edited at /admin/pricing.
 */
export interface FerryFares {
  vehicleCrc: number;
  passengerCrc: number;
}

export const FERRY_FARES_DEFAULT: FerryFares = { vehicleCrc: 15000, passengerCrc: 1500 };

/**
 * Colones per US dollar, for the ferry fares. Jorge checks it about once a week
 * (≈ ₡452 on 2026-11-09) and updates it at /admin/pricing; live value pricing_settings.crc_per_usd.
 */
export const CRC_PER_USD_DEFAULT = 452;

/** Whole US cents for an amount in colones. */
export function crcToCents(crc: number, crcPerUsd: number): number {
  return Math.round((crc / crcPerUsd) * 100);
}

/**
 * WhatsApp number for the concierge buttons (digits only, with country code).
 * Set NEXT_PUBLIC_WHATSAPP_NUMBER in Vercel before launch; until then the
 * buttons open the placeholder below and a warning is logged at build time.
 */
// Fake number for testing (Jorge, 2026-11-09). Replace by setting the real one in Vercel before launch.
const WHATSAPP_PLACEHOLDER = "50665000000";
function resolveWhatsAppNumber(): string {
  const raw = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/[^\d]/g, "");
  if (/^\d{8,15}$/.test(raw)) return raw;
  if (typeof window === "undefined") {
    console.warn(
      "[PuraVidaWay] NEXT_PUBLIC_WHATSAPP_NUMBER is missing or invalid; WhatsApp buttons use a placeholder number.",
    );
  }
  return WHATSAPP_PLACEHOLDER;
}
export const WHATSAPP_NUMBER = resolveWhatsAppNumber();
export const WHATSAPP_CONFIGURED = WHATSAPP_NUMBER !== WHATSAPP_PLACEHOLDER;
