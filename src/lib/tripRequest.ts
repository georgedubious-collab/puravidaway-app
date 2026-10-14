/**
 * What a cart item IS (not just how it's described), so the server can
 * re-price it from the catalog before saving a booking. Shared by the
 * browser (building items) and the server (checking them).
 */
import { HUBS, type HubId } from "./catalog";
import { seasonForYmd, type CatalogData } from "./catalogModel";
import { isValidYmd } from "./dates";
import { quoteDayTour, quoteExpedition, quoteTransfer } from "./pricing";

export const MIN_OFFER_USD = 50;
export const MAX_OFFER_USD = 5000;
export const MAX_TRIP_ITEMS = 10;

export type ItemSpec =
  | {
      kind: "transfer";
      origin: HubId;
      destination: HubId;
      vehicleId: string;
      stopIds: string[];
      pax: number;
      /** "bid": the traveller's own offer replaces the fixed price. */
      pricing: "fixed" | "bid";
      offerCents?: number;
      notes?: string;
    }
  | { kind: "day_tour"; tourId: string; upgrade: boolean }
  | { kind: "expedition"; expeditionId: string; tierId: string };

const HUB_IDS = new Set<string>(HUBS.map((h) => h.id));
const str = (v: unknown, max = 60) => typeof v === "string" && v.length > 0 && v.length <= max;

/** Validate untrusted input (browser storage or a request). Returns null if malformed. */
export function parseSpec(raw: unknown): ItemSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === "transfer") {
    if (!str(o.origin) || !str(o.destination) || !HUB_IDS.has(o.origin as string) || !HUB_IDS.has(o.destination as string)) return null;
    if (!str(o.vehicleId)) return null;
    if (!Array.isArray(o.stopIds) || o.stopIds.length > 10 || !o.stopIds.every((s) => str(s))) return null;
    if (!Number.isInteger(o.pax) || (o.pax as number) < 1 || (o.pax as number) > 60) return null;
    if (o.pricing !== "fixed" && o.pricing !== "bid") return null;
    if (o.pricing === "bid" && (!Number.isInteger(o.offerCents) || (o.offerCents as number) <= 0)) return null;
    if (o.notes !== undefined && (typeof o.notes !== "string" || o.notes.length > 500)) return null;
    return {
      kind: "transfer",
      origin: o.origin as HubId,
      destination: o.destination as HubId,
      vehicleId: o.vehicleId as string,
      stopIds: o.stopIds as string[],
      pax: o.pax as number,
      pricing: o.pricing,
      offerCents: o.pricing === "bid" ? (o.offerCents as number) : undefined,
      notes: (o.notes as string | undefined) || undefined,
    };
  }
  if (o.kind === "day_tour") {
    if (!str(o.tourId) || typeof o.upgrade !== "boolean") return null;
    return { kind: "day_tour", tourId: o.tourId as string, upgrade: o.upgrade };
  }
  if (o.kind === "expedition") {
    if (!str(o.expeditionId) || !str(o.tierId)) return null;
    return { kind: "expedition", expeditionId: o.expeditionId as string, tierId: o.tierId as string };
  }
  return null;
}

export interface PricedItem {
  totalCents: number;
  /** Fixed catalog price, for reference when the traveller made an offer. */
  referenceCents: number;
}

/**
 * Price one item from the catalog for its travel date. Throws a readable
 * Error when the item can't be booked as specified (e.g. vehicle switched off).
 */
export function priceItem(spec: ItemSpec, date: string, catalog: CatalogData): PricedItem {
  if (!isValidYmd(date)) throw new Error("A travel date is missing.");
  const season = seasonForYmd(date, catalog);

  if (spec.kind === "transfer") {
    if (spec.origin === spec.destination) throw new Error("Pickup and drop-off are the same place.");
    const vehicle = catalog.vehicles.find((v) => v.id === spec.vehicleId);
    if (!vehicle) throw new Error("That vehicle is no longer offered. Please choose another.");
    if (vehicle.maxPax < spec.pax) throw new Error(`The ${vehicle.name} seats up to ${vehicle.maxPax}.`);
    if (vehicle.onlyForHubs && !vehicle.onlyForHubs.includes(spec.origin) && !vehicle.onlyForHubs.includes(spec.destination)) {
      throw new Error(`The ${vehicle.name} isn't available on this route.`);
    }
    for (const id of spec.stopIds) {
      const stop = catalog.stops.find((s) => s.id === id);
      if (!stop || !(stop.corridors.includes(spec.origin) || stop.corridors.includes(spec.destination))) {
        throw new Error("One of the stops is no longer offered on this route.");
      }
    }
    const quote = quoteTransfer({ ...spec, season, catalog });
    if (spec.pricing === "bid") {
      const offer = spec.offerCents ?? 0;
      if (offer < MIN_OFFER_USD * 100 || offer > MAX_OFFER_USD * 100) {
        throw new Error(`Offers must be between $${MIN_OFFER_USD} and $${MAX_OFFER_USD}.`);
      }
      return { totalCents: offer, referenceCents: quote.totalCents };
    }
    return { totalCents: quote.totalCents, referenceCents: quote.totalCents };
  }

  if (spec.kind === "day_tour") {
    if (!catalog.dayTours.some((t) => t.id === spec.tourId)) throw new Error("That tour is no longer offered.");
    const total = quoteDayTour(spec.tourId, spec.upgrade, season, catalog);
    return { totalCents: total, referenceCents: total };
  }

  if (!catalog.expeditions.some((e) => e.id === spec.expeditionId)) throw new Error("That expedition is no longer offered.");
  const tier = catalog.lodgingTiers.find((t) => t.id === spec.tierId);
  if (!tier || (tier.expeditionId && tier.expeditionId !== spec.expeditionId)) {
    throw new Error("That lodging option is no longer offered.");
  }
  const total = quoteExpedition(spec.expeditionId, spec.tierId, season, catalog);
  return { totalCents: total, referenceCents: total };
}
