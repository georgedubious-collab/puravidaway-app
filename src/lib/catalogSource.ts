import "server-only";
import { unstable_cache } from "next/cache";
import {
  AREA_FACTOR_BPS_DEFAULT,
  AREA_IDS,
  CRC_PER_USD_DEFAULT,
  DAY_TOURS,
  FERRY_FARES_DEFAULT,
  CASH_FEE_BPS_DEFAULT,
  isStopEntrance,
  RIDE_FORMULA_DEFAULT,
  SIGHTSEEING_STOPS,
  VEHICLE_CLASSES,
  WAIT_PER_HOUR_CENTS_DEFAULT,
  stopPriceCents,
  type AreaId,
  type FerryFares,
  type HubId,
  type Region,
  type RideFormula,
} from "./catalog";
import { BUILT_IN_CATALOG, type CatalogData } from "./catalogModel";
import { CUSTOM_STOP_LIMITS_DEFAULT, type CustomStopLimits } from "./customStops";
import { NIGHT_PREMIUM_DEFAULT, type NightPremium } from "./nightPremium";
import { DRIVER_COMMISSION_BPS_DEFAULT } from "./payout";
import { createSupabasePublicClient } from "./supabase/server";

export const CATALOG_TAG = "catalog";

const cents = (v: number | string | null | undefined) => Math.round(Number(v ?? 0) * 100);
const bps = (v: number | string) => Math.round(Number(v) * 10000);

/**
 * The live catalog. Reads the database when Supabase is connected, otherwise
 * (or if the database is unreachable or empty) the built-in catalog.
 * Cached for an hour and refreshed immediately when an admin saves a change
 * (revalidateTag(CATALOG_TAG) in /admin/pricing).
 */
export async function getCatalog(): Promise<CatalogData> {
  const db = createSupabasePublicClient();
  if (!db) return BUILT_IN_CATALOG;
  try {
    return await cachedDatabaseCatalog();
  } catch (e) {
    // Not cached: the next visitor tries the database again instead of
    // seeing old built-in prices for an hour.
    console.error("[PuraVidaWay] Using the built-in catalog; database read failed:", e);
    return BUILT_IN_CATALOG;
  }
}

/** Only successful database reads are cached (a thrown error is never stored). */
const cachedDatabaseCatalog = unstable_cache(loadDatabaseCatalog, ["catalog-v10"], {
  tags: [CATALOG_TAG],
  revalidate: 3600,
});

async function loadDatabaseCatalog(): Promise<CatalogData> {
  const db = createSupabasePublicClient()!;
  {
    const [vehicles, stops, tours, seasons, ranges, settings, hubPricing] = await Promise.all([
      db.from("vehicle_classes").select("*").eq("active", true).order("sort_order"),
      db.from("sightseeing_stops").select("*").eq("active", true).order("sort_order"),
      db.from("day_tours").select("*").eq("active", true).order("sort_order"),
      // Multi-day trips (expeditions, lodging_tiers) were retired on 2026-11-11 and are not read.
      db.from("seasons").select("*"),
      db.from("season_ranges").select("*"),
      db.from("pricing_settings").select("*").maybeSingle(),
      db.from("hub_pricing").select("hub_id, area_factor"),
    ]);
    const failed = [vehicles, stops, tours, seasons, ranges].find((r) => r.error);
    if (failed?.error) throw failed.error;
    if (!vehicles.data?.length || !seasons.data?.length) throw new Error("catalog tables are empty");
    // pricing_settings arrives with migration 0012; until it is run, use the built-in fee.
    if (settings.error) console.warn("[PuraVidaWay] pricing_settings unavailable, using the built-in cash fee:", settings.error.message);
    const feeBps = Number(settings.data?.cash_fee_bps);
    // Formula columns and hub_pricing arrive with migration 0013; until it is run, use the
    // built-in formula and factors so prices stay sensible (never the retired flat rate).
    if (hubPricing.error) console.warn("[PuraVidaWay] hub_pricing unavailable, using built-in area factors:", hubPricing.error.message);
    const rideFormula = readRideFormula(settings.data);
    const waitRaw = settings.data?.wait_per_hour;
    const waitPerHourCents = waitRaw == null ? WAIT_PER_HOUR_CENTS_DEFAULT : Math.max(0, cents(waitRaw as number | string)) || WAIT_PER_HOUR_CENTS_DEFAULT;
    const areaFactorBps = { ...AREA_FACTOR_BPS_DEFAULT };
    for (const h of hubPricing.data ?? []) {
      const f = bpsOrNull(h.area_factor, 5000, 20000);
      // hub_pricing holds our towns and, since migration 0015, extra areas like SouthNicoya.
      if (f !== null && (AREA_IDS as readonly string[]).includes(h.hub_id)) areaFactorBps[h.hub_id as AreaId] = f;
    }

    return {
      source: "database",
      vehicles: vehicles.data.map((v) => ({
        id: v.id,
        name: legacyVehicleText(v.id, "name", v.name),
        // Before migration 0039 there is no column: use the built-in example. After it, an
        // empty value means "no example line" (the admin cleared it).
        exampleModels:
          v.example_models === undefined
            ? (VEHICLE_CLASSES.find((b) => b.id === v.id)?.exampleModels ?? "")
            : String(v.example_models ?? "").trim(),
        priceFactorBps:
          bpsOrNull(v.price_factor, 5000, 30000) ??
          VEHICLE_CLASSES.find((b) => b.id === v.id)?.priceFactorBps ??
          10000,
        extraFeeCents:
          v.extra_fee == null
            ? (VEHICLE_CLASSES.find((b) => b.id === v.id)?.extraFeeCents ?? 0)
            : cents(v.extra_fee),
        allowsStops: v.allows_stops ?? true,
        spanishSpeakingDriver: v.spanish_speaking_driver ?? false,
        maxPax: v.max_pax,
        luggage: v.luggage,
        badge: legacyVehicleText(v.id, "badge", v.badge),
        onlyForHubs: v.only_for_hubs?.length ? (v.only_for_hubs as HubId[]) : undefined,
      })),
      stops: (stops.data ?? []).map((s) => {
        // Before migration 0021 there are no detour columns: keep the old flat price.
        const legacy = s.detour_km === undefined;
        const inputs = {
          durationMin: s.duration_min,
          detourKm: Number(s.detour_km ?? SIGHTSEEING_STOPS.find((b) => b.id === s.id)?.detourKm ?? 0),
          detourMin: Number(s.detour_min ?? SIGHTSEEING_STOPS.find((b) => b.id === s.id)?.detourMin ?? 0),
          tourPerPersonCents: cents(s.tour_price_pp ?? 0),
        };
        return {
        id: s.id,
        name: s.name,
        description: s.description,
        ...inputs,
        priceCents: legacy ? cents(s.price) : stopPriceCents(inputs, rideFormula, waitPerHourCents),
        corridors: s.corridors as HubId[],
        // Before migration 0014 there is only the old yes/no park_fee_included.
        entrance: isStopEntrance(s.entrance) ? s.entrance : s.park_fee_included ? "included" : "gate",
        };
      }),
      dayTours: (tours.data ?? []).map((t) => ({
        id: t.id,
        region: t.region as Region,
        name: t.name,
        durationHours: Number(t.duration_hours),
        perPerson:
          t.price_pp_solo == null
            ? (DAY_TOURS.find((b) => b.id === t.id)?.perPerson ?? { soloCents: cents(t.price) || 0, smallCents: cents(t.price) || 0, groupCents: cents(t.price) || 0 })
            : { soloCents: cents(t.price_pp_solo), smallCents: cents(t.price_pp_small), groupCents: cents(t.price_pp_group) },
        // Before migration 0023 there is no cost column: use the built-in tour's.
        costPerPersonCents: t.cost_pp == null ? (DAY_TOURS.find((b) => b.id === t.id)?.costPerPersonCents ?? 0) : cents(t.cost_pp),
        highlights: t.highlights ?? [],
        enRouteUpgradeCents: cents(t.en_route_upgrade_price),
      })),
      seasons: seasons.data.map((s) => ({
        id: s.id,
        name: s.name,
        multiplierBps: bps(s.multiplier),
        priority: s.priority,
        isDefault: s.is_default,
      })),
      seasonRanges: (ranges.data ?? []).map((r) => ({
        seasonId: r.season_id,
        startsOn: r.starts_on,
        endsOn: r.ends_on,
      })),
      cashFeeBps: Number.isInteger(feeBps) && feeBps >= 0 && feeBps <= 5000 ? feeBps : CASH_FEE_BPS_DEFAULT,
      rideFormula,
      areaFactorBps,
      ferryFares: readFerryFares(settings.data),
      crcPerUsd: readRate(settings.data),
      waitPerHourCents,
      nightPremium: readNightPremium(settings.data),
      customStopLimits: readCustomStopLimits(settings.data),
      driverCommissionBps: bpsOrNull(settings.data?.driver_commission_bps == null ? null : Number(settings.data.driver_commission_bps) / 10000, 0, 5000) ?? DRIVER_COMMISSION_BPS_DEFAULT,
    };
  }
}

/**
 * The 4-traveller class was seeded as "Standard Comfort SUV" / "Most popular" and is now a
 * minivan (migration 0038 rewrites the row). The 4x4 and van names used to carry model names;
 * those now live in example_models and are shown as "... or similar" (migration 0039 rewrites
 * the rows). Until a migration has run, the old seeded wording is shown as the new one, so the
 * site never sells an SUV in that class and never names a model without "or similar". Text
 * edited in /admin/pricing is never touched.
 */
const LEGACY_VEHICLE_TEXT: Record<string, { name?: [string, string]; badge?: [string, string] }> = {
  suv: { name: ["Standard Comfort SUV", "Minivan (MPV)"], badge: ["Most popular", "Roomy for 4 + bags"] },
  "4x4": { name: ["Executive 4x4 (Prado / Fortuner)", "Executive 4x4"] },
  van: { name: ["Private Toyota HiAce / Hyundai Staria", "Private Van"] },
};
function legacyVehicleText(id: string, field: "name" | "badge", current: string): string {
  const legacy = LEGACY_VEHICLE_TEXT[id]?.[field];
  return legacy && current === legacy[0] ? legacy[1] : current;
}

/** A factor like 1.15 as basis points, or null when missing / out of range. */
function bpsOrNull(v: unknown, min: number, max: number): number | null {
  if (v == null || v === "") return null;
  const b = bps(v as number | string);
  return Number.isFinite(b) && b >= min && b <= max ? b : null;
}

/** Ferry fares in colones from pricing_settings (migration 0015), falling back per field to the built-in ones. */
function readFerryFares(row: Record<string, unknown> | null | undefined): FerryFares {
  const pick = (col: string, fallback: number) => {
    const n = Number(row?.[col]);
    return row?.[col] != null && Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
  };
  return {
    vehicleCrc: pick("ferry_vehicle_fare_crc", FERRY_FARES_DEFAULT.vehicleCrc),
    passengerCrc: pick("ferry_passenger_fare_crc", FERRY_FARES_DEFAULT.passengerCrc),
  };
}

/** Colones per dollar from pricing_settings (migration 0015); a wildly wrong value falls back. */
function readRate(row: Record<string, unknown> | null | undefined): number {
  const n = Number(row?.crc_per_usd);
  return row?.crc_per_usd != null && Number.isFinite(n) && n >= 100 && n <= 2000 ? n : CRC_PER_USD_DEFAULT;
}

/** Formula numbers from pricing_settings, falling back per field to the built-in defaults. */
function readRideFormula(row: Record<string, unknown> | null | undefined): RideFormula {
  const pick = (col: string, fallback: number) => {
    const v = row?.[col];
    if (v == null || v === "") return fallback;
    const c = cents(v as number | string);
    return Number.isFinite(c) && c >= 0 ? c : fallback;
  };
  return {
    baseFareCents: pick("ride_base_fare", RIDE_FORMULA_DEFAULT.baseFareCents),
    perKmCents: pick("ride_per_km", RIDE_FORMULA_DEFAULT.perKmCents),
    perHourCents: pick("ride_per_hour", RIDE_FORMULA_DEFAULT.perHourCents),
    minimumFareCents: pick("ride_minimum_fare", RIDE_FORMULA_DEFAULT.minimumFareCents),
  };
}

/**
 * Night-pickup premium from pricing_settings (migration 0041). Until that migration has run
 * the columns are missing and the built-in values apply; a value outside its allowed range
 * also falls back, so a bad row can never price a ride wildly.
 */
/**
 * Limits for "add your own stop" (migration 0057). A missing column (before the migration) or a
 * value out of range falls back to the built-in limit.
 */
function readCustomStopLimits(row: Record<string, unknown> | null | undefined): CustomStopLimits {
  const int = (v: unknown, min: number, max: number, fallback: number) => {
    const n = v == null ? NaN : Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };
  return {
    maxStops: int(row?.custom_stop_max, 0, 5, CUSTOM_STOP_LIMITS_DEFAULT.maxStops),
    maxWaitMinutes: int(row?.custom_stop_max_wait_min, 30, 720, CUSTOM_STOP_LIMITS_DEFAULT.maxWaitMinutes),
    maxDetourMinutes: int(row?.custom_stop_max_detour_min, 0, 480, CUSTOM_STOP_LIMITS_DEFAULT.maxDetourMinutes),
  };
}

function readNightPremium(row: Record<string, unknown> | null | undefined): NightPremium {
  const int = (v: unknown, min: number, max: number, fallback: number) => {
    const n = v == null ? NaN : Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };
  return {
    bps: int(row?.night_premium_bps, 0, 10000, NIGHT_PREMIUM_DEFAULT.bps),
    startHour: int(row?.night_start_hour, 0, 23, NIGHT_PREMIUM_DEFAULT.startHour),
    endHour: int(row?.night_end_hour, 0, 23, NIGHT_PREMIUM_DEFAULT.endHour),
  };
}
