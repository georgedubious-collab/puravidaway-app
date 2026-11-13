/**
 * Pinned (fixed) prices for a route — docs/PRICING.md §4.5, table `pinned_route_prices`
 * (migration 0058), edited at /admin/pricing.
 *
 * The ride formula prices every town pair from road km and driving hours. A pinned price
 * REPLACES the formula's ride price for one town pair and vehicle class: the amount after the
 * vehicle factor and the area factor, before the vehicle's extra fee. Everything after it is
 * unchanged (season, night premium, stops, ferries / boat, cash fee, promo codes, payout),
 * because the one place that uses it is rideDriveCents() in ./pricing.
 *
 * Which rides get it:
 *   - town to town (no typed place): always;
 *   - a typed hotel / address inside the town's zone at both ends (`route.zones`, set by the
 *     server in rideRoute()): the same pinned price, the way Daytrip charges Arenas del Mar the
 *     same as Manuel Antonio town;
 *   - a typed place linked to those towns but outside a zone: the formula with Google's road
 *     km, as before, except that a ride at least as long as the town-to-town road never costs
 *     less than the pinned price (a lodge beyond Puerto Jiménez is never cheaper than the town).
 *
 * Plain data and pure functions: used by the browser, the server and the tests.
 */
import type { HubId } from "./catalog";
import { HUB_POINTS, isHubPlace, straightKm, type RidePlace, type RideRoute } from "./places";

export interface PinnedPrice {
  origin: HubId;
  destination: HubId;
  /** vehicle_classes.id */
  vehicleId: string;
  /** Whole-vehicle price in USD cents, before the season multiplier. */
  cents: number;
  /** True: also counts for destination → origin. */
  bothWays: boolean;
}

/**
 * Built-in copy of the seeded pins (migration 0058), used only when the database isn't
 * connected or the table can't be read, like the other built-in pricing numbers.
 * SJO ↔ Puerto Jiménez, about 5% under Daytrip's matching class (Jorge, 2026-11-12).
 */
export const PINNED_PRICES_DEFAULT: PinnedPrice[] = (
  [
    ["economy", 48900],
    ["sedan", 49900],
    ["suv", 54900],
    ["4x4", 58500],
    ["van", 60500],
  ] as const
).map(([vehicleId, cents]) => ({ origin: "SJO", destination: "PuertoJimenez", vehicleId, cents, bothWays: true }));

/**
 * Classes that are another class plus a fixed extra: the "4x4 + Sierpe boat" combo is the 4x4
 * ride + the boat fee, so it follows the 4x4's pinned price and stays exactly the boat fee above it.
 */
export const PIN_CLASS_ALIAS: Record<string, string> = { sierpe_combo: "4x4" };

/** The class whose pinned price a vehicle class uses. */
export function pinClassId(vehicleId: string): string {
  return PIN_CLASS_ALIAS[vehicleId] ?? vehicleId;
}

/**
 * The pinned price for a ride between two towns in one class, or null when there is none.
 * A pin written in the ride's own direction wins over a both-ways pin written the other way.
 */
export function pinnedCents(
  pins: readonly PinnedPrice[] | null | undefined,
  origin: HubId,
  destination: HubId,
  vehicleId: string | null | undefined,
): number | null {
  if (!pins?.length || !vehicleId || origin === destination) return null;
  const cls = pinClassId(vehicleId);
  const direct = pins.find((p) => p.vehicleId === cls && p.origin === origin && p.destination === destination);
  if (direct) return direct.cents;
  const reverse = pins.find((p) => p.vehicleId === cls && p.bothWays && p.origin === destination && p.destination === origin);
  return reverse ? reverse.cents : null;
}

/**
 * The ride's price (driving part) given the formula's answer: see the rules at the top.
 * `townKm` is the town-to-town road km from the tables in catalog.ts.
 */
export function withPinnedPrice(
  formulaCents: number,
  pins: readonly PinnedPrice[] | null | undefined,
  origin: HubId,
  destination: HubId,
  vehicleId: string | null | undefined,
  route: Pick<RideRoute, "km" | "zones"> | null | undefined,
  townKm: number,
): number {
  const pin = pinnedCents(pins, origin, destination, vehicleId);
  if (pin === null) return formulaCents;
  if (!route || route.zones) return pin;
  return route.km >= townKm ? Math.max(formulaCents, pin) : formulaCents;
}

/**
 * How far from a town's map point (straight line, km) a typed place still counts as that town
 * for a pinned price. SJO's is wider: the "SJO Airport / San José" town covers the airport,
 * Alajuela, Heredia, Escazú and San José city. Drake Bay's is its boat area.
 */
export const HUB_ZONE_KM_DEFAULT = 12;
export const HUB_ZONE_KM: Partial<Record<HubId, number>> = { SJO: 20, DrakeBay: 15 };

/** Is this end of a ride inside its town's zone? Our towns themselves always are. */
export function inHubZone(p: Pick<RidePlace, "id" | "hub" | "lat" | "lng">): boolean {
  if (isHubPlace(p)) return true;
  return straightKm(p, HUB_POINTS[p.hub]) <= (HUB_ZONE_KM[p.hub] ?? HUB_ZONE_KM_DEFAULT);
}

/** Both ends inside their town's zone: a pinned price for the two towns applies as it is. */
export function inPinZones(origin: Pick<RidePlace, "id" | "hub" | "lat" | "lng">, destination: Pick<RidePlace, "id" | "hub" | "lat" | "lng">): boolean {
  return origin.hub !== destination.hub && inHubZone(origin) && inHubZone(destination);
}

/** Can these rows be read as pins? Unknown towns, classes of the wrong shape and bad amounts are dropped. */
export function readPinnedPrices(
  rows: readonly { origin_hub: unknown; destination_hub: unknown; vehicle_class_id: unknown; price: unknown; both_ways: unknown }[],
  hubIds: readonly string[],
): PinnedPrice[] {
  const out: PinnedPrice[] = [];
  for (const r of rows) {
    const cents = Math.round(Number(r.price) * 100);
    if (
      typeof r.origin_hub !== "string" || typeof r.destination_hub !== "string" || typeof r.vehicle_class_id !== "string" ||
      !hubIds.includes(r.origin_hub) || !hubIds.includes(r.destination_hub) || r.origin_hub === r.destination_hub ||
      !Number.isFinite(cents) || cents < 100 || cents > 500000
    ) continue;
    out.push({
      origin: r.origin_hub as HubId,
      destination: r.destination_hub as HubId,
      vehicleId: r.vehicle_class_id,
      cents,
      bothWays: r.both_ways !== false,
    });
  }
  return out;
}
