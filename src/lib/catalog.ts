/**
 * PuraVidaWay catalog — source: docs/PROJECT.md §5.
 *
 * Phase 2a: static TypeScript data so the storefront works end to end.
 * Phase 2b: these move to Supabase tables (sightseeing_stops, vehicle_classes,
 * day_tours, expeditions, lodging_tiers, seasons) and the admin pricing manager.
 *
 * All prices are USD, stored in whole cents to avoid floating-point errors.
 */

export type HubId =
  | "SJO"
  | "LIR"
  | "Arenal"
  | "ManuelAntonio"
  | "Monteverde"
  | "Sierpe"
  | "DrakeBay"
  | "PuertoViejo"
  | "Tamarindo";

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
 * Realistic driving times in minutes between hubs (mountain roads, not
 * straight-line). Symmetric; missing pairs fall back to DEFAULT_ROUTE_MINUTES.
 * TODO(Jorge): confirm these against your real driving experience.
 */
const ROUTE_MINUTES: Partial<Record<HubId, Partial<Record<HubId, number>>>> = {
  SJO: {
    Arenal: 180,
    ManuelAntonio: 180,
    Monteverde: 195,
    Sierpe: 300,
    DrakeBay: 360,
    PuertoViejo: 270,
    Tamarindo: 300,
    LIR: 270,
  },
  LIR: { Arenal: 180, Monteverde: 180, Tamarindo: 75, ManuelAntonio: 300 },
  Arenal: { ManuelAntonio: 300, Monteverde: 210, Tamarindo: 240 },
  ManuelAntonio: { Monteverde: 300, Sierpe: 180, DrakeBay: 240 },
  Monteverde: { Tamarindo: 210 },
  Sierpe: { DrakeBay: 60 },
};
const DEFAULT_ROUTE_MINUTES = 240;

export function routeMinutes(from: HubId, to: HubId): number {
  if (from === to) return 0;
  return (
    ROUTE_MINUTES[from]?.[to] ?? ROUTE_MINUTES[to]?.[from] ?? DEFAULT_ROUTE_MINUTES
  );
}

export interface SightseeingStop {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
  description: string;
  /** Hubs this stop sits between / near. Shown when origin or destination matches. */
  corridors: HubId[];
}

export const SIGHTSEEING_STOPS: SightseeingStop[] = [
  {
    id: "tarcoles",
    name: "Tárcoles Crocodile Bridge",
    durationMin: 45,
    priceCents: 2500,
    description:
      "Watch 15-ft American crocodiles from the famous bridge while your driver stays with the bags.",
    corridors: ["SJO", "ManuelAntonio", "Sierpe", "DrakeBay"],
  },
  {
    id: "carara",
    name: "Carara National Park Scarlet Macaw Walk",
    durationMin: 90,
    priceCents: 5500,
    description:
      "Guided trail walk through transitional rainforest full of wild scarlet macaws.",
    corridors: ["SJO", "ManuelAntonio", "Sierpe", "DrakeBay"],
  },
  {
    id: "poas",
    name: "Poás Volcano Crater & Doka Coffee Estate",
    durationMin: 120,
    priceCents: 6800,
    description:
      "Peer into an active turquoise crater lake, then sample highland Arabica coffee. Timed-entry tickets required.",
    corridors: ["SJO", "Arenal"],
  },
  {
    id: "rioceleste",
    name: "Río Celeste Waterfall Hike",
    durationMin: 120,
    priceCents: 6500,
    description:
      "Hike to the sky-blue river inside Tenorio Volcano National Park.",
    corridors: ["Arenal", "LIR", "Tamarindo"],
  },
  {
    id: "sloth",
    name: "La Fortuna Sloth & Wildlife Sanctuary Trail",
    durationMin: 75,
    priceCents: 4800,
    description:
      "Spot two- and three-toed sloths on a guided boardwalk trail near La Fortuna.",
    corridors: ["Arenal"],
  },
];

export interface VehicleClass {
  id: string;
  name: string;
  baseRateCents: number;
  maxPax: number;
  luggage: string;
  badge: string;
  /** Only offered on routes touching these hubs. Empty = all routes. */
  onlyForHubs?: HubId[];
}

export const VEHICLE_CLASSES: VehicleClass[] = [
  {
    id: "suv",
    name: "Standard Comfort SUV",
    baseRateCents: 17500,
    maxPax: 4,
    luggage: "4 suitcases",
    badge: "Most popular",
  },
  {
    id: "4x4",
    name: "Executive 4x4 (Prado / Fortuner)",
    baseRateCents: 21500,
    maxPax: 4,
    luggage: "4 suitcases",
    badge: "Osa / Monteverde roads",
  },
  {
    id: "van",
    name: "Private Toyota HiAce / Hyundai Staria",
    baseRateCents: 24500,
    maxPax: 10,
    luggage: "10 suitcases",
    badge: "Families & groups",
  },
  {
    id: "sierpe_combo",
    name: "4x4 Transfer + Sierpe River Boat",
    baseRateCents: 29000,
    maxPax: 4,
    luggage: "Wet/dry assist",
    badge: "Drake Bay / Corcovado",
    onlyForHubs: ["Sierpe", "DrakeBay"],
  },
];

export type Region = "Arenal" | "ManuelAntonio" | "Osa" | "Monteverde";

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
