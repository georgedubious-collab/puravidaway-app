/**
 * The catalog as one object, so prices can come from the database (edited in
 * /admin/pricing) or, when Supabase isn't connected, from the built-in lists
 * in catalog.ts. Everything here is plain data that can be sent to the browser.
 */
import {
  DAY_TOURS,
  EN_ROUTE_UPGRADE_CENTS,
  EXPEDITIONS,
  LODGING_TIERS,
  SEASONS,
  SIGHTSEEING_STOPS,
  VEHICLE_CLASSES,
  type DayTour,
  type Expedition,
  type LodgingTier,
  type Season,
  type SightseeingStop,
  type VehicleClass,
} from "./catalog";
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
};
