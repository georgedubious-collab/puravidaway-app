/**
 * Driver payout (docs/PRICING.md §6, build step 7; Jorge, 2026-11-09).
 *
 * Travellers pay a fixed price. Behind the scenes the driver takes the job at a
 * fixed payout: the platform keeps a commission on the ride itself, and costs the
 * driver pays out of pocket on the way (ferry tickets, later boats and park fees)
 * are passed through in full. Drivers see only their payout, never the client's
 * price; the admin sees both.
 *
 *   payout = (price − pass-through costs) × (1 − commission) + pass-through costs
 *
 * Expeditions are arranged by the team (lodges, boats, guides), so they have no
 * automatic payout and never appear on the job board.
 */
import type { CatalogData } from "./catalogModel";

/** Built-in fallback: the live value is pricing_settings.driver_commission_bps (/admin/pricing). */
export const DRIVER_COMMISSION_BPS_DEFAULT = 2000;

export interface Payout {
  /** What the driver is paid, whole cents. */
  payoutCents: number;
  /** What the platform keeps. payoutCents + feeCents = the client's price. */
  feeCents: number;
}

/** Split one booking's price. `passThroughCents` is paid to the driver in full (ferries). */
export function splitPayout(
  totalCents: number,
  passThroughCents: number,
  catalog?: Pick<CatalogData, "driverCommissionBps">,
): Payout {
  const bps = catalog?.driverCommissionBps ?? DRIVER_COMMISSION_BPS_DEFAULT;
  const pass = Math.min(Math.max(0, passThroughCents), Math.max(0, totalCents));
  const fee = Math.round(((totalCents - pass) * bps) / 10000);
  return { payoutCents: totalCents - fee, feeCents: fee };
}

/** Does this kind of booking go on the driver job board with an automatic payout? */
export function hasDriverPayout(kind: string): boolean {
  return kind === "transfer" || kind === "day_tour";
}
