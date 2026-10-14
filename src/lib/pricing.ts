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
import type { CatalogData } from "./catalogModel";

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
  /** Live catalog (from the database). Defaults to the built-in catalog. */
  catalog?: CatalogData;
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
  const vehicle = (input.catalog?.vehicles ?? VEHICLE_CLASSES).find((v) => v.id === input.vehicleId);
  if (!vehicle) throw new Error(`Unknown vehicle class: ${input.vehicleId}`);

  const stops = input.stopIds
    .map((id) => (input.catalog?.stops ?? SIGHTSEEING_STOPS).find((s) => s.id === id))
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
  catalog?: CatalogData,
): number {
  const tour = (catalog?.dayTours ?? DAY_TOURS).find((t) => t.id === tourId);
  if (!tour) throw new Error(`Unknown day tour: ${tourId}`);
  const upgradeCents = tour.enRouteUpgradeCents ?? EN_ROUTE_UPGRADE_CENTS;
  const subtotal = tour.priceCents + (enRouteUpgrade ? upgradeCents : 0);
  return applyMultiplier(subtotal, season.multiplierBps);
}

export function quoteExpedition(
  expeditionId: string,
  lodgingTierId: string,
  season: Season,
  catalog?: CatalogData,
): number {
  const exp = (catalog?.expeditions ?? EXPEDITIONS).find((e) => e.id === expeditionId);
  if (!exp) throw new Error(`Unknown expedition: ${expeditionId}`);
  const tier = (catalog?.lodgingTiers ?? LODGING_TIERS).find((t) => t.id === lodgingTierId);
  if (!tier) throw new Error(`Unknown lodging tier: ${lodgingTierId}`);
  return applyMultiplier(exp.basePriceCents + tier.surchargeCents, season.multiplierBps);
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

/** Deposit rule: 20% of total (integer arithmetic), rounded to the cent. */
export function depositCents(totalCents: number): number {
  return Math.round(totalCents / 5);
}
