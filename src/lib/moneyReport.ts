/**
 * The money report (/admin/reports; CRM part 5, 2026-11-12). Pure maths on booking rows, so the
 * page, the CSV and the tests (scripts/test-money-report.mjs) add up the same way.
 *
 * Definitions (shown under each number on the page):
 * - Period: by PICKUP date in Costa Rica (bookings.scheduled_at), not the day it was booked or paid.
 * - Left out everywhere: test bookings (any payment with provider 'test'). Cancelled bookings are
 *   left out of revenue, shares and breakdowns; they only appear under refunds.
 * - Booked = what travellers owe for the counted bookings: total_price (already after any promo
 *   discount) + cash booking fee.
 * - Received online = amount_paid (card payment, or a transfer the team recorded).
 *   Received in cash = cash-to-driver trips that are completed: what the driver collected
 *   (booked − amount_paid), the same "cash to collect" the driver app and /admin/payouts use.
 *   Outstanding = booked − received online − received in cash.
 * - Driver payouts = bookings.driver_payout (the stored payout: 80% of the shared part + ferries,
 *   minus the driver's half of any promo, or the accepted offer). Platform share = total_price −
 *   driver_payout; it includes the company-paid costs (entrances, lunch, activities), shown
 *   separately, and is before cash booking fees (also shown separately).
 * - Settlements: settlementUsd() from src/lib/settlement.ts (the /admin/payouts maths) on
 *   completed trips with a driver: positive = we owe the driver, negative = the driver owes us.
 * - Refunds: booking_refunds of cancelled bookings in the period (owed = refund_due, paid =
 *   refund_paid_amount).
 * - Promo discounts: bookings.promo_discount; the platform / driver parts from promo_redemptions
 *   (or, if a row is missing, splitDiscount()).
 *
 * All sums are in whole cents to avoid floating-point drift.
 */
import { splitDiscount } from "./promo";
import { settlementUsd } from "./settlement";

export interface ReportBooking {
  id: string;
  booking_ref: string;
  service_type: string;
  status: string;
  scheduled_at: string | null;
  /** Route label ("SJO Airport / San José → Manuel Antonio") or tour name, for breakdowns. */
  route: string;
  vehicle_class: string | null;
  payment_mode: string | null;
  total_price: number | string;
  cash_fee: number | string | null;
  amount_paid: number | string | null;
  driver_payout: number | string | null;
  company_costs: number | string | null;
  night_premium: number | string | null;
  /** Ferry tickets (null before migration 0052). */
  pass_through: number | string | null;
  promo_code: string | null;
  promo_discount: number | string | null;
  assigned_driver_id: string | null;
  driver_settled_at: string | null;
  /** Any payment with provider 'test'. */
  is_test: boolean;
}

export interface ReportRefund {
  booking_id: string;
  amount_received: number | string;
  refund_due: number | string;
  refund_paid_amount: number | string | null;
}

export interface ReportRedemption {
  booking_id: string;
  platform_part: number | string;
  driver_part: number | string;
}

const c = (v: number | string | null | undefined) => Math.round(Number(v ?? 0) * 100) || 0;

/** Why a booking isn't in the totals (null = counted). */
export function exclusion(b: Pick<ReportBooking, "is_test" | "status">): "test" | "cancelled" | null {
  if (b.is_test) return "test";
  if (b.status === "cancelled") return "cancelled";
  return null;
}

/** One booking's money, in cents (the CSV line and every sum come from this). */
export interface BookingMoney {
  bookedCents: number;
  listCents: number;
  onlineCents: number;
  cashCents: number;
  outstandingCents: number;
  /** null when the booking has no automatic payout (retired multi-day trips). */
  payoutCents: number | null;
  platformCents: number | null;
  companyCostCents: number;
  passThroughCents: number;
  nightCents: number;
  cashFeeCents: number;
  discountCents: number;
  discountPlatformCents: number;
  discountDriverCents: number;
  /** settlementUsd() in cents for completed trips with a driver; null otherwise. */
  settlementCents: number | null;
}

export function bookingMoney(b: ReportBooking, redemption?: ReportRedemption): BookingMoney {
  const total = c(b.total_price);
  const cashFee = c(b.cash_fee);
  const booked = total + cashFee;
  const online = Math.min(Math.max(0, c(b.amount_paid)), booked);
  const isCash = b.payment_mode === "cash_driver";
  const completed = b.status === "completed";
  const cash = isCash && completed ? Math.max(0, booked - online) : 0;
  const payout = b.driver_payout == null ? null : c(b.driver_payout);
  const discount = c(b.promo_discount);
  const split = redemption ? { platformCents: c(redemption.platform_part), driverCents: c(redemption.driver_part) } : splitDiscount(discount);
  let settlement: number | null = null;
  if (completed && b.assigned_driver_id && b.driver_payout != null) {
    const cashToCollect = isCash ? (booked - online) / 100 : null;
    settlement = Math.round(settlementUsd({ driver_payout: b.driver_payout, cash_to_collect: cashToCollect }) * 100);
  }
  return {
    bookedCents: booked,
    listCents: total + discount,
    onlineCents: online,
    cashCents: cash,
    outstandingCents: Math.max(0, booked - online - cash),
    payoutCents: payout,
    platformCents: payout == null ? null : total - payout,
    companyCostCents: c(b.company_costs),
    passThroughCents: c(b.pass_through),
    nightCents: c(b.night_premium),
    cashFeeCents: cashFee,
    discountCents: discount,
    discountPlatformCents: discount > 0 ? split.platformCents : 0,
    discountDriverCents: discount > 0 ? split.driverCents : 0,
    settlementCents: settlement,
  };
}

export interface Group {
  key: string;
  trips: number;
  bookedCents: number;
  payoutCents: number;
  platformCents: number;
}

export interface MoneyReport {
  counted: number;
  excludedTest: number;
  cancelled: number;
  revenue: { bookedCents: number; onlineCents: number; cashCents: number; outstandingCents: number; receivedCents: number };
  split: {
    payoutCents: number;
    platformCents: number;
    companyCostCents: number;
    /** Platform share minus company-paid costs: our commission. */
    commissionCents: number;
    passThroughCents: number;
    nightCents: number;
    cashFeeCents: number;
    /** Bookings with ferries recorded (pass_through not null), for the note under the number. */
    passThroughKnown: number;
    /** Bookings with no automatic payout (old multi-day trips): their price isn't split. */
    unsplitCents: number;
  };
  drivers: {
    /** Cash collected by drivers on completed cash trips. */
    cashCollectedCents: number;
    /** Completed trips, not yet settled: what we owe drivers / what drivers owe us. */
    toSettle: { weOweCents: number; theyOweCents: number; trips: number };
    /** Completed trips already settled in this period's pickups. */
    settled: { weOweCents: number; theyOweCents: number; trips: number };
  };
  refunds: { bookings: number; receivedCents: number; owedCents: number; paidCents: number; stillToPayCents: number; keptCents: number };
  promos: { bookings: number; discountCents: number; platformCents: number; driverCents: number; byCode: { code: string; bookings: number; discountCents: number }[] };
  byService: Group[];
  byVehicle: Group[];
  byRoute: Group[];
  byDriver: Group[];
}

function addTo(map: Map<string, Group>, key: string, m: BookingMoney) {
  const g = map.get(key) ?? { key, trips: 0, bookedCents: 0, payoutCents: 0, platformCents: 0 };
  g.trips++;
  g.bookedCents += m.bookedCents;
  g.payoutCents += m.payoutCents ?? 0;
  g.platformCents += m.platformCents ?? 0;
  map.set(key, g);
}

const sorted = (m: Map<string, Group>) => [...m.values()].sort((a, b) => b.bookedCents - a.bookedCents || a.key.localeCompare(b.key));

/** Add up a period. `rows` are the bookings with a pickup in the period (any status). */
export function computeMoneyReport(rows: ReportBooking[], refunds: ReportRefund[], redemptions: ReportRedemption[]): MoneyReport {
  const red = new Map(redemptions.map((r) => [r.booking_id, r]));
  const r: MoneyReport = {
    counted: 0,
    excludedTest: 0,
    cancelled: 0,
    revenue: { bookedCents: 0, onlineCents: 0, cashCents: 0, outstandingCents: 0, receivedCents: 0 },
    split: { payoutCents: 0, platformCents: 0, companyCostCents: 0, commissionCents: 0, passThroughCents: 0, nightCents: 0, cashFeeCents: 0, passThroughKnown: 0, unsplitCents: 0 },
    drivers: { cashCollectedCents: 0, toSettle: { weOweCents: 0, theyOweCents: 0, trips: 0 }, settled: { weOweCents: 0, theyOweCents: 0, trips: 0 } },
    refunds: { bookings: 0, receivedCents: 0, owedCents: 0, paidCents: 0, stillToPayCents: 0, keptCents: 0 },
    promos: { bookings: 0, discountCents: 0, platformCents: 0, driverCents: 0, byCode: [] },
    byService: [],
    byVehicle: [],
    byRoute: [],
    byDriver: [],
  };
  const service = new Map<string, Group>();
  const vehicle = new Map<string, Group>();
  const route = new Map<string, Group>();
  const driver = new Map<string, Group>();
  const codes = new Map<string, { code: string; bookings: number; discountCents: number }>();
  const cancelledIds = new Set<string>();

  for (const b of rows) {
    const why = exclusion(b);
    if (why === "test") {
      r.excludedTest++;
      continue;
    }
    if (why === "cancelled") {
      r.cancelled++;
      cancelledIds.add(b.id);
      continue;
    }
    r.counted++;
    const m = bookingMoney(b, red.get(b.id));
    r.revenue.bookedCents += m.bookedCents;
    r.revenue.onlineCents += m.onlineCents;
    r.revenue.cashCents += m.cashCents;
    r.revenue.outstandingCents += m.outstandingCents;
    if (m.payoutCents != null) {
      r.split.payoutCents += m.payoutCents;
      r.split.platformCents += m.platformCents ?? 0;
      r.split.companyCostCents += m.companyCostCents;
    } else {
      r.split.unsplitCents += c(b.total_price);
    }
    r.split.passThroughCents += m.passThroughCents;
    if (b.pass_through != null) r.split.passThroughKnown++;
    r.split.nightCents += m.nightCents;
    r.split.cashFeeCents += m.cashFeeCents;
    r.drivers.cashCollectedCents += m.cashCents;
    if (m.settlementCents != null) {
      const bucket = b.driver_settled_at ? r.drivers.settled : r.drivers.toSettle;
      bucket.trips++;
      if (m.settlementCents > 0) bucket.weOweCents += m.settlementCents;
      else bucket.theyOweCents += -m.settlementCents;
    }
    if (m.discountCents > 0) {
      r.promos.bookings++;
      r.promos.discountCents += m.discountCents;
      r.promos.platformCents += m.discountPlatformCents;
      r.promos.driverCents += m.discountDriverCents;
      const code = b.promo_code ?? "?";
      const e = codes.get(code) ?? { code, bookings: 0, discountCents: 0 };
      e.bookings++;
      e.discountCents += m.discountCents;
      codes.set(code, e);
    }
    addTo(service, b.service_type, m);
    if (b.service_type === "transfer") {
      addTo(vehicle, b.vehicle_class ?? "?", m);
      addTo(route, b.route || "?", m);
    } else if (b.service_type === "day_tour") {
      addTo(route, b.route || "?", m);
    }
    if (b.assigned_driver_id) addTo(driver, b.assigned_driver_id, m);
  }
  r.revenue.receivedCents = r.revenue.onlineCents + r.revenue.cashCents;
  r.split.commissionCents = r.split.platformCents - r.split.companyCostCents;

  for (const f of refunds) {
    if (!cancelledIds.has(f.booking_id)) continue; // test bookings and other periods stay out
    const due = c(f.refund_due);
    const paid = c(f.refund_paid_amount);
    r.refunds.bookings++;
    r.refunds.receivedCents += c(f.amount_received);
    r.refunds.owedCents += due;
    r.refunds.paidCents += paid;
    r.refunds.stillToPayCents += Math.max(0, due - paid);
    r.refunds.keptCents += Math.max(0, c(f.amount_received) - due);
  }

  r.promos.byCode = [...codes.values()].sort((a, b) => b.discountCents - a.discountCents);
  r.byService = sorted(service);
  r.byVehicle = sorted(vehicle);
  r.byRoute = sorted(route).slice(0, 10);
  r.byDriver = sorted(driver);
  return r;
}

/* ---------- Period ---------- */

export interface ReportPeriod {
  /** First and last pickup day (Costa Rica), inclusive. */
  from: string;
  to: string;
  /** "2026-11" when the period is a calendar month. */
  month: string | null;
  /** The period just before, same length (the month before, for a month). */
  prevFrom: string;
  prevTo: string;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from, to };
}
const validYmd = (s: string) => YMD.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/**
 * ?month=YYYY-MM, or ?from=YYYY-MM-DD&to=YYYY-MM-DD (at most 366 days). Default: the Costa Rica
 * month of `today`.
 */
export function parseReportPeriod(q: Record<string, string | string[] | undefined>, today: string): ReportPeriod {
  const one = (k: string) => {
    const v = q[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const from = one("from");
  const to = one("to");
  if (validYmd(from) && validYmd(to) && from <= to) {
    const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
    if (days <= 366) {
      // A range that is exactly one calendar month compares with the month before.
      const ym = from.slice(0, 7);
      const whole = from.endsWith("-01") && monthRange(ym).to === to;
      if (whole) return monthPeriod(ym);
      return { from, to, month: null, prevFrom: addDaysYmd(from, -days), prevTo: addDaysYmd(from, -1) };
    }
  }
  const month = one("month");
  return monthPeriod(YM.test(month) ? month : today.slice(0, 7));
}

function monthPeriod(ym: string): ReportPeriod {
  const { from, to } = monthRange(ym);
  const [y, m] = ym.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const p = monthRange(prev);
  return { from, to, month: ym, prevFrom: p.from, prevTo: p.to };
}

/** Change from the previous period in %, rounded; null when the previous one is 0. */
export function changePct(now: number, before: number): number | null {
  if (!Number.isFinite(now) || !Number.isFinite(before) || before === 0) return null;
  return Math.round(((now - before) / Math.abs(before)) * 100);
}

/** Bar width (0–100) for simple CSS bars. */
export function barPct(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.max(2, Math.round((value / max) * 100));
}
