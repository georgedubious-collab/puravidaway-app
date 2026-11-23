/**
 * Card holds (Stripe, 2026-11-22; src/lib/cardHold.ts): when a held card is charged or released,
 * the Stripe metadata that lists the bookings, and what is still to pay online.
 *
 *   npm run test:card-holds        (Node 22.15+; Node runs the TypeScript directly)
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const h = await import("../src/lib/cardHold.ts");

let pass = 0;
let fail = 0;
function check(name, ok) {
  if (ok) pass++;
  else {
    fail++;
    console.log(`✗ ${name}`);
  }
}

const day = 24 * 3600 * 1000;
const heldAt = new Date("2026-12-01T12:00:00Z");
const line = (id, status, hasDriver, cents = 10000) => ({ paymentId: `p${id}`, bookingId: `b${id}`, amountCents: cents, bookingStatus: status, hasDriver });

// Waiting for drivers.
check("no driver yet, day 1 → wait", h.decideHold([line(1, "pending_bids", false)], heldAt, new Date(heldAt.getTime() + day)).action === "wait");
check("one of two rides without driver → wait", h.decideHold([line(1, "confirmed", true), line(2, "pending_bids", false)], heldAt, new Date(heldAt.getTime() + 2 * day)).action === "wait");
check("no lines → wait", h.decideHold([], heldAt, heldAt).action === "wait");

// Every ride has a driver → charge all of it.
{
  const d = h.decideHold([line(1, "confirmed", true, 12000), line(2, "confirmed", true, 8000)], heldAt, new Date(heldAt.getTime() + 3600_000));
  check("all drivers → charge", d.action === "charge" && d.why === "drivers");
  check("all drivers → full amount", d.action === "charge" && d.chargeCents === 20000 && d.charge.length === 2 && d.release.length === 0);
}

// Day 6: charge even without a driver.
{
  const d = h.decideHold([line(1, "pending_bids", false)], heldAt, new Date(heldAt.getTime() + 6 * day));
  check("day 6 without driver → charge (deadline)", d.action === "charge" && d.why === "deadline" && d.chargeCents === 10000);
  check("5 days 23 h → still wait", h.decideHold([line(1, "pending_bids", false)], heldAt, new Date(heldAt.getTime() + 6 * day - 3600_000)).action === "wait");
}

// Cancellations.
check("all cancelled → release", h.decideHold([line(1, "cancelled", false), line(2, "cancelled", true)], heldAt, heldAt).action === "release");
{
  const d = h.decideHold([line(1, "cancelled", false, 5000), line(2, "confirmed", true, 7000)], heldAt, heldAt);
  check("one cancelled, other has driver → charge only the other", d.action === "charge" && d.chargeCents === 7000 && d.charge[0] === "p2" && d.release[0] === "p1");
}
check("cancelled + other waiting → wait", h.decideHold([line(1, "cancelled", false), line(2, "pending_bids", false)], heldAt, heldAt).action === "wait");

// Deadline helper.
check("deadline = held + 6 days", h.holdDeadline(heldAt).getTime() === heldAt.getTime() + 6 * day);

// Metadata round trip; junk ignored.
{
  const id1 = "11111111-1111-4111-8111-111111111111";
  const id2 = "22222222-2222-4222-8222-222222222222";
  const meta = { trip_id: "x", ...h.holdMetadata([{ bookingId: id1, cents: 12345 }, { bookingId: id2, cents: 1 }]) };
  const back = h.parseHoldMetadata(meta);
  check("metadata round trip", back.length === 2 && back[0].bookingId === id1 && back[0].cents === 12345 && back[1].cents === 1);
  check("metadata junk ignored", h.parseHoldMetadata({ b0: "not-a-uuid:100", b1: `${id1}:-5`, b2: `${id1}:1.5`, other: `${id1}:100` }).length === 0);
  check("metadata empty", h.parseHoldMetadata(null).length === 0);
}

// What is still to pay online.
check("online due = price − paid − held", h.onlineDueCents({ status: "pending_payment", payment_mode: "full_100", total_price: "273.70", amount_paid: "0", amount_held: "100" }) === 17370);
check("fully held → 0", h.onlineDueCents({ status: "pending_payment", payment_mode: "full_100", total_price: 100, amount_paid: 0, amount_held: 100 }) === 0);
check("cash booking → 0", h.onlineDueCents({ status: "pending_payment", payment_mode: "cash_driver", total_price: 100 }) === 0);
check("cancelled → 0", h.onlineDueCents({ status: "cancelled", payment_mode: "full_100", total_price: 100 }) === 0);
check("completed → 0", h.onlineDueCents({ status: "completed", payment_mode: "full_100", total_price: 100 }) === 0);
check("overpaid → 0", h.onlineDueCents({ status: "confirmed", payment_mode: "full_100", total_price: 100, amount_paid: 120 }) === 0);
check("old deposit booking counts as online", h.onlineDueCents({ status: "confirmed", payment_mode: "deposit_20", total_price: 50, amount_paid: 10 }) === 4000);

if (fail) {
  console.log(`${fail} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`${pass} card-hold checks passed`);
