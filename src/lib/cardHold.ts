/**
 * When a card hold is charged or released (Jorge, 2026-11-22, PROJECT.md §6.4).
 *
 * The traveller pays on the last booking step, but Stripe only HOLDS the money on the card. One
 * Stripe payment covers every online-paid booking of that checkout. Then:
 *   - every booking still on it (not cancelled) has a driver → charge them;
 *   - 6 days after the hold at the latest → charge what is still on it, driver or not (a card
 *     hold lasts 7 days; after that the money would be gone);
 *   - every booking on it was cancelled before that → release the hold, nothing is charged.
 * A booking cancelled while others go ahead is left out of the charge (Stripe releases the rest).
 *
 * Pure rules, no database or Stripe calls: src/lib/stripePayments.ts acts on the answer.
 * Tests: scripts/test-card-holds.mjs.
 */

/** Charge on day 6 at the latest (Stripe keeps a card hold for 7 days). */
export const HOLD_CHARGE_AFTER_DAYS = 6;

export interface HeldLine {
  /** The payment row (one per booking per Stripe payment). */
  paymentId: string;
  bookingId: string;
  amountCents: number;
  bookingStatus: string;
  hasDriver: boolean;
}

export type HoldDecision =
  | { action: "wait" }
  | { action: "release" }
  | { action: "charge"; chargeCents: number; charge: string[]; release: string[]; why: "drivers" | "deadline" };

export function decideHold(lines: HeldLine[], heldAt: Date, now: Date): HoldDecision {
  if (lines.length === 0) return { action: "wait" };
  const active = lines.filter((l) => l.bookingStatus !== "cancelled");
  if (active.length === 0) return { action: "release" };
  const allDrivers = active.every((l) => l.hasDriver);
  const deadline = new Date(heldAt.getTime() + HOLD_CHARGE_AFTER_DAYS * 24 * 3600 * 1000);
  if (!allDrivers && now < deadline) return { action: "wait" };
  return {
    action: "charge",
    chargeCents: active.reduce((s, l) => s + l.amountCents, 0),
    charge: active.map((l) => l.paymentId),
    release: lines.filter((l) => l.bookingStatus === "cancelled").map((l) => l.paymentId),
    why: allDrivers ? "drivers" : "deadline",
  };
}

/** When the hold is charged at the latest (shown to the team and the traveller). */
export function holdDeadline(heldAt: Date): Date {
  return new Date(heldAt.getTime() + HOLD_CHARGE_AFTER_DAYS * 24 * 3600 * 1000);
}

/**
 * The bookings a checkout charges for, as Stripe metadata ("b0" = "<booking id>:<cents>").
 * Stripe allows 50 keys of up to 500 characters, so one key per booking is plenty.
 */
export function holdMetadata(lines: { bookingId: string; cents: number }[]): Record<string, string> {
  const out: Record<string, string> = {};
  lines.forEach((l, i) => {
    out[`b${i}`] = `${l.bookingId}:${l.cents}`;
  });
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseHoldMetadata(meta: Record<string, string> | null | undefined): { bookingId: string; cents: number }[] {
  const out: { bookingId: string; cents: number }[] = [];
  for (const [k, v] of Object.entries(meta ?? {})) {
    if (!/^b\d{1,2}$/.test(k)) continue;
    const [id, c] = String(v).split(":");
    const cents = Number(c);
    if (UUID.test(id ?? "") && Number.isInteger(cents) && cents > 0) out.push({ bookingId: id, cents });
  }
  return out;
}

/** What is still to pay online on one booking, in cents: price − received − held. Cash bookings: 0. */
export function onlineDueCents(b: {
  status: string;
  payment_mode: string | null;
  total_price: number | string;
  amount_paid?: number | string | null;
  amount_held?: number | string | null;
}): number {
  if (b.payment_mode === "cash_driver" || b.status === "cancelled" || b.status === "completed") return 0;
  const due = Math.round(Number(b.total_price) * 100) - Math.round(Number(b.amount_paid ?? 0) * 100) - Math.round(Number(b.amount_held ?? 0) * 100);
  return due > 0 ? due : 0;
}
