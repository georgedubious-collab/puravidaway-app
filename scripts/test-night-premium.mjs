/**
 * Cases for night pickups (src/lib/nightPremium.ts, quoteTransfer() in src/lib/pricing.ts,
 * priceItem() in src/lib/tripRequest.ts and the traveller app's copy of the window rule in
 * apps/client/src/prices.ts).
 *
 *   npm run test:night        (Node 22.15+; Node runs the TypeScript directly)
 *
 * The rule (Jorge, 2026-11-11): pickups at any hour; a ride whose pickup time (Costa Rica
 * time) is from 22:00 up to, but not including, 04:00 costs 20% more. The percentage and the
 * hours come from the database (pricing_settings); here they are passed in, and
 * `npm run test:db` runs the same prices with the values read from the database.
 * Order: base → vehicle (× area) → season → night → + pass-through costs. Only the ride is
 * marked up: not the stops, the ferry, the Drake Bay boat fee or entrances.
 */
import { registerHooks } from "node:module";

// The app's files import each other without ".ts"; add it for Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const night = await import("../src/lib/nightPremium.ts");
const pricing = await import("../src/lib/pricing.ts");
const { BUILT_IN_CATALOG, seasonForYmd } = await import("../src/lib/catalogModel.ts");
const { parseSpec, priceItem } = await import("../src/lib/tripRequest.ts");
const { splitPayout } = await import("../src/lib/payout.ts");
const dates = await import("../src/lib/dates.ts");
const app = await import("../apps/client/src/night.ts");

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  if (got === want) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};
const usd = (c) => `$${(c / 100).toFixed(2)}`;

const RULE = { bps: 2000, startHour: 22, endHour: 4 };
const catalog = { ...BUILT_IN_CATALOG, nightPremium: RULE };

// --- 1. The window: from the start hour up to, not including, the end hour.
for (const [time, isNight] of [
  ["21:30", false], ["21:45", false], ["22:00", true], ["22:15", true], ["23:30", true], ["23:45", true],
  ["00:00", true], ["01:00", true], ["03:30", true], ["03:45", true], ["04:00", false], ["04:15", false],
  ["09:00", false], ["12:00", false], ["18:00", false],
]) {
  check(`window ${time}`, night.isNightPickup(time, RULE), isNight);
  check(`bps ${time}`, night.nightBpsFor(time, RULE), isNight ? 2000 : 0);
  check(`app window ${time}`, app.isNightTime(time, { percent: 20, startHour: 22, endHour: 4, applies: false }), isNight);
}
check("no time is never night", night.isNightPickup(undefined, RULE), false);
check("null time is never night", night.isNightPickup(null, RULE), false);
check("malformed time is never night", night.isNightPickup("25:00", RULE), false);
check("0% switches it off", night.isNightPickup("23:00", { ...RULE, bps: 0 }), false);
check("same start and end hour switches it off", night.isNightPickup("23:00", { bps: 2000, startHour: 5, endHour: 5 }), false);
// A window that doesn't cross midnight, and other hours from the admin.
check("window 1→5 at 00:30", night.isNightPickup("00:30", { bps: 1500, startHour: 1, endHour: 5 }), false);
check("window 1→5 at 01:00", night.isNightPickup("01:00", { bps: 1500, startHour: 1, endHour: 5 }), true);
check("window 1→5 at 04:45", night.isNightPickup("04:45", { bps: 1500, startHour: 1, endHour: 5 }), true);
check("window 1→5 at 05:00", night.isNightPickup("05:00", { bps: 1500, startHour: 1, endHour: 5 }), false);
check("window 21→6 at 21:00", night.isNightPickup("21:00", { bps: 2500, startHour: 21, endHour: 6 }), true);
check("window 21→6 at 05:45", night.isNightPickup("05:45", { bps: 2500, startHour: 21, endHour: 6 }), true);

// --- 2. Words built from the values, never typed.
check("chip", night.nightChip(RULE), "Night pickup +20%");
check("chip es", night.nightChip(RULE, "es"), "Recogida nocturna +20%");
check("sentence", night.nightSentence(RULE), "Pickups are available at any hour. Rides that start between 10:00 PM and 4:00 AM cost 20% more.");
check("sentence es", night.nightSentence(RULE, "es"), "Hay recogidas a cualquier hora. Los traslados que empiezan entre las 10:00 p. m. y las 4:00 a. m. cuestan un 20% más.");
check("sentence, other values", night.nightSentence({ bps: 1250, startHour: 23, endHour: 5 }), "Pickups are available at any hour. Rides that start between 11:00 PM and 5:00 AM cost 12.5% more.");
check("sentence es, 1 a. m.", night.nightSentence({ bps: 1000, startHour: 1, endHour: 5 }, "es"), "Hay recogidas a cualquier hora. Los traslados que empiezan entre la 1:00 a. m. y las 5:00 a. m. cuestan un 10% más.");
check("sentence without a premium", night.nightSentence({ ...RULE, bps: 0 }), "Pickups are available at any hour.");
const said = night.nightSentence(RULE) + night.nightSentence(RULE, "es");
check("never '24/7'", /24\s*\/\s*7/.test(said), false);

// --- 3. Every half hour of the day can be booked (it was 04:00–22:00).
check("website offers 96 quarter hours", dates.PICKUP_TIMES.length, 96);
check("first time", dates.PICKUP_TIMES[0], "00:00");
check("last time", dates.PICKUP_TIMES[95], "23:45");
for (const t of ["00:00", "01:00", "03:30", "22:15", "23:45", "04:00", "09:00"]) check(`valid ${t}`, dates.isValidPickupTime(t), true);
for (const t of ["24:00", "9:00", "09:10", "", null, 900]) check(`invalid ${JSON.stringify(t)}`, dates.isValidPickupTime(t), false);
check("app offers 48 half hours", app.TIMES.length, 48);
check("app first time", app.TIMES[0], "00:00");
check("app last time", app.TIMES[47], "23:30");
check("app chip", app.nightLabel({ percent: 20, startHour: 22, endHour: 4, applies: true }, "en"), night.nightChip(RULE));
check("app chip es", app.nightLabel({ percent: 20, startHour: 22, endHour: 4, applies: true }, "es"), night.nightChip(RULE, "es"));
// A 01:00 pickup belongs to the day the traveller picked (Costa Rica is UTC−6 all year).
check("01:00 keeps its day", dates.scheduledParts(dates.costaRicaTimestamp("2027-06-15", "01:00"))?.ymd, "2027-06-15");
check("01:00 keeps its time", dates.scheduledParts(dates.costaRicaTimestamp("2027-06-15", "01:00"))?.time, "01:00");
check("23:30 keeps its day", dates.scheduledParts(dates.costaRicaTimestamp("2027-06-15", "23:30"))?.ymd, "2027-06-15");
check("01:00 is 07:00 UTC the same day", new Date(dates.costaRicaTimestamp("2027-06-15", "01:00")).toISOString(), "2027-06-15T07:00:00.000Z");
check("23:30 is 05:30 UTC the next day", new Date(dates.costaRicaTimestamp("2027-06-15", "23:30")).toISOString(), "2027-06-16T05:30:00.000Z");

// --- 4. Prices. SJO → Manuel Antonio, Standard Sedan.
const GREEN = "2027-06-15"; // green season, ×1.00
const HIGH = "2027-02-10"; // high season, ×1.15
const ride = (time) => ({ kind: "transfer", origin: "SJO", destination: "ManuelAntonio", vehicleId: "sedan", stopIds: [], pax: 2, ...(time ? { pickupTime: time } : {}), pricing: "fixed" });
const price = (raw, date = GREEN, cat = catalog) => priceItem(parseSpec(raw), date, cat);

const day = price(ride("09:00"));
const lines = [];
for (const [time, isNight] of [["21:30", false], ["22:00", true], ["23:30", true], ["03:30", true], ["04:00", false]]) {
  const p = price(ride(time));
  check(`total at ${time}`, p.totalCents, isNight ? Math.round(day.totalCents * 1.2) : day.totalCents);
  check(`premium at ${time}`, p.nightCents, isNight ? Math.round(day.totalCents * 0.2) : 0);
  lines.push(`${time} ${usd(p.totalCents)}${isNight ? ` (night +${usd(p.nightCents)})` : ""}`);
}
// An app build from before night pickups sends no time: the daytime price, as before.
const old = price(ride(null));
check("old-style request without a time: no premium", old.totalCents, day.totalCents);
check("old-style request without a time: premium 0", old.nightCents, 0);

// Order of operations with a season: base → vehicle → season → night.
const dayHigh = price(ride("09:00"), HIGH);
const nightHigh = price(ride("23:30"), HIGH);
check("high season by day = green × 1.15", dayHigh.totalCents, Math.round(day.totalCents * 1.15));
check("high season at night = green × 1.15 × 1.20", nightHigh.totalCents, Math.round(Math.round(day.totalCents * 1.15) * 1.2));

// Driver payout: 20% commission after pass-throughs, so it rises with the premium.
const payDay = splitPayout(day.totalCents, day.passThroughCents, catalog, day.companyCostCents);
const night2330 = price(ride("23:30"));
const payNight = splitPayout(night2330.totalCents, night2330.passThroughCents, catalog, night2330.companyCostCents);
check("payout by day = 80% of the price", payDay.payoutCents, Math.round(day.totalCents * 0.8));
check("payout at night = 80% of the night price", payNight.payoutCents, Math.round(night2330.totalCents * 0.8));
check("payout rises by 80% of the premium", payNight.payoutCents - payDay.payoutCents, Math.round(night2330.nightCents * 0.8));
check("payout rises", payNight.payoutCents > payDay.payoutCents, true);

// Stops are not marked up (the premium is on the ride only).
const withStop = (time) => price({ ...ride(time), stopIds: ["tarcoles", "carara"] });
const stopDay = withStop("09:00");
const stopNight = withStop("23:30");
check("stops: the night adds exactly the ride's premium", stopNight.totalCents - stopDay.totalCents, night2330.nightCents);
check("stops: guided-visit costs unchanged", stopNight.companyCostCents, stopDay.companyCostCents);

// Ferries (a pass-through cost) are not marked up.
const ferryRoute = { km: 180, drivingMinutes: 240, totalMinutes: 330, ferries: 1 };
const quote = (time, extra = {}) =>
  pricing.quoteTransfer({ origin: "SJO", destination: "Tamarindo", vehicleId: "sedan", stopIds: [], pax: 2, season: seasonForYmd(GREEN, catalog), catalog, pickupTime: time, ...extra });
const ferryDay = quote("09:00", { route: ferryRoute });
const ferryNight = quote("23:30", { route: ferryRoute });
check("ferry fare is charged", ferryDay.ferryCents > 0, true);
check("ferry fare is the same at night", ferryNight.ferryCents, ferryDay.ferryCents);
check("ferry: the premium is 20% of the ride without the ferry", ferryNight.nightCents, Math.round((ferryDay.totalCents - ferryDay.ferryCents) * 0.2));
check("ferry: total = day + premium", ferryNight.totalCents, ferryDay.totalCents + ferryNight.nightCents);

// The Drake Bay river boat (the vehicle's extra fee) is not marked up.
const boat = catalog.vehicles.find((v) => v.id === "sierpe_combo");
const boatQuote = (time) =>
  pricing.quoteTransfer({ origin: "SJO", destination: "DrakeBay", vehicleId: "sierpe_combo", stopIds: [], pax: 2, season: seasonForYmd(GREEN, catalog), catalog, pickupTime: time });
const boatDay = boatQuote("09:00");
const boatNight = boatQuote("03:30");
check("boat fee exists", boat.extraFeeCents > 0, true);
check("boat: the premium is 20% of the ride without the boat fee", boatNight.nightCents, Math.round((boatDay.totalCents - boat.extraFeeCents) * 0.2));
check("boat: total = day + premium", boatNight.totalCents, boatDay.totalCents + boatNight.nightCents);

// Travellers book at the fixed price only (2026-11-11): a "name your price" ride is never parsed or priced.
check("an offer ride is not parsed", parseSpec({ ...ride("23:30"), pricing: "bid", offerCents: 15000 }), null);
check("a ride without a pricing field is the fixed price", price({ ...ride("23:30"), pricing: undefined }).totalCents, night2330.totalCents);

// Day tours are not affected (multi-day trips were retired on 2026-11-11).
const tour = priceItem({ kind: "day_tour", tourId: "dt1", upgrade: false, pax: 2 }, GREEN, catalog);
const tourNoNight = priceItem({ kind: "day_tour", tourId: "dt1", upgrade: false, pax: 2 }, GREEN, { ...catalog, nightPremium: { ...RULE, bps: 0 } });
check("day tour unchanged", tour.totalCents, tourNoNight.totalCents);
check("day tour has no premium", tour.nightCents, 0);
let refused = false;
try { priceItem({ kind: "expedition", expeditionId: "md1", tierId: "base" }, GREEN, catalog); } catch { refused = true; }
check("a multi-day item can no longer be priced", refused, true);

// The values come from the catalog (the database), not from the code.
const other = { ...catalog, nightPremium: { bps: 3000, startHour: 21, endHour: 5 } };
check("other settings: 21:30 is now night at +30%", price(ride("21:30"), GREEN, other).totalCents, Math.round(day.totalCents * 1.3));
check("other settings: 04:00 is now night", price(ride("04:00"), GREEN, other).nightCents, Math.round(day.totalCents * 0.3));
check("premium switched off: 23:30 costs the day price", price(ride("23:30"), GREEN, { ...catalog, nightPremium: { ...RULE, bps: 0 } }).totalCents, day.totalCents);

console.log(`SJO → Manuel Antonio, Standard Sedan, green season: ${lines.join(" · ")}`);
console.log(`Driver payout: ${usd(payDay.payoutCents)} by day → ${usd(payNight.payoutCents)} at 23:30 (+${usd(payNight.payoutCents - payDay.payoutCents)})`);
console.log(`High season: ${usd(dayHigh.totalCents)} by day → ${usd(nightHigh.totalCents)} at 23:30`);
console.log(`Ferry route: ${usd(ferryDay.totalCents)} → ${usd(ferryNight.totalCents)} (ferry ${usd(ferryDay.ferryCents)} both); Drake Bay boat: ${usd(boatDay.totalCents)} → ${usd(boatNight.totalCents)} (boat ${usd(boat.extraFeeCents)} both)`);
console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
