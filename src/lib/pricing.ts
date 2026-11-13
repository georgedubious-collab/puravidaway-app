/**
 * Pricing engine — source: docs/PROJECT.md §6.
 * Ride order of operations: base formula → vehicle factor (× area) → season → night-pickup
 * premium → pass-through costs (ferries), see quoteTransfer().
 * All math is in integer cents; multipliers are basis points (10000 = 1.00x).
 * Rounding: half-up to the nearest cent, applied once at the end.
 */
import {
  AREA_FACTOR_BPS_DEFAULT,
  CRC_PER_USD_DEFAULT,
  FERRY_FARES_DEFAULT,
  crcToCents,
  DAY_TOURS,
  EN_ROUTE_UPGRADE_CENTS,
  RIDE_FORMULA_DEFAULT,
  SEASONS,
  SIGHTSEEING_STOPS,
  VEHICLE_CLASSES,
  type HubId,
  type RideFormula,
  type Season,
  type VehicleClass,
  routeDrivingMinutes,
  routeKm,
  routeMinutes,
  stopTotalCents,
  dayTourCents,
} from "./catalog";
import type { CatalogData } from "./catalogModel";
import { customStopCents, type CustomStopInputs } from "./customStops";
import { NIGHT_PREMIUM_DEFAULT, nightBpsFor, type NightPremium } from "./nightPremium";
import type { RideRoute } from "./places";

export function applyMultiplier(cents: number, multiplierBps: number): number {
  return Math.round((cents * multiplierBps) / 10000);
}

/** A price rounded to whole dollars ("$590"), for tour cards. The trip summary keeps the exact amount. */
export function formatUSDWhole(cents: number): string {
  return formatUSD(Math.round(cents / 100) * 100);
}

export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** "2 hrs 30 min"; Spanish pages get "2 h 30 min". */
export function formatDuration(minutes: number, lang: "en" | "es" = "en"): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (lang === "es") return m === 0 ? `${h} h` : `${h} h ${m} min`;
  if (m === 0) return `${h} hr${h > 1 ? "s" : ""}`;
  return `${h} hr ${m} min`;
}

/**
 * Price of the ride itself (no stops, no season) for one vehicle class —
 * docs/PRICING.md §4:
 *   standard = max(minimum fare, base + per km × road km + per hour × driving hours)
 *   ride     = standard × vehicle factor × area factor (pickup town) + vehicle extra fee
 * Rounded to whole dollars so prices read like real quotes ($146, not $145.83).
 *
 * Road km and driving time come from `route` (Google Routes, for typed places)
 * or, between two of our towns, from the tables in catalog.ts. The area factor
 * is the pickup's town (a typed place's nearest town), or an extra area such as
 * Southern Nicoya at either end when the route takes the ferry (route.area), whichever is higher.
 */
export function rideCents(
  origin: HubId,
  destination: HubId,
  vehicle: Pick<VehicleClass, "priceFactorBps" | "extraFeeCents">,
  catalog?: Pick<CatalogData, "rideFormula" | "areaFactorBps">,
  route?: RideRoute | null,
): number {
  if (!route && origin === destination) return 0;
  return rideDriveCents(origin, destination, vehicle, catalog, route) + vehicle.extraFeeCents;
}

/**
 * The driving part of rideCents(): standard × vehicle factor × area factor, rounded to whole
 * dollars, WITHOUT the vehicle's extra fee (the Drake Bay river boat). This is the amount the
 * night-pickup premium is charged on.
 */
export function rideDriveCents(
  origin: HubId,
  destination: HubId,
  vehicle: Pick<VehicleClass, "priceFactorBps">,
  catalog?: Pick<CatalogData, "rideFormula" | "areaFactorBps">,
  route?: RideRoute | null,
): number {
  if (!route && origin === destination) return 0;
  const f: RideFormula = catalog?.rideFormula ?? RIDE_FORMULA_DEFAULT;
  const areas = catalog?.areaFactorBps ?? AREA_FACTOR_BPS_DEFAULT;
  const areaBps = Math.max(areas[origin] ?? 10000, route?.area ? (areas[route.area] ?? 10000) : 0);
  const km = route ? route.km : routeKm(origin, destination);
  const drivingMinutes = route ? route.drivingMinutes : routeDrivingMinutes(origin, destination);
  const formula = f.baseFareCents + f.perKmCents * km + (f.perHourCents * drivingMinutes) / 60;
  const standard = Math.max(f.minimumFareCents, formula);
  const scaled = (standard * vehicle.priceFactorBps * areaBps) / 1e8;
  return Math.round(scaled / 100) * 100;
}

/**
 * Night-pickup premium for one ride, in cents (0 by day, or when no pickup time is given):
 *   round_to_cent(driving part × season multiplier × night %)
 * `driveCents` is rideDriveCents(): the ride after the vehicle and area factors, without the
 * vehicle's extra fee. Stops, ferries, the boat fee and entrances are never part of it.
 * The percentage and the hours come from the catalog (pricing_settings, /admin/pricing).
 */
export function nightPremiumCents(
  driveCents: number,
  seasonMultiplierBps: number,
  pickupTime: string | null | undefined,
  night: NightPremium = NIGHT_PREMIUM_DEFAULT,
): number {
  const bps = nightBpsFor(pickupTime, night);
  return bps > 0 ? applyMultiplier(applyMultiplier(driveCents, seasonMultiplierBps), bps) : 0;
}

/**
 * Car ferry fares for a ride (Gulf of Nicoya): per crossing, the vehicle with its
 * driver + each passenger, converted from colones at the catalog's exchange rate and
 * rounded to whole dollars. Not season-adjusted. 0 when the route has no ferry.
 */
export function ferryCents(
  route: Pick<RideRoute, "ferries"> | null | undefined,
  pax: number,
  catalog?: Pick<CatalogData, "ferryFares" | "crcPerUsd">,
): number {
  if (!route?.ferries) return 0;
  const f = catalog?.ferryFares ?? FERRY_FARES_DEFAULT;
  const rate = catalog?.crcPerUsd ?? CRC_PER_USD_DEFAULT;
  const cents = route.ferries * crcToCents(f.vehicleCrc + pax * f.passengerCrc, rate);
  return Math.round(cents / 100) * 100;
}

export interface TransferQuoteInput {
  origin: HubId;
  destination: HubId;
  vehicleId: string;
  stopIds: string[];
  /**
   * The traveller's own stops with the detours the server worked out (src/lib/customStops.ts).
   * Priced like a catalog stop's driver part; their extra driving is part of the drive time.
   */
  customStops?: readonly CustomStopInputs[] | null;
  season: Season;
  /** Google road route when an end is a typed place (see rideCents). */
  route?: RideRoute | null;
  /** Travellers, for ferry passenger fares (defaults to 1). */
  pax?: number;
  /**
   * Pickup time, Costa Rica time, "HH:MM". Inside the night window (catalog.nightPremium) the
   * ride costs the night premium more. Not given = no premium: route pages, "from" prices and
   * app builds from before night pickups (they can't choose a night hour).
   */
  pickupTime?: string | null;
  /** Live catalog (from the database). Defaults to the built-in catalog. */
  catalog?: CatalogData;
}

export interface TransferQuote {
  baseCents: number;
  /** Every stop (catalog + the traveller's own), before the season multiplier. */
  stopsCents: number;
  /** The traveller's own stops inside stopsCents. */
  customStopsCents: number;
  /** Ride + stops, before the season multiplier and ferries. */
  subtotalCents: number;
  /** Car ferry fares, added after the season multiplier. */
  ferryCents: number;
  /** Night-pickup premium included in totalCents (0 by day). */
  nightCents: number;
  /** The premium that was applied, in basis points (0 when none). */
  nightBps: number;
  seasonMultiplierBps: number;
  totalCents: number;
  driveMinutes: number;
  stopsMinutes: number;
  totalMinutes: number;
}

export function quoteTransfer(input: TransferQuoteInput): TransferQuote {
  const vehicle = (input.catalog?.vehicles ?? VEHICLE_CLASSES).find((v) => v.id === input.vehicleId);
  if (!vehicle) throw new Error(`Unknown vehicle class: ${input.vehicleId}`);

  const stops = input.stopIds
    .map((id) => (input.catalog?.stops ?? SIGHTSEEING_STOPS).find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const baseCents = rideCents(input.origin, input.destination, vehicle, input.catalog, input.route);
  // Night pickup: a percentage of the driving part, after the season.
  const night = input.catalog?.nightPremium ?? NIGHT_PREMIUM_DEFAULT;
  const nightCents = nightPremiumCents(
    rideDriveCents(input.origin, input.destination, vehicle, input.catalog, input.route),
    input.season.multiplierBps,
    input.pickupTime,
    night,
  );
  // Each stop: the driver's part (wait + detour) + its tour part per traveller.
  // Own stops: the same sum as a catalog stop's driver part (wait + detour), no tour part.
  const custom = input.customStops ?? [];
  const customStopsCents = custom.reduce((sum, s) => sum + customStopCents(s, input.catalog), 0);
  const stopsCents = stops.reduce((sum, s) => sum + stopTotalCents(s, input.pax ?? 1), 0) + customStopsCents;
  const subtotalCents = baseCents + stopsCents;
  const ferry = ferryCents(input.route, input.pax ?? 1, input.catalog);
  // Order: base → vehicle (and area) → season → night premium → pass-through costs (ferries).
  const totalCents = applyMultiplier(subtotalCents, input.season.multiplierBps) + nightCents + ferry;

  // The extra driving to reach the traveller's own stops is drive time; the time there is stop time.
  const driveMinutes =
    (input.route ? input.route.totalMinutes : routeMinutes(input.origin, input.destination)) + custom.reduce((sum, s) => sum + s.detourMin, 0);
  const stopsMinutes = stops.reduce((sum, s) => sum + s.durationMin, 0) + custom.reduce((sum, s) => sum + s.minutes, 0);

  return {
    baseCents,
    stopsCents,
    customStopsCents,
    subtotalCents,
    ferryCents: ferry,
    nightCents,
    nightBps: nightCents > 0 ? night.bps : 0,
    seasonMultiplierBps: input.season.multiplierBps,
    totalCents,
    driveMinutes,
    stopsMinutes,
    totalMinutes: driveMinutes + stopsMinutes,
  };
}

/** Day tour for a group: per-person tier × travellers (+ the flat en-route upgrade), then the season. */
export function quoteDayTour(
  tourId: string,
  enRouteUpgrade: boolean,
  pax: number,
  season: Season,
  catalog?: CatalogData,
): number {
  const tour = (catalog?.dayTours ?? DAY_TOURS).find((t) => t.id === tourId);
  if (!tour) throw new Error(`Unknown day tour: ${tourId}`);
  const upgradeCents = tour.enRouteUpgradeCents ?? EN_ROUTE_UPGRADE_CENTS;
  const subtotal = dayTourCents(tour, pax) + (enRouteUpgrade ? upgradeCents : 0);
  return applyMultiplier(subtotal, season.multiplierBps);
}

/** Easter Sunday (Gregorian) for a given year — anonymous algorithm. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Pick the season for a travel date (Phase 2a rule, moves to the `seasons`
 * table in Phase 2b):
 *   peak  = Dec 20 – Jan 5, and Semana Santa (Palm Sunday → Easter Sunday)
 *   high  = Dec – Apr otherwise
 *   green = everything else
 * TODO(Jorge): confirm exact peak ranges.
 */
export function seasonForDate(date: Date): Season {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0 = Jan
  const d = date.getDate();
  const xmas = (m === 11 && d >= 20) || (m === 0 && d <= 5);
  const easter = easterSunday(y);
  const palmSunday = new Date(easter.getTime() - 7 * 86400000);
  const dayUtc = Date.UTC(y, m, d);
  const semanaSanta = dayUtc >= palmSunday.getTime() && dayUtc <= easter.getTime();
  if (xmas || semanaSanta) return SEASONS[2];
  if (m === 11 || m <= 3) return SEASONS[1];
  return SEASONS[0];
}

/**
 * The "per person" figure never splits a car between more than 7 travellers,
 * even for 10-seat vans: Daytrip divides its van by 7, and splitting by 10
 * would make our van look unrealistically cheap next to theirs (Jorge, 2026-11-08).
 */
export const PER_PERSON_MAX_SHARE = 7;

/** How many travellers the "from $X per person" label assumes for a class. */
export function perPersonShare(maxPax: number): number {
  return Math.max(1, Math.min(maxPax, PER_PERSON_MAX_SHARE));
}

/**
 * Daytrip-style "from $X per person": the car price shared by a full car
 * (the class's maximum passengers, capped at PER_PERSON_MAX_SHARE), rounded
 * UP to whole dollars, so the label never undersells what a full car pays.
 */
export function perPersonCents(carCents: number, maxPax: number): number {
  return Math.ceil(carCents / (perPersonShare(maxPax) * 100)) * 100;
}

/** Cash booking fee for one item: feeBps of its price (1000 = 10%), rounded to the cent. */
export function cashFeeCents(itemCents: number, feeBps: number): number {
  return applyMultiplier(itemCents, feeBps);
}

/** "10%", "12.5%" from basis points. */
export function formatBpsPercent(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}
