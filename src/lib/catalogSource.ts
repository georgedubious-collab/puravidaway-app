import "server-only";
import { unstable_cache } from "next/cache";
import {
  AREA_FACTOR_BPS_DEFAULT,
  AREA_IDS,
  CRC_PER_USD_DEFAULT,
  FERRY_FARES_DEFAULT,
  CASH_FEE_BPS_DEFAULT,
  isStopEntrance,
  RIDE_FORMULA_DEFAULT,
  VEHICLE_CLASSES,
  type AreaId,
  type FerryFares,
  type HubId,
  type Region,
  type RideFormula,
} from "./catalog";
import { BUILT_IN_CATALOG, type CatalogData } from "./catalogModel";
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
const cachedDatabaseCatalog = unstable_cache(loadDatabaseCatalog, ["catalog-v6"], {
  tags: [CATALOG_TAG],
  revalidate: 3600,
});

async function loadDatabaseCatalog(): Promise<CatalogData> {
  const db = createSupabasePublicClient()!;
  {
    const [vehicles, stops, tours, exps, tiers, seasons, ranges, settings, hubPricing] = await Promise.all([
      db.from("vehicle_classes").select("*").eq("active", true).order("sort_order"),
      db.from("sightseeing_stops").select("*").eq("active", true).order("sort_order"),
      db.from("day_tours").select("*").eq("active", true).order("sort_order"),
      db.from("expeditions").select("*").eq("active", true).order("sort_order"),
      db.from("lodging_tiers").select("*").eq("active", true).order("sort_order"),
      db.from("seasons").select("*"),
      db.from("season_ranges").select("*"),
      db.from("pricing_settings").select("*").maybeSingle(),
      db.from("hub_pricing").select("hub_id, area_factor"),
    ]);
    const failed = [vehicles, stops, tours, exps, tiers, seasons, ranges].find((r) => r.error);
    if (failed?.error) throw failed.error;
    if (!vehicles.data?.length || !seasons.data?.length) throw new Error("catalog tables are empty");
    // pricing_settings arrives with migration 0012; until it is run, use the built-in fee.
    if (settings.error) console.warn("[PuraVidaWay] pricing_settings unavailable, using the built-in cash fee:", settings.error.message);
    const feeBps = Number(settings.data?.cash_fee_bps);
    // Formula columns and hub_pricing arrive with migration 0013; until it is run, use the
    // built-in formula and factors so prices stay sensible (never the retired flat rate).
    if (hubPricing.error) console.warn("[PuraVidaWay] hub_pricing unavailable, using built-in area factors:", hubPricing.error.message);
    const rideFormula = readRideFormula(settings.data);
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
        name: v.name,
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
        badge: v.badge,
        onlyForHubs: v.only_for_hubs?.length ? (v.only_for_hubs as HubId[]) : undefined,
      })),
      stops: (stops.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMin: s.duration_min,
        priceCents: cents(s.price),
        corridors: s.corridors as HubId[],
        // Before migration 0014 there is only the old yes/no park_fee_included.
        entrance: isStopEntrance(s.entrance) ? s.entrance : s.park_fee_included ? "included" : "gate",
      })),
      dayTours: (tours.data ?? []).map((t) => ({
        id: t.id,
        region: t.region as Region,
        name: t.name,
        durationHours: Number(t.duration_hours),
        priceCents: cents(t.price),
        highlights: t.highlights ?? [],
        enRouteUpgradeCents: cents(t.en_route_upgrade_price),
      })),
      expeditions: (exps.data ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        days: e.days,
        nights: e.nights,
        basePriceCents: cents(e.base_price),
        includes: e.includes ?? [],
        itinerary: e.itinerary ?? [],
      })),
      lodgingTiers: tiers.data?.length
        ? tiers.data.map((l) => ({
            id: l.id,
            name: l.name,
            surchargeCents: cents(l.surcharge),
            expeditionId: l.expedition_id ?? undefined,
          }))
        : // Every tier switched off: expeditions are still sold, with no lodging upgrade.
          [{ id: "standard", name: "Standard lodging", surchargeCents: 0 }],
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
      driverCommissionBps: bpsOrNull(settings.data?.driver_commission_bps == null ? null : Number(settings.data.driver_commission_bps) / 10000, 0, 5000) ?? DRIVER_COMMISSION_BPS_DEFAULT,
    };
  }
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
