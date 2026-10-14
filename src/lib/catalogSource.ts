import "server-only";
import { unstable_cache } from "next/cache";
import type { HubId, Region } from "./catalog";
import { BUILT_IN_CATALOG, type CatalogData } from "./catalogModel";
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
export const getCatalog = unstable_cache(loadCatalog, ["catalog-v1"], {
  tags: [CATALOG_TAG],
  revalidate: 3600,
});

async function loadCatalog(): Promise<CatalogData> {
  const db = createSupabasePublicClient();
  if (!db) return BUILT_IN_CATALOG;

  try {
    const [vehicles, stops, tours, exps, tiers, seasons, ranges] = await Promise.all([
      db.from("vehicle_classes").select("*").eq("active", true).order("sort_order"),
      db.from("sightseeing_stops").select("*").eq("active", true).order("sort_order"),
      db.from("day_tours").select("*").eq("active", true).order("sort_order"),
      db.from("expeditions").select("*").eq("active", true).order("sort_order"),
      db.from("lodging_tiers").select("*").eq("active", true).order("sort_order"),
      db.from("seasons").select("*"),
      db.from("season_ranges").select("*"),
    ]);
    const failed = [vehicles, stops, tours, exps, tiers, seasons, ranges].find((r) => r.error);
    if (failed?.error) throw failed.error;
    if (!vehicles.data?.length || !seasons.data?.length) throw new Error("catalog tables are empty");

    return {
      source: "database",
      vehicles: vehicles.data.map((v) => ({
        id: v.id,
        name: v.name,
        baseRateCents: cents(v.base_rate),
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
      lodgingTiers: (tiers.data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        surchargeCents: cents(l.surcharge),
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
    };
  } catch (e) {
    console.error("[PuraVidaWay] Using the built-in catalog; database read failed:", e);
    return BUILT_IN_CATALOG;
  }
}
