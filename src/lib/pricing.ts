/**
 * Pricing engine — source: docs/PROJECT.md §6.
 * All math is in integer cents; multipliers are basis points (10000 = 1.00x).
 * Rounding: half-up to the nearest cent, applied once at the end.
 */
import {
  DAY_TOURS,
  EN_ROUTE_UPGRADE_CENTS,
  EXPEDITIONS,
  LODGING_TIERS,
  SEASONS,
  SIGHTSEEING_STOPS,
  VEHICLE_CLASSES,
  type HubId,
  type Season,
  routeMinutes,
} from "./catalog";

export function applyMultiplier(cents: number, multiplierBps: number): number {
  return Math.round((cents * multiplierBps) / 10000);
}

export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr${h > 1 ? "s" : ""}`;
  return `${h} hr ${m} min`;
}

export interface TransferQuoteInput {
  origin: HubId;
  destination: HubId;
  vehicleId: string;
  stopIds: string[];
  season: Season;
  /** In bid mode the accepted bid replaces the vehicle base rate. */
  acceptedBidCents?: number;
}

export interface TransferQuote {
  baseCents: number;
  stopsCents: number;
  subtotalCents: number;
  seasonMultiplierBps: number;
  totalCents: number;
  driveMinutes: number;
  stopsMinutes: number;
  totalMinutes: number;
}

export function quoteTransfer(input: TransferQuoteInput): TransferQuote {
  const vehicle = VEHICLE_CLASSES.find((v) => v.id === input.vehicleId);
  if (!vehicle) throw new Error(`Unknown vehicle class: ${input.vehicleId}`);

  const stops = input.stopIds
    .map((id) => SIGHTSEEING_STOPS.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const baseCents = input.acceptedBidCents ?? vehicle.baseRateCents;
  const stopsCents = stops.reduce((sum, s) => sum + s.priceCents, 0);
  const subtotalCents = baseCents + stopsCents;
  const totalCents = applyMultiplier(subtotalCents, input.season.multiplierBps);

  const driveMinutes = routeMinutes(input.origin, input.destination);
  const stopsMinutes = stops.reduce((sum, s) => sum + s.durationMin, 0);

  return {
    baseCents,
    stopsCents,
    subtotalCents,
    seasonMultiplierBps: input.season.multiplierBps,
    totalCents,
    driveMinutes,
    stopsMinutes,
    totalMinutes: driveMinutes + stopsMinutes,
  };
}

export function quoteDayTour(
  tourId: string,
  enRouteUpgrade: boolean,
  season: Season,
): number {
  const tour = DAY_TOURS.find((t) => t.id === tourId);
  if (!tour) throw new Error(`Unknown day tour: ${tourId}`);
  const subtotal = tour.priceCents + (enRouteUpgrade ? EN_ROUTE_UPGRADE_CENTS : 0);
  return applyMultiplier(subtotal, season.multiplierBps);
}

export function quoteExpedition(
  expeditionId: string,
  lodgingTierId: string,
  season: Season,
): number {
  const exp = EXPEDITIONS.find((e) => e.id === expeditionId);
  if (!exp) throw new Error(`Unknown expedition: ${expeditionId}`);
  const tier = LODGING_TIERS.find((t) => t.id === lodgingTierId);
  if (!tier) throw new Error(`Unknown lodging tier: ${lodgingTierId}`);
  return applyMultiplier(exp.basePriceCents + tier.surchargeCents, season.multiplierBps);
}

/**
 * Pick the season for a travel date. Simple rule for Phase 2a:
 * Dec 20 – Jan 5 and the week before Easter = peak; Dec–Apr = high; else green.
 * TODO(Jorge): exact peak date ranges; move to the `seasons` table in Phase 2b.
 */
export function seasonForDate(date: Date): Season {
  const m = date.getMonth(); // 0 = Jan
  const d = date.getDate();
  const peak = (m === 11 && d >= 20) || (m === 0 && d <= 5);
  if (peak) return SEASONS[2];
  if (m === 11 || m <= 3) return SEASONS[1];
  return SEASONS[0];
}

/** Deposit rule: 20% of total, rounded to the cent. */
export function depositCents(totalCents: number): number {
  return Math.round(totalCents * 0.2);
}
