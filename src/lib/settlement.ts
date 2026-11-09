/**
 * Money between the company and a driver for one completed trip (Jorge, 2026-11-09):
 * - paid online: we owe the driver their payout;
 * - cash to the driver: they collected the traveller's payment, so they owe us what
 *   they collected minus their payout.
 * Positive = we owe the driver; negative = the driver owes us.
 */
export function settlementUsd(t: { driver_payout: number | string | null; cash_to_collect?: number | string | null }): number {
  const payout = Number(t.driver_payout ?? 0);
  const cash = t.cash_to_collect == null ? 0 : Number(t.cash_to_collect);
  return Math.round((payout - cash) * 100) / 100;
}

/** "We owe you $130" / "You owe us $32" style text. */
export function balanceText(usdAmount: number, we = "We owe you", they = "You owe us"): string {
  const abs = Math.abs(usdAmount).toLocaleString("en-US", { style: "currency", currency: "USD" });
  if (Math.abs(usdAmount) < 0.005) return "Nothing owed either way";
  return usdAmount > 0 ? `${we} ${abs}` : `${they} ${abs}`;
}
