/**
 * Cases for CRM part 5 (2026-11-12): the money report and promo codes.
 *   - promo rules (src/lib/promo.ts): expired, not started, inactive, total and per-email limits,
 *     minimum order, rides / tours / both, percent vs fixed, never below zero, ferries and
 *     company-paid costs never discounted, the platform's half never above its commission,
 *     the 50/50 split with odd cents (driver's half rounded down);
 *   - the team's promo form (parsePromoInput) and the code's status;
 *   - what the server saves equals what the website and the app show (cartTotals, the app's sum);
 *   - the money report (src/lib/moneyReport.ts) on fixtures: test and cancelled bookings left out,
 *     card vs cash, outstanding, shares, settlements, refunds, promo split, breakdowns, periods.
 *
 *   npm run test:money        (Node 22.15+; Node runs the TypeScript directly)
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const warn = console.warn;
console.warn = () => {};
const pr = await import("../src/lib/promo.ts");
const mr = await import("../src/lib/moneyReport.ts");
const { splitPayout } = await import("../src/lib/payout.ts");
const { cashFeeCents } = await import("../src/lib/pricing.ts");
const { cartTotals } = await import("../src/lib/cart.ts");
const trip = await import("../src/lib/tripRequest.ts");
const { BUILT_IN_CATALOG } = await import("../src/lib/catalogModel.ts");
const { settlementUsd } = await import("../src/lib/settlement.ts");
console.warn = warn;

let passed = 0;
const failures = [];
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};
const ok = (name, cond) => (cond ? passed++ : failures.push(name));

const catalog = BUILT_IN_CATALOG; // 20% commission, 10% cash fee
const TODAY = "2026-11-12";
const code = (over = {}) => ({
  id: "c1",
  code: "SUMMER10",
  description: null,
  discount_type: "percent",
  value: 10,
  applies_to: "both",
  min_order: 0,
  valid_from: null,
  valid_to: null,
  max_uses: null,
  max_uses_per_email: null,
  active: true,
  ...over,
});
const ride = (totalCents, passThroughCents = 0) => ({ kind: "transfer", totalCents, passThroughCents, companyCostCents: 0 });
const tour = (totalCents, companyCostCents) => ({ kind: "day_tour", totalCents, passThroughCents: 0, companyCostCents });
const ctx = (items, over = {}) => ({ today: TODAY, usesTotal: 0, usesByEmail: 0, items, ...over });

// --- Promo codes: can it be used? ----------------------------------------------------------------
eq("valid code → no problem", pr.promoProblem(code(), ctx([ride(20000)])), null);
eq("inactive", pr.promoProblem(code({ active: false }), ctx([ride(20000)])), "inactive");
eq("expired (valid_to yesterday)", pr.promoProblem(code({ valid_to: "2026-11-11" }), ctx([ride(20000)])), "expired");
eq("last valid day still works", pr.promoProblem(code({ valid_to: TODAY }), ctx([ride(20000)])), null);
eq("not started yet", pr.promoProblem(code({ valid_from: "2026-11-13" }), ctx([ride(20000)])), "not_started");
eq("max total uses reached", pr.promoProblem(code({ max_uses: 3 }), ctx([ride(20000)], { usesTotal: 3 })), "max_uses");
eq("one use left still works", pr.promoProblem(code({ max_uses: 3 }), ctx([ride(20000)], { usesTotal: 2 })), null);
eq("per-email limit reached", pr.promoProblem(code({ max_uses_per_email: 1 }), ctx([ride(20000)], { usesByEmail: 1 })), "email_limit");
eq("minimum order not met", pr.promoProblem(code({ min_order: 250 }), ctx([ride(20000)])), "min_order");
eq("minimum order met exactly", pr.promoProblem(code({ min_order: 200 }), ctx([ride(20000)])), null);
eq("min order counts only eligible items (rides code, tour in cart)", pr.promoProblem(code({ applies_to: "rides", min_order: 250 }), ctx([ride(20000), tour(30000, 5000)])), "min_order");
eq("rides-only code on a tour-only trip", pr.promoProblem(code({ applies_to: "rides" }), ctx([tour(30000, 5000)])), "nothing_eligible");
eq("tours-only code on a ride-only trip", pr.promoProblem(code({ applies_to: "tours" }), ctx([ride(20000)])), "nothing_eligible");
eq("normalize: lower case and spaces", pr.normalizePromoCode("  summer10 "), "SUMMER10");
eq("normalize: too short", pr.normalizePromoCode("ab"), null);
eq("normalize: no spaces inside", pr.normalizePromoCode("SUM MER"), null);
eq("normalize: not a string", pr.normalizePromoCode(42), null);

// --- Promo codes: how much, and who pays it ------------------------------------------------------
// $200 ride, no ferry: shared part 20000, platform commission 4000 → cap 8000 (40%).
let res = pr.applyPromo(code(), [ride(20000)], catalog);
eq("10% of a $200 ride = $20", res.totalDiscountCents, 2000);
eq("$20 split: driver $10, platform $10", [res.lines[0].driverCents, res.lines[0].platformCents], [1000, 1000]);
res = pr.applyPromo(code({ discount_type: "fixed", value: 20 }), [ride(20000)], catalog);
eq("fixed $20 off a $200 ride", res.totalDiscountCents, 2000);
// Odd cents: 10% of $100.05 = $10.005 → $10.01 (half-up); driver gets $5.00 (rounded down), platform $5.01.
res = pr.applyPromo(code(), [ride(10005)], catalog);
eq("percent rounds half-up to the cent", res.totalDiscountCents, 1001);
eq("odd cent: driver's half rounded down", res.lines[0].driverCents, 500);
eq("odd cent: platform takes the extra cent", res.lines[0].platformCents, 501);
eq("splitDiscount(1)", pr.splitDiscount(1), { driverCents: 0, platformCents: 1 });
eq("splitDiscount(2001)", pr.splitDiscount(2001), { driverCents: 1000, platformCents: 1001 });
// Ferries are never discounted: $230 = $200 ride + $30 ferry; 10% is of the $200.
res = pr.applyPromo(code(), [ride(23000, 3000)], catalog);
eq("ferry not discounted (10% of the $200 part)", res.totalDiscountCents, 2000);
// Tour: $300 with $100 entrances/lunch the company pays: shared part $200.
res = pr.applyPromo(code(), [tour(30000, 10000)], catalog);
eq("company-paid costs not discounted (10% of $200)", res.totalDiscountCents, 2000);
// Platform's half never above its commission: 50% off a $200 ride would be $100, capped at 2 × $40 = $80.
res = pr.applyPromo(code({ value: 50 }), [ride(20000)], catalog);
eq("50% capped at twice our commission", res.totalDiscountCents, 8000);
eq("…our half equals our whole commission", res.lines[0].platformCents, 4000);
// Never below zero: a $500 fixed code on a $50 ride.
res = pr.applyPromo(code({ discount_type: "fixed", value: 500 }), [ride(5000)], catalog);
ok("fixed code never makes a total negative", res.totalDiscountCents <= 5000 && 5000 - res.totalDiscountCents >= 0);
eq("…and stays within the cap ($50 ride → $20 max)", res.totalDiscountCents, 2000);
res = pr.applyPromo(code({ value: 100 }), [ride(0)], catalog);
eq("a free item gets no discount", res.totalDiscountCents, 0);
// Fixed code: once per trip, spread over the items in order.
res = pr.applyPromo(code({ discount_type: "fixed", value: 50 }), [ride(10000), ride(20000)], catalog);
eq("fixed $50 over two rides: first capped at $40, rest $10 on the second", res.lines.map((l) => l.discountCents), [4000, 1000]);
eq("…total is the code's amount", res.totalDiscountCents, 5000);
// Percent: every eligible item.
res = pr.applyPromo(code({ applies_to: "rides" }), [ride(10000), tour(30000, 10000)], catalog);
eq("rides-only percent code skips the tour", res.lines.map((l) => l.discountCents), [1000, 0]);
// Payout after the discount: exactly half the discount (driver's half) less than without it.
const payout = splitPayout(23000, 3000, catalog, 0);
const line = pr.applyPromo(code(), [ride(23000, 3000)], catalog).lines[0];
const after = pr.discountedMoney(23000, payout, line);
eq("payout without code: (230−30)×0.8+30 = $190", payout.payoutCents, 19000);
eq("payout reduced by the driver's half only", payout.payoutCents - after.payoutCents, 1000);
eq("platform fee reduced by the platform's half", payout.feeCents - after.feeCents, 1000);
eq("payout + fee still = what the traveller pays", after.payoutCents + after.feeCents, after.totalCents);
eq("ferry still paid in full (payout − ferry = 80% of the shared part − driver's half)", after.payoutCents - 3000, 16000 - 1000);
// Random check: for many prices and codes, the split always adds up and stays inside the limits.
let allGood = true;
for (let i = 0; i < 2000; i++) {
  const total = 1000 + ((i * 7919) % 90000);
  const pass = (i % 3) * 1500;
  const costs = i % 5 === 0 ? 2000 : 0;
  const item = { kind: i % 2 ? "transfer" : "day_tour", totalCents: total, passThroughCents: pass, companyCostCents: costs };
  const c = i % 2 ? code({ value: 1 + (i % 100) }) : code({ discount_type: "fixed", value: (i % 300) + 0.37 });
  const l = pr.applyPromo(c, [item], catalog).lines[0];
  const p = splitPayout(total, pass, catalog, costs);
  const m = pr.discountedMoney(total, p, l);
  if (
    l.driverCents + l.platformCents !== l.discountCents ||
    l.driverCents !== Math.floor(l.discountCents / 2) ||
    m.totalCents < Math.min(pass, total) + Math.min(costs, Math.max(0, total - pass)) ||
    m.feeCents < Math.min(costs, Math.max(0, total - pass)) ||
    m.payoutCents < Math.min(pass, total) ||
    m.totalCents < 0
  ) {
    allGood = false;
    failures.push(`random case ${i}: ${JSON.stringify({ total, pass, costs, l, m })}`);
    break;
  }
}
ok("2000 random cases: split adds up, ferries / company costs / commission respected", allGood);

// --- What the traveller sees = what the server saves ----------------------------------------------
{
  const DATE = "2026-12-15";
  const spec = trip.parseSpec({ kind: "transfer", origin: "SJO", destination: "ManuelAntonio", vehicleId: "sedan", stopIds: [], pax: 2, pickupTime: "09:00" });
  const tourSpec = trip.parseSpec({ kind: "day_tour", tourId: catalog.dayTours[0].id, upgrade: false, pax: 2, pickupPlace: "Hotel Test" });
  const a = trip.priceItem(spec, DATE, catalog, null);
  const b = trip.priceItem(tourSpec, DATE, catalog, null);
  const items = [
    { id: "i1", kind: "transfer", totalCents: a.totalCents },
    { id: "i2", kind: "day_tour", totalCents: b.totalCents },
  ];
  const promoItems = [
    { kind: "transfer", totalCents: a.totalCents, passThroughCents: a.passThroughCents, companyCostCents: a.companyCostCents },
    { kind: "day_tour", totalCents: b.totalCents, passThroughCents: b.passThroughCents, companyCostCents: b.companyCostCents },
  ];
  for (const [label, c] of [["percent 15", code({ value: 15 })], ["fixed $33.33", code({ discount_type: "fixed", value: 33.33 })]]) {
    const r = pr.applyPromo(c, promoItems, catalog);
    const perItem = { i1: r.lines[0].discountCents, i2: r.lines[1].discountCents };
    for (const mode of ["full_100", "cash_driver"]) {
      // Website: cartTotals with the server's per-item discounts.
      const web = cartTotals(items, mode, catalog.cashFeeBps, perItem);
      // Server (src/app/trip/actions.ts): pay = price − discount; cash fee on pay; payout from splitPayout − driver's half.
      let server = 0;
      promoItems.forEach((it, i) => {
        const m = pr.discountedMoney(it.totalCents, splitPayout(it.totalCents, it.passThroughCents, catalog, it.companyCostCents), r.lines[i]);
        server += m.totalCents + (mode === "cash_driver" ? cashFeeCents(m.totalCents, catalog.cashFeeBps) : 0);
      });
      eq(`${label}, ${mode}: website total = server total`, web.totalCents, server);
      eq(`${label}, ${mode}: website discount line = server discount`, web.discountCents, r.totalDiscountCents);
      // App (apps/client: Confirm.tsx / Review.tsx), one item: pay = total − discount; fee = round(pay × bps / 10000).
      const pay = a.totalCents - r.lines[0].discountCents;
      const appTotal = mode === "cash_driver" ? pay + Math.round((pay * catalog.cashFeeBps) / 10000) : pay;
      const one = cartTotals([items[0]], mode, catalog.cashFeeBps, { i1: r.lines[0].discountCents });
      eq(`${label}, ${mode}: app total = server total (ride)`, appTotal, one.totalCents);
    }
  }
  eq("no code: cartTotals as before", cartTotals(items, "full_100", catalog.cashFeeBps).totalCents, a.totalCents + b.totalCents);
}

// --- The team's form -----------------------------------------------------------------------------
const form = (over = {}) => ({ code: "verano10", description: "  Promo  de verano ", discount_type: "percent", value: "10", applies_to: "both", min_order: "", valid_from: "", valid_to: "", max_uses: "", max_uses_per_email: "", ...over });
let f = pr.parsePromoInput(form());
eq("form: code upper-cased, description tidied", f.ok && [f.row.code, f.row.description, f.row.min_order, f.row.max_uses], ["VERANO10", "Promo de verano", 0, null]);
ok("form: percent above 100 refused", !pr.parsePromoInput(form({ value: "120" })).ok);
ok("form: zero refused", !pr.parsePromoInput(form({ value: "0" })).ok);
ok("form: three decimals refused", !pr.parsePromoInput(form({ discount_type: "fixed", value: "10.555" })).ok);
eq("form: comma decimal accepted", pr.parsePromoInput(form({ discount_type: "fixed", value: "12,50" })).row?.value, 12.5);
ok("form: end before start refused", !pr.parsePromoInput(form({ valid_from: "2026-12-10", valid_to: "2026-12-01" })).ok);
ok("form: bad use limit refused", !pr.parsePromoInput(form({ max_uses: "-1" })).ok);
ok("form: unknown applies_to refused", !pr.parsePromoInput(form({ applies_to: "boats" })).ok);
ok("form errors come in both languages", (() => { const x = pr.parsePromoInput(form({ code: "x" })); return !x.ok && x.es && x.en && x.es !== x.en; })());
eq("status: active", pr.promoStatus(code(), TODAY, 0), "active");
eq("status: used up", pr.promoStatus(code({ max_uses: 2 }), TODAY, 2), "used_up");
eq("status: scheduled", pr.promoStatus(code({ valid_from: "2026-12-01" }), TODAY, 0), "scheduled");
eq("status: expired", pr.promoStatus(code({ valid_to: "2026-11-01" }), TODAY, 0), "expired");
eq("status: off beats everything", pr.promoStatus(code({ active: false, valid_to: "2026-11-01" }), TODAY, 0), "inactive");
eq("value text", [pr.promoValueText(code({ value: 12.5 })), pr.promoValueText(code({ discount_type: "fixed", value: 20 }))], ["12.5%", "$20"]);

// --- Money report ---------------------------------------------------------------------------------
const B = (over) => ({
  id: over.id,
  booking_ref: "CRPT-" + over.id,
  service_type: "transfer",
  status: "completed",
  scheduled_at: "2026-11-20T15:00:00Z",
  route: "SJO Airport / San José → Manuel Antonio",
  vehicle_class: "sedan",
  payment_mode: "full_100",
  total_price: 200,
  cash_fee: 0,
  amount_paid: 200,
  driver_payout: 160,
  company_costs: 0,
  night_premium: 0,
  pass_through: 0,
  promo_code: null,
  promo_discount: 0,
  assigned_driver_id: "d1",
  driver_settled_at: null,
  is_test: false,
  ...over,
});
const rows = [
  // 1. Online, paid by card, completed, not settled: we owe $160.
  B({ id: "1" }),
  // 2. Cash to the driver, completed: driver collected $220 (200 + 10% fee), payout 160 → owes us $60.
  B({ id: "2", payment_mode: "cash_driver", cash_fee: 20, amount_paid: 0 }),
  // 3. Cash, not done yet: outstanding $110 (100 + 10).
  B({ id: "3", status: "confirmed", payment_mode: "cash_driver", total_price: 100, cash_fee: 10, amount_paid: 0, driver_payout: 80, assigned_driver_id: "d2" }),
  // 4. Online, unpaid, with a $20 promo (SUMMER10): price $180 after it, payout 160 − 10 = 150; ferry $30 + night $15.
  B({ id: "4", status: "confirmed", amount_paid: 0, total_price: 180, driver_payout: 150, promo_code: "SUMMER10", promo_discount: 20, pass_through: 30, night_premium: 15, assigned_driver_id: null }),
  // 5. Day tour, paid, settled; company costs $50; payout (300 − 50) × 0.8 = 200.
  B({ id: "5", service_type: "day_tour", route: "Arenal Volcano Hike", vehicle_class: null, total_price: 300, amount_paid: 300, driver_payout: 200, company_costs: 50, driver_settled_at: "2026-11-25T00:00:00Z", pass_through: null }),
  // 6. Test booking (test payment): left out completely.
  B({ id: "6", is_test: true, total_price: 999, amount_paid: 999 }),
  // 7. Cancelled: only under refunds ($120 received, $120 owed, $50 paid so far).
  B({ id: "7", status: "cancelled", amount_paid: 120, total_price: 120 }),
  // 8. Cancelled late: $80 received, nothing owed (we keep $80).
  B({ id: "8", status: "cancelled", amount_paid: 80, total_price: 80 }),
  // 9. Cancelled TEST booking with a refund row: stays out of refunds too.
  B({ id: "9", status: "cancelled", is_test: true }),
];
const refunds = [
  { booking_id: "7", amount_received: 120, refund_due: 120, refund_paid_amount: 50 },
  { booking_id: "8", amount_received: 80, refund_due: 0, refund_paid_amount: null },
  { booking_id: "9", amount_received: 200, refund_due: 200, refund_paid_amount: 200 },
];
const reds = [{ booking_id: "4", platform_part: 10, driver_part: 10 }];
const rep = mr.computeMoneyReport(rows, refunds, reds);
eq("counted / test / cancelled", [rep.counted, rep.excludedTest, rep.cancelled], [5, 2, 2]);
eq("booked = prices after discounts + cash fees", rep.revenue.bookedCents, (200 + 220 + 110 + 180 + 300) * 100);
eq("received online (card)", rep.revenue.onlineCents, (200 + 300) * 100);
eq("received in cash (completed cash trips only)", rep.revenue.cashCents, 220 * 100);
eq("outstanding", rep.revenue.outstandingCents, (110 + 180) * 100);
eq("received = online + cash", rep.revenue.receivedCents, 720 * 100);
eq("driver payouts", rep.split.payoutCents, (160 + 160 + 80 + 150 + 200) * 100);
eq("platform share = price − payout", rep.split.platformCents, (40 + 40 + 20 + 30 + 100) * 100);
eq("company costs", rep.split.companyCostCents, 50 * 100);
eq("commission = share − company costs", rep.split.commissionCents, 180 * 100);
eq("cash booking fees", rep.split.cashFeeCents, 30 * 100);
eq("ferries", rep.split.passThroughCents, 30 * 100);
eq("ferries recorded on 4 of 5 bookings", rep.split.passThroughKnown, 4);
eq("night premium", rep.split.nightCents, 15 * 100);
eq("cash collected by drivers", rep.drivers.cashCollectedCents, 220 * 100);
eq("to settle: we owe $160 on 1, driver owes $60 on 2", rep.drivers.toSettle, { weOweCents: 16000, theyOweCents: 6000, trips: 2 });
eq("settled: $200 paid on the tour", rep.drivers.settled, { weOweCents: 20000, theyOweCents: 0, trips: 1 });
eq("settlement matches /admin/payouts maths", Math.round(settlementUsd({ driver_payout: 160, cash_to_collect: 220 }) * 100), -6000);
eq("refunds (test booking left out)", rep.refunds, { bookings: 2, receivedCents: 20000, owedCents: 12000, paidCents: 5000, stillToPayCents: 7000, keptCents: 8000 });
eq("promo totals and split", [rep.promos.bookings, rep.promos.discountCents, rep.promos.platformCents, rep.promos.driverCents], [1, 2000, 1000, 1000]);
eq("promo by code", rep.promos.byCode, [{ code: "SUMMER10", bookings: 1, discountCents: 2000 }]);
eq("by service", rep.byService.map((g) => [g.key, g.trips, g.bookedCents]), [["transfer", 4, 71000], ["day_tour", 1, 30000]]);
eq("by vehicle (rides only)", rep.byVehicle.map((g) => [g.key, g.trips]), [["sedan", 4]]);
eq("by route: tours and rides, biggest first", rep.byRoute.map((g) => g.key), ["SJO Airport / San José → Manuel Antonio", "Arenal Volcano Hike"]);
eq("by driver: unassigned left out", rep.byDriver.map((g) => [g.key, g.trips, g.payoutCents]), [["d1", 3, 52000], ["d2", 1, 8000]]);
// Missing redemption row: the split comes from the rule (driver rounded down).
const odd = mr.computeMoneyReport([B({ id: "x", promo_code: "ODD", promo_discount: 10.01 })], [], []);
eq("odd-cent promo without a redemption row: driver $5.00, platform $5.01", [odd.promos.driverCents, odd.promos.platformCents], [500, 501]);
// Top 10 routes only.
const many = Array.from({ length: 14 }, (_, i) => B({ id: "r" + i, route: "Route " + String(i).padStart(2, "0"), total_price: 100 + i }));
eq("top 10 routes", mr.computeMoneyReport(many, [], []).byRoute.length, 10);
eq("empty period", mr.computeMoneyReport([], [], []).revenue, { bookedCents: 0, onlineCents: 0, cashCents: 0, outstandingCents: 0, receivedCents: 0 });
// Partial online payment on a cash booking: the rest is cash once completed.
const part = mr.bookingMoney(B({ id: "p", payment_mode: "cash_driver", total_price: 100, cash_fee: 10, amount_paid: 30 }));
eq("cash booking partly paid online: online 30, cash 80, nothing outstanding", [part.onlineCents, part.cashCents, part.outstandingCents], [3000, 8000, 0]);

// Periods.
eq("default period = Costa Rica month of today", mr.parseReportPeriod({}, "2026-11-12"), { from: "2026-11-01", to: "2026-11-30", month: "2026-11", prevFrom: "2026-10-01", prevTo: "2026-10-31" });
eq("?month=2026-03 compares with February", mr.parseReportPeriod({ month: "2026-03" }, TODAY), { from: "2026-03-01", to: "2026-03-31", month: "2026-03", prevFrom: "2026-02-01", prevTo: "2026-02-28" });
eq("January compares with last December", mr.parseReportPeriod({ month: "2027-01" }, TODAY).prevFrom, "2026-12-01");
eq("custom range: same length before", mr.parseReportPeriod({ from: "2026-11-10", to: "2026-11-16" }, TODAY), { from: "2026-11-10", to: "2026-11-16", month: null, prevFrom: "2026-11-03", prevTo: "2026-11-09" });
eq("range that is a whole month counts as that month", mr.parseReportPeriod({ from: "2026-02-01", to: "2026-02-28" }, TODAY).month, "2026-02");
eq("bad range → default month", mr.parseReportPeriod({ from: "2026-11-20", to: "2026-11-01" }, TODAY).month, "2026-11");
eq("impossible date → default month", mr.parseReportPeriod({ from: "2026-02-30", to: "2026-03-02" }, TODAY).month, "2026-11");
eq("bad month → default month", mr.parseReportPeriod({ month: "2026-13" }, TODAY).month, "2026-11");
eq("change %", [mr.changePct(150, 100), mr.changePct(50, 100), mr.changePct(5, 0)], [50, -50, null]);
eq("bars", [mr.barPct(50, 100), mr.barPct(0, 100), mr.barPct(1, 1000), mr.barPct(5, 0)], [50, 0, 2, 0]);

console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
