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
 *   pass-through costs (ferry tickets), the Drake Bay boat fee, nor the costs the company pays
 *   (park entrances, lunch, activities on tours and guided stops).
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
  /** The Drake Bay boat fee inside the price (rides): never discounted. */
  boatCents?: number;
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
  const { feeCents } = splitPayout(total, pass, catalog, costs);
  const commission = Math.max(0, feeCents - costs);
  return Math.max(0, Math.min(sharedCents(item), 2 * commission));
}

/**
 * The part of an item a code may discount (and a percent code is a percentage of): the price
 * minus ferries, company-paid costs and the Drake Bay boat fee.
 */
export function sharedCents(item: PromoItemInput): number {
  const total = Math.max(0, item.totalCents);
  const pass = Math.min(Math.max(0, item.passThroughCents), total);
  const costs = Math.min(Math.max(0, item.companyCostCents), total - pass);
  const boat = Math.min(Math.max(0, item.boatCents ?? 0), total - pass - costs);
  return total - pass - costs - boat;
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

/* ---------- The team's form (/admin/promos) ---------- */

/** What the team saves for one code (columns of promo_codes). */
export interface PromoInput {
  code: string;
  description: string | null;
  discount_type: PromoType;
  value: number;
  applies_to: PromoAppliesTo;
  min_order: number;
  valid_from: string | null;
  valid_to: string | null;
  max_uses: number | null;
  max_uses_per_email: number | null;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Check the promo form. Returns the row to save, or the problem in Spanish and English
 * (the team pages are Spanish by default). Money in USD with up to 2 decimals.
 */
export function parsePromoInput(
  v: Record<string, string | undefined>,
): { ok: true; row: PromoInput } | { ok: false; es: string; en: string } {
  const bad = (es: string, en: string) => ({ ok: false as const, es, en });
  const code = normalizePromoCode(v.code ?? "");
  if (!code) {
    return bad(
      "El código debe tener de 3 a 30 letras o números (también - y _), sin espacios.",
      "The code must be 3–30 letters or digits (also - and _), no spaces.",
    );
  }
  const description = (v.description ?? "").trim().replace(/\s+/g, " ");
  if (description.length > 200) return bad("La descripción puede tener hasta 200 caracteres.", "The description can be up to 200 characters.");
  const type = v.discount_type === "fixed" ? "fixed" : v.discount_type === "percent" ? "percent" : null;
  if (!type) return bad("Elija porcentaje o monto fijo.", "Choose percent or fixed amount.");
  const money = (s: string | undefined) => {
    const x = (s ?? "").trim().replace(",", ".");
    return /^\d+(\.\d{1,2})?$/.test(x) ? Number(x) : NaN;
  };
  const value = money(v.value);
  if (!(value > 0)) return bad("Escriba el descuento (mayor que 0).", "Enter the discount (more than 0).");
  if (type === "percent" && value > 100) return bad("Un porcentaje va de 1 a 100.", "A percentage goes from 1 to 100.");
  if (type === "fixed" && value > 10000) return bad("El monto fijo puede ser hasta $10 000.", "A fixed amount can be up to $10,000.");
  const appliesTo: PromoAppliesTo | null =
    v.applies_to === "rides" || v.applies_to === "tours" || v.applies_to === "both" ? v.applies_to : null;
  if (!appliesTo) return bad("Elija a qué se aplica.", "Choose what it applies to.");
  const minOrder = (v.min_order ?? "").trim() === "" ? 0 : money(v.min_order);
  if (!(minOrder >= 0) || minOrder > 100000) return bad("Revise el pedido mínimo.", "Check the minimum order.");
  const from = (v.valid_from ?? "").trim() || null;
  const to = (v.valid_to ?? "").trim() || null;
  if ((from && !YMD.test(from)) || (to && !YMD.test(to))) return bad("Revise las fechas.", "Check the dates.");
  if (from && to && to < from) return bad("La fecha final es antes de la inicial.", "The end date is before the start date.");
  const count = (s: string | undefined) => {
    const x = (s ?? "").trim();
    if (x === "") return null;
    return /^\d{1,6}$/.test(x) && Number(x) > 0 ? Number(x) : NaN;
  };
  const maxUses = count(v.max_uses);
  const perEmail = count(v.max_uses_per_email);
  if (Number.isNaN(maxUses) || Number.isNaN(perEmail)) {
    return bad(
      "Los límites de usos son números enteros mayores que 0, o vacíos (sin límite).",
      "Use limits are whole numbers above 0, or empty (no limit).",
    );
  }
  return {
    ok: true,
    row: {
      code,
      description: description || null,
      discount_type: type,
      value,
      applies_to: appliesTo,
      min_order: minOrder,
      valid_from: from,
      valid_to: to,
      max_uses: maxUses,
      max_uses_per_email: perEmail,
    },
  };
}

/** How a code stands today, for the team's list. */
export type PromoStatus = "active" | "inactive" | "scheduled" | "expired" | "used_up";

export function promoStatus(
  code: Pick<PromoCodeRow, "active" | "valid_from" | "valid_to" | "max_uses">,
  today: string,
  usesTotal: number,
): PromoStatus {
  if (!code.active) return "inactive";
  if (code.valid_to && today > code.valid_to) return "expired";
  if (code.max_uses != null && usesTotal >= code.max_uses) return "used_up";
  if (code.valid_from && today < code.valid_from) return "scheduled";
  return "active";
}

/** "15%" or "$20" (what the code takes off), for the team's list. */
export function promoValueText(code: Pick<PromoCodeRow, "discount_type" | "value">): string {
  const v = Number(code.value);
  return code.discount_type === "percent" ? `${Number(v.toFixed(2))}%` : `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
}
