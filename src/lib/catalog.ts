/**
 * PuraVidaWay catalog — source: docs/PROJECT.md §5.
 *
 * Phase 2a: static TypeScript data so the storefront works end to end.
 * Phase 2b: these move to Supabase tables (sightseeing_stops, vehicle_classes,
 * day_tours, expeditions, lodging_tiers, seasons) and the admin pricing manager.
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
];

/**
 * Door-to-door times in minutes between every pair of hubs (all 36 pairs), for
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
 *
 *                 LIR  Arenal  ManuelAnt  Monteverde  Sierpe  DrakeBay  PuertoViejo  Tamarindo
 *   SJO           240   165       175        180        255     330         240         290
 *   LIR                 160       270        180        395     470         420          90
 *   Arenal                        290        210        415     490         330         240
 *   ManuelAntonio                            220        140     215         390         300
 *   Monteverde                                          345     420         420         210
 *   Sierpe                                                       75         480         425
 *   DrakeBay                                                                555         500
 *   PuertoViejo                                                                         510
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
  },
  LIR: {
    Arenal: 160,
    ManuelAntonio: 270,
    Monteverde: 180,
    Sierpe: 395,
    DrakeBay: 470,
    PuertoViejo: 420,
    Tamarindo: 90,
  },
  Arenal: {
    ManuelAntonio: 290,
    Monteverde: 210, // around Lake Arenal via Tilarán
    Sierpe: 415,
    DrakeBay: 490,
    PuertoViejo: 330,
    Tamarindo: 240,
  },
  ManuelAntonio: { Monteverde: 220, Sierpe: 140, DrakeBay: 215, PuertoViejo: 390, Tamarindo: 300 },
  Monteverde: { Sierpe: 345, DrakeBay: 420, PuertoViejo: 420, Tamarindo: 210 },
  Sierpe: { DrakeBay: 75, PuertoViejo: 480, Tamarindo: 425 },
  DrakeBay: { PuertoViejo: 555, Tamarindo: 500 },
  PuertoViejo: { Tamarindo: 510 },
  Tamarindo: {},
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
  SJO: { LIR: 220, Arenal: 116, ManuelAntonio: 159, Monteverde: 132, Sierpe: 265, DrakeBay: 265, PuertoViejo: 232, Tamarindo: 273 },
  LIR: { Arenal: 144, ManuelAntonio: 255, Monteverde: 150, Sierpe: 370, DrakeBay: 370, PuertoViejo: 450, Tamarindo: 69 },
  Arenal: { ManuelAntonio: 235, Monteverde: 111, Sierpe: 350, DrakeBay: 350, PuertoViejo: 300, Tamarindo: 215 },
  ManuelAntonio: { Monteverde: 193, Sierpe: 113, DrakeBay: 113, PuertoViejo: 390, Tamarindo: 250 },
  Monteverde: { Sierpe: 306, DrakeBay: 306, PuertoViejo: 364, Tamarindo: 190 },
  Sierpe: { DrakeBay: 0, PuertoViejo: 440, Tamarindo: 363 },
  DrakeBay: { PuertoViejo: 440, Tamarindo: 363 },
  PuertoViejo: { Tamarindo: 500 },
  Tamarindo: {},
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
  durationMin: number;
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
export const SIGHTSEEING_STOPS: SightseeingStop[] = [
  {
    id: "tarcoles",
    name: "Tárcoles Crocodile Bridge",
    durationMin: 45,
    priceCents: 2500,
    description:
      "Watch 15-ft American crocodiles from the famous bridge while your driver stays with the bags.",
    corridors: ["SJO", "Monteverde", "ManuelAntonio", "Sierpe", "DrakeBay"],
    entrance: "free",
  },
  {
    id: "carara",
    name: "Carara National Park Scarlet Macaw Walk",
    durationMin: 90,
    priceCents: 5500,
    description:
      "Guided trail walk through transitional rainforest full of wild scarlet macaws.",
    corridors: ["SJO", "Monteverde", "ManuelAntonio", "Sierpe", "DrakeBay"],
    entrance: "gate",
  },
  {
    id: "poas",
    name: "Poás Volcano Crater & Doka Coffee Estate",
    durationMin: 120,
    priceCents: 6800,
    description:
      "Peer into an active turquoise crater lake, then sample highland Arabica coffee. Timed-entry tickets required.",
    corridors: ["SJO", "Arenal"],
    entrance: "gate",
  },
  {
    id: "rioceleste",
    name: "Río Celeste Waterfall Hike",
    durationMin: 120,
    priceCents: 6500,
    description:
      "Hike to the sky-blue river inside Tenorio Volcano National Park.",
    corridors: ["Arenal", "LIR"],
    entrance: "gate",
  },
  {
    id: "sloth",
    name: "La Fortuna Sloth & Wildlife Sanctuary Trail",
    durationMin: 75,
    priceCents: 4800,
    description:
      "Spot two- and three-toed sloths on a guided boardwalk trail near La Fortuna.",
    corridors: ["Arenal"],
    entrance: "gate",
  },
];

export interface VehicleClass {
  id: string;
  name: string;
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

export const VEHICLE_CLASSES: VehicleClass[] = [
  {
    id: "economy",
    name: "Economy Sedan",
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
    priceFactorBps: 10000,
    extraFeeCents: 0,
    allowsStops: true,
    spanishSpeakingDriver: false,
    maxPax: 3,
    luggage: "3 suitcases",
    badge: "Best value",
  },
  {
    id: "suv",
    name: "Standard Comfort SUV",
    priceFactorBps: 12000,
    extraFeeCents: 0,
    allowsStops: true,
    spanishSpeakingDriver: false,
    maxPax: 4,
    luggage: "4 suitcases",
    badge: "Most popular",
  },
  {
    id: "4x4",
    name: "Executive 4x4 (Prado / Fortuner)",
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
    name: "Private Toyota HiAce / Hyundai Staria",
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
 * fall back to the first tours / expeditions in the catalog order.
 */
export const HUB_REGION: Partial<Record<HubId, Region>> = {
  Arenal: "Arenal",
  ManuelAntonio: "ManuelAntonio",
  Monteverde: "Monteverde",
  Sierpe: "Osa",
  DrakeBay: "Osa",
};

/** Regions each expedition starts in or passes through (expeditions have no region column). */
export const EXPEDITION_REGIONS: Record<string, Region[]> = {
  md1: ["Osa"],
  md2: ["Arenal", "Monteverde", "ManuelAntonio"],
};

export const REGION_NAMES: Record<Region, string> = {
  Arenal: "La Fortuna / Arenal",
  ManuelAntonio: "Manuel Antonio / Central Pacific",
  Osa: "Osa Peninsula / Sierpe / Drake Bay",
  Monteverde: "Monteverde & Río Celeste",
};

export interface DayTour {
  id: string;
  region: Region;
  name: string;
  durationHours: number;
  priceCents: number;
  highlights: string[];
  /** Per-tour Smart En-Route price; falls back to EN_ROUTE_UPGRADE_CENTS. */
  enRouteUpgradeCents?: number;
}

export const EN_ROUTE_UPGRADE_CENTS = 6500;

export const DAY_TOURS: DayTour[] = [
  {
    id: "dt1",
    region: "Arenal",
    name: "Arenal Volcano 1968 Lava Trails, La Fortuna Waterfall & Hot Springs",
    durationHours: 8,
    priceCents: 14500,
    highlights: ["Lava-field trails", "La Fortuna Waterfall", "Hot springs soak"],
  },
  {
    id: "dt2",
    region: "ManuelAntonio",
    name: "Manuel Antonio National Park Wildlife Walk + Catamaran Snorkel",
    durationHours: 7.5,
    priceCents: 15500,
    highlights: ["Naturalist guide & scope", "Sloths, monkeys, toucans", "Afternoon catamaran"],
  },
  {
    id: "dt3",
    region: "Osa",
    name: "Sierpe Mangrove Boat Safari & Caño Island Snorkeling",
    durationHours: 7,
    priceCents: 16500,
    highlights: ["Mangrove wildlife", "Caño Island reef", "Dolphins in season"],
  },
  {
    id: "dt4",
    region: "Monteverde",
    name: "Monteverde Hanging Bridges, Zipline & Night Walk",
    durationHours: 7,
    priceCents: 14000,
    highlights: ["Cloud-forest canopy", "Zipline", "Guided night walk"],
  },
];

export interface LodgingTier {
  id: string;
  name: string;
  surchargeCents: number;
  /** Only offered on this expedition; undefined = all expeditions. */
  expeditionId?: string;
}

export const LODGING_TIERS: LodgingTier[] = [
  { id: "base", name: "Base (ranger station / standard)", surchargeCents: 0 },
  { id: "boutique", name: "4-star boutique eco-resort", surchargeCents: 28000 },
  { id: "luxury", name: "5-star luxury lodge", surchargeCents: 65000 },
];

export interface Expedition {
  id: string;
  name: string;
  days: number;
  nights: number;
  basePriceCents: number;
  includes: string[];
  itinerary: { day: number; title: string }[];
}

export const EXPEDITIONS: Expedition[] = [
  {
    id: "md1",
    name: "Corcovado National Park — Overnight at Sirena Station (via Sierpe)",
    days: 3,
    nights: 2,
    basePriceCents: 69500,
    includes: [
      "Sierpe → Drake Bay → Sirena boat transfers",
      "Official SINAC overnight permits",
      "Meals at Sirena Ranger Station",
      "Certified Osa naturalist guide",
    ],
    itinerary: [
      { day: 1, title: "Sierpe mangroves → Drake Bay, sunset on the beach" },
      { day: 2, title: "Boat to Sirena, full day of trails, overnight in the park" },
      { day: 3, title: "Dawn wildlife walk, boat back to Sierpe" },
    ],
  },
  {
    id: "md2",
    name: "Classic Costa Rica Trifecta: Arenal, Monteverde & Manuel Antonio",
    days: 7,
    nights: 6,
    basePriceCents: 129000,
    includes: [
      "Door-to-door sightseeing transfers",
      "Lake Arenal boat crossing",
      "Monteverde hanging bridges",
      "Manuel Antonio guided tour",
      "24/7 WhatsApp concierge",
    ],
    itinerary: [
      { day: 1, title: "SJO → La Fortuna with Poás Volcano stop" },
      { day: 2, title: "Arenal lava trails & hot springs" },
      { day: 3, title: "Lake Arenal boat crossing → Monteverde" },
      { day: 4, title: "Hanging bridges, zipline & night walk" },
      { day: 5, title: "Monteverde → Manuel Antonio with Tárcoles stop" },
      { day: 6, title: "Manuel Antonio NP wildlife walk & catamaran" },
      { day: 7, title: "Manuel Antonio → SJO" },
    ],
  },
];

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

export const RIDE_FORMULA_DEFAULT: RideFormula = {
  baseFareCents: 3500,
  perKmCents: 70,
  perHourCents: 1200,
  minimumFareCents: 11000,
};

/** Area factor of the pickup town (basis points): drivers are scarcer in Guanacaste and Osa. */
export const AREA_FACTOR_BPS_DEFAULT: Record<HubId, number> = {
  SJO: 10000,
  LIR: 11000,
  Arenal: 10000,
  ManuelAntonio: 10000,
  Monteverde: 10000,
  Sierpe: 11500,
  DrakeBay: 11500,
  PuertoViejo: 10000,
  Tamarindo: 11000,
};

/**
 * WhatsApp number for the concierge buttons (digits only, with country code).
 * Set NEXT_PUBLIC_WHATSAPP_NUMBER in Vercel before launch; until then the
 * buttons open the placeholder below and a warning is logged at build time.
 */
const WHATSAPP_PLACEHOLDER = "50600000000";
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
