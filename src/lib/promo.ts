/**
 * Promo codes (CRM part 5, 2026-11-12; docs/PRICING.md §9, docs/PROJECT.md §6.7).
 *
 * Jorge's rule: the discount is split 50/50 between the platform's share and the driver's payout
 * ($20 off → the platform keeps $10 less, the driver is paid $10 less). Drivers only ever see
 * their own payout, never the client's price or the code.
 *
 * Rules, all in whole cents:
 * - Order: season, night premium and ferries are priced first (priceItem); the discount comes last.
 * - Only the part of a booking the platform and the driver share is discounted: never the
 *   pass-through costs (ferry tickets) nor the costs the company pays (park entrances, lunch,
 *   activities on tours and guided stops).
 * - The platform's half never exceeds its commission on that booking, so a code never makes us
 *   pay to run a trip (with the 20% commission: at most 40% off the shared part). A total never
 *   goes below zero.
 * - Percent codes: that percent of each eligible booking's shared part, half-up to the cent.
 *   Fixed codes: the amount once per trip, taken from the eligible bookings in trip order.
 * - Split of each booking's discount: the driver's part is half, ROUNDED DOWN to the cent; the
 *   platform takes the odd cent ($10.01 off → driver $5.00, platform $5.01).
 * - One code per trip (not combinable). Minimum order = the eligible bookings' total before the discount.
 *
 * Pure functions only (shared by the server, the tests and the admin pages). The server parts
 * (loading a code, usage counts, the rate limit) are in src/lib/promoServer.ts.
 */
import { splitPayout } from "./payout";
import type { CatalogData } from "./catalogModel";

export type PromoType = "percent" | "fixed";
export type PromoAppliesTo = "rides" | "tours" | "both";

/** One row of public.promo_codes, as the server reads it. */
export interface PromoCodeRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: PromoType;
  /** Percent (1–100) or USD. */
  value: number | string;
  applies_to: PromoAppliesTo;
  min_order: number | string;
  valid_from: string | null;
  valid_to: string | null;
  max_uses: number | null;
  max_uses_per_email: number | null;
  active: boolean;
}

/** Codes are 3–30 letters, digits, "-" or "_", stored upper-case. */
export const PROMO_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,29}$/;

/** Failed code checks allowed per network address per hour (promo_code_checks, migration 0052). */
export const PROMO_FAILED_CHECKS_PER_HOUR = 10;

/** The one message a traveller sees for any code that can't be used (never says why: no hints for guessing). */
export const PROMO_INVALID_ERROR = "This code isn't valid.";
/** Too many wrong codes from one network. */
export const PROMO_RATE_LIMIT_ERROR = "Too many codes tried. Please wait an hour and try again.";
/** The discount the traveller saw is no longer the server's (e.g. a price changed). */
export const PROMO_CHANGED_ERROR = "Your promo discount has changed. Please check the new total and send again.";

/** Upper-case, trimmed code, or null when it can't be a code at all. */
export function normalizePromoCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return PROMO_CODE_RE.test(c) ? c : null;
}

/** Why a code can't be used (for the team's own view and the tests; travellers only see PROMO_INVALID_ERROR). */
export type PromoProblem = "inactive" | "not_started" | "expired" | "max_uses" | "email_limit" | "min_order" | "nothing_eligible";

export interface PromoItemInput {
  kind: "transfer" | "day_tour";
  /** The item's price before the discount (season, night premium and ferries included). */
  totalCents: number;
  /** Ferry tickets: paid to the driver in full, never discounted. */
  passThroughCents: number;
  /** Park entrances, lunch, activities the company pays: never discounted. */
  companyCostCents: number;
}

export interface PromoLine {
  discountCents: number;
  /** Half of the discount, rounded down to the cent: taken off the driver's payout. */
  driverCents: number;
  /** The rest (gets the odd cent): taken off the platform's share. */
  platformCents: number;
}

export interface PromoResult {
  /** One line per item, in the order given (0 for items the code doesn't cover). */
  lines: PromoLine[];
  totalDiscountCents: number;
}

export function eligibleKind(appliesTo: PromoAppliesTo, kind: string): boolean {
  if (appliesTo === "both") return kind === "transfer" || kind === "day_tour";
  return appliesTo === "rides" ? kind === "transfer" : kind === "day_tour";
}

const toCents = (usd: number | string | null | undefined) => Math.round(Number(usd ?? 0) * 100);

/** Driver's half rounded down to the cent; the platform gets the odd cent. */
export function splitDiscount(discountCents: number): { driverCents: number; platformCents: number } {
  const d = Math.max(0, Math.round(discountCents));
  const driverCents = Math.floor(d / 2);
  return { driverCents, platformCents: d - driverCents };
}

/**
 * The most a code may take off one item: the part the platform and driver share (price minus
 * ferries and company-paid costs), and no more than twice the platform's commission on it (so
 * the platform's half never exceeds what it earns on the trip).
 */
export function maxDiscountCents(item: PromoItemInput, catalog?: Pick<CatalogData, "driverCommissionBps">): number {
  const total = Math.max(0, item.totalCents);
  const pass = Math.min(Math.max(0, item.passThroughCents), total);
  const costs = Math.min(Math.max(0, item.companyCostCents), total - pass);
  const shared = total - pass - costs;
  const { feeCents } = splitPayout(total, pass, catalog, costs);
  const commission = Math.max(0, feeCents - costs);
  return Math.max(0, Math.min(shared, 2 * commission));
}

/** The part of an item a percent code is a percentage of: price minus ferries and company-paid costs. */
export function sharedCents(item: PromoItemInput): number {
  const total = Math.max(0, item.totalCents);
  const pass = Math.min(Math.max(0, item.passThroughCents), total);
  const costs = Math.min(Math.max(0, item.companyCostCents), total - pass);
  return total - pass - costs;
}

/** Sum the code's minimum order is checked against: the eligible items before the discount. */
export function eligibleTotalCents(code: Pick<PromoCodeRow, "applies_to">, items: PromoItemInput[]): number {
  return items.reduce((n, i) => n + (eligibleKind(code.applies_to, i.kind) ? Math.max(0, i.totalCents) : 0), 0);
}

/**
 * Can this code be used now, for these items, by this email? `usesTotal` / `usesByEmail` are
 * trips that already used it (cancelled bookings don't count), from promo_usage().
 */
export function promoProblem(
  code: PromoCodeRow,
  ctx: { today: string; usesTotal: number; usesByEmail: number; items: PromoItemInput[] },
): PromoProblem | null {
  if (!code.active) return "inactive";
  if (code.valid_from && ctx.today < code.valid_from) return "not_started";
  if (code.valid_to && ctx.today > code.valid_to) return "expired";
  if (code.max_uses != null && ctx.usesTotal >= code.max_uses) return "max_uses";
  if (code.max_uses_per_email != null && ctx.usesByEmail >= code.max_uses_per_email) return "email_limit";
  if (!ctx.items.some((i) => eligibleKind(code.applies_to, i.kind))) return "nothing_eligible";
  if (eligibleTotalCents(code, ctx.items) < toCents(code.min_order)) return "min_order";
  return null;
}

/**
 * The discount on each item (see the rules at the top). Assumes promoProblem() returned null.
 * Every line: 0 ≤ discount ≤ maxDiscountCents(item), and driver + platform = discount.
 */
export function applyPromo(
  code: Pick<PromoCodeRow, "discount_type" | "value" | "applies_to">,
  items: PromoItemInput[],
  catalog?: Pick<CatalogData, "driverCommissionBps">,
): PromoResult {
  const value = Number(code.value);
  let fixedLeft = code.discount_type === "fixed" ? Math.max(0, toCents(value)) : 0;
  const lines = items.map((item): PromoLine => {
    if (!eligibleKind(code.applies_to, item.kind)) return { discountCents: 0, driverCents: 0, platformCents: 0 };
    const cap = maxDiscountCents(item, catalog);
    let d: number;
    if (code.discount_type === "percent") {
      const pctBps = Math.round(Math.min(100, Math.max(0, value)) * 100); // 15% → 1500
      d = Math.round((sharedCents(item) * pctBps) / 10000);
    } else {
      d = fixedLeft;
    }
    d = Math.max(0, Math.min(d, cap));
    if (code.discount_type === "fixed") fixedLeft -= d;
    return { discountCents: d, ...splitDiscount(d) };
  });
  return { lines, totalDiscountCents: lines.reduce((n, l) => n + l.discountCents, 0) };
}

/**
 * The booking's money after the discount: what the traveller pays, the driver's payout and the
 * platform's share. `payoutCents` / `feeCents` are splitPayout() of the price before the discount.
 */
export function discountedMoney(
  totalCents: number,
  payout: { payoutCents: number; feeCents: number } | null,
  line: PromoLine,
): { totalCents: number; payoutCents: number | null; feeCents: number | null } {
  return {
    totalCents: Math.max(0, totalCents - line.discountCents),
    payoutCents: payout ? payout.payoutCents - line.driverCents : null,
    feeCents: payout ? payout.feeCents - line.platformCents : null,
  };
}

/** "Promo SUMMER10 −$12.50" / "Promo SUMMER10 −$12.50" (same in Spanish; "Código" reads as a sign-in code there). */
export function promoLineText(code: string, discountCents: number, lang: "en" | "es" = "en"): string {
  const amount = (discountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  return `${lang === "es" ? "Promoción" : "Promo"} ${code} −${amount}`;
}
