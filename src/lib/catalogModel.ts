/**
 * The catalog as one object, so prices can come from the database (edited in
 * /admin/pricing) or, when Supabase isn't connected, from the built-in lists
 * in catalog.ts. Everything here is plain data that can be sent to the browser.
 */
import {
  AREA_FACTOR_BPS_DEFAULT,
  CASH_FEE_BPS_DEFAULT,
  CRC_PER_USD_DEFAULT,
  FERRY_FARES_DEFAULT,
  RIDE_FORMULA_DEFAULT,
  WAIT_PER_HOUR_CENTS_DEFAULT,
  DAY_TOURS,
  EN_ROUTE_UPGRADE_CENTS,
  EXPEDITIONS,
  LODGING_TIERS,
  SEASONS,
  SIGHTSEEING_STOPS,
  VEHICLE_CLASSES,
  type AreaId,
  type DayTour,
  type FerryFares,
  type RideFormula,
  type Expedition,
  type LodgingTier,
  type Season,
  type SightseeingStop,
  type VehicleClass,
} from "./catalog";
import { NIGHT_PREMIUM_DEFAULT, type NightPremium } from "./nightPremium";
import { DRIVER_COMMISSION_BPS_DEFAULT } from "./payout";
import { easterSunday } from "./pricing";

export interface SeasonRange {
  seasonId: string;
  /** YYYY-MM-DD, inclusive */
  startsOn: string;
  endsOn: string;
}

export interface CatalogData {
  source: "database" | "built-in";
  vehicles: VehicleClass[];
  stops: SightseeingStop[];
  dayTours: DayTour[];
  expeditions: Expedition[];
  lodgingTiers: LodgingTier[];
  seasons: (Season & { priority: number; isDefault: boolean })[];
  seasonRanges: SeasonRange[];
  /** Cash booking fee in basis points of the ride / day-tour price (1000 = 10%). */
  cashFeeBps: number;
  /** Ride price formula for the Standard class (docs/PRICING.md §4). */
  rideFormula: RideFormula;
  /** Area factor per pickup town, in basis points (10000 = 1.00×). */
  areaFactorBps: Record<AreaId, number>;
  /** Gulf of Nicoya car ferry, per crossing, in colones. */
  ferryFares: FerryFares;
  /** Colones per US dollar (ferry fares), checked weekly in the admin. */
  crcPerUsd: number;
  /** Platform share of a ride / day tour, basis points (2000 = 20%). */
  driverCommissionBps: number;
  /** USD cents per hour of waiting at a stop. */
  waitPerHourCents: number;
  /** Night-pickup premium and its hours (pricing_settings, migration 0041). */
  nightPremium: NightPremium;
}

/** Season for a travel date: highest-priority range that contains it, else the default season. */
export function seasonForYmd(ymd: string, catalog: CatalogData): Season {
  let best: (CatalogData["seasons"][number]) | undefined;
  for (const r of catalog.seasonRanges) {
    if (ymd < r.startsOn || ymd > r.endsOn) continue;
    const s = catalog.seasons.find((x) => x.id === r.seasonId);
    if (s && (!best || s.priority > best.priority)) best = s;
  }
  return best ?? catalog.seasons.find((s) => s.isDefault) ?? catalog.seasons[0];
}

/** Built-in season dates: high Dec–Apr, peak Dec 20–Jan 5 and Palm Sunday → Easter Sunday. */
export function builtInSeasonRanges(fromYear: number, toYear: number): SeasonRange[] {
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const out: SeasonRange[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    out.push({ seasonId: "high", startsOn: `${y}-01-01`, endsOn: `${y}-04-30` });
    out.push({ seasonId: "high", startsOn: `${y}-12-01`, endsOn: `${y}-12-31` });
    out.push({ seasonId: "peak", startsOn: `${y}-01-01`, endsOn: `${y}-01-05` });
    out.push({ seasonId: "peak", startsOn: `${y}-12-20`, endsOn: `${y}-12-31` });
    const easter = easterSunday(y);
    out.push({
      seasonId: "peak",
      startsOn: ymd(new Date(easter.getTime() - 7 * 86400000)),
      endsOn: ymd(easter),
    });
  }
  return out;
}

const PRIORITY: Record<string, number> = { green: 0, high: 1, peak: 2 };

export const BUILT_IN_CATALOG: CatalogData = {
  source: "built-in",
  vehicles: VEHICLE_CLASSES,
  stops: SIGHTSEEING_STOPS,
  dayTours: DAY_TOURS.map((t) => ({ ...t, enRouteUpgradeCents: t.enRouteUpgradeCents ?? EN_ROUTE_UPGRADE_CENTS })),
  expeditions: EXPEDITIONS,
  lodgingTiers: LODGING_TIERS,
  seasons: SEASONS.map((s) => ({ ...s, priority: PRIORITY[s.id] ?? 0, isDefault: s.id === "green" })),
  seasonRanges: builtInSeasonRanges(2025, 2040),
  cashFeeBps: CASH_FEE_BPS_DEFAULT,
  rideFormula: RIDE_FORMULA_DEFAULT,
  areaFactorBps: AREA_FACTOR_BPS_DEFAULT,
  ferryFares: FERRY_FARES_DEFAULT,
  crcPerUsd: CRC_PER_USD_DEFAULT,
  driverCommissionBps: DRIVER_COMMISSION_BPS_DEFAULT,
  waitPerHourCents: WAIT_PER_HOUR_CENTS_DEFAULT,
  nightPremium: NIGHT_PREMIUM_DEFAULT,
};
