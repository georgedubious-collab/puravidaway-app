/**
 * Cases for pinned (fixed) route prices (src/lib/pinnedPrices.ts, rideDriveCents() in
 * src/lib/pricing.ts; table pinned_route_prices, migration 0058; docs/PRICING.md §4.5).
 *
 *   npm run test:pinned        (Node 22.15+; Node runs the TypeScript directly)
 *
 * The rule (Jorge, 2026-11-12): a pinned price replaces the formula's ride price for one town
 * pair and vehicle class. Everything after it is unchanged: season multiplier, night premium,
 * stops, ferries / the Drake Bay boat fee, cash fee, promo codes, the 20% commission and the
 * driver's payout. `npm run test:db` runs the same prices with the pins read from the database.
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";

// The app's files import each other without ".ts"; add it for Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const warn = console.warn;
console.warn = () => {};
const pins = await import("../src/lib/pinnedPrices.ts");
const pricing = await import("../src/lib/pricing.ts");
const { BUILT_IN_CATALOG, seasonForYmd } = await import("../src/lib/catalogModel.ts");
const { HUB_IDS, HUBS } = await import("../src/lib/catalog.ts");
const { parseSpec, priceItem } = await import("../src/lib/tripRequest.ts");
const { splitPayout } = await import("../src/lib/payout.ts");
const promo = await import("../src/lib/promo.ts");
const { pageFromPrices, pageVehiclePrices, routeFromPrices } = await import("../src/lib/routePrices.ts");
const places = await import("../src/lib/places.ts");
const { localizeCatalog } = await import("../src/lib/catalogEs.ts");
console.warn = warn;

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};
const usd = (c) => `$${(c / 100).toFixed(2)}`;

const GREEN = "2027-06-15";
const HIGH = "2027-01-20";
const PEAK = "2026-12-27";
const catalog = BUILT_IN_CATALOG; // carries the seeded SJO ↔ Puerto Jiménez pins
const formulaOnly = { ...catalog, pinnedPrices: [] };
const ride = (origin, destination, vehicleId = "sedan", extra = {}) => ({ kind: "transfer", origin, destination, vehicleId, stopIds: [], pax: 2, pickupTime: "09:00", ...extra });
const price = (spec, date = GREEN, cat = catalog, route) => priceItem(parseSpec(spec), date, cat, route);

// --- 1. The seeded route: SJO ↔ Puerto Jiménez, the same both ways --------------------------
const SEED = { economy: 48900, sedan: 49900, suv: 54900, "4x4": 58500, van: 60500 };
const DAYTRIP = { economy: 51800, sedan: 53000, suv: 58200, van: 63900 }; // Sedan Lite, Sedan, Compact MPV, Van
const FORMULA_TO = { economy: 38100, sedan: 42300, suv: 50800, "4x4": 55000, van: 57100 };
const FORMULA_FROM = { economy: 43800, sedan: 48600, suv: 58400, "4x4": 63200, van: 65700 };
for (const [id, cents] of Object.entries(SEED)) {
  check(`SJO → Puerto Jiménez, ${id}: the pinned price`, price(ride("SJO", "PuertoJimenez", id)).totalCents, cents);
  check(`Puerto Jiménez → SJO, ${id}: the same (no area factor on top)`, price(ride("PuertoJimenez", "SJO", id)).totalCents, cents);
  check(`…without the pin the formula is back, ${id} (to)`, price(ride("SJO", "PuertoJimenez", id), GREEN, formulaOnly).totalCents, FORMULA_TO[id]);
  check(`…without the pin the formula is back, ${id} (from)`, price(ride("PuertoJimenez", "SJO", id), GREEN, formulaOnly).totalCents, FORMULA_FROM[id]);
}
for (const [id, daytrip] of Object.entries(DAYTRIP)) {
  const under = 1 - SEED[id] / daytrip;
  check(`${id}: 4–6% under Daytrip's matching class`, under >= 0.04 && under <= 0.06, true);
}
check("classes keep their order: Economy < Standard < Minivan < 4x4 < Van", Object.values(SEED).every((c, i, a) => i === 0 || c > a[i - 1]), true);
// The 4x4 sits between the Minivan and the Van as its factor does (1.20 / 1.30 / 1.35 → two thirds of the way).
check("4x4 keeps its place between Minivan and Van", Math.abs((SEED["4x4"] - SEED.suv) / (SEED.van - SEED.suv) - (1.3 - 1.2) / (1.35 - 1.2)) < 0.05, true);

// --- 2. Other routes are untouched -------------------------------------------------------------
let same = 0;
let pairs = 0;
for (const a of HUB_IDS) {
  for (const b of HUB_IDS) {
    if (a === b || (a === "SJO" && b === "PuertoJimenez") || (a === "PuertoJimenez" && b === "SJO")) continue;
    for (const v of catalog.vehicles) {
      pairs++;
      if (pricing.rideCents(a, b, v, catalog) === pricing.rideCents(a, b, v, formulaOnly)) same++;
    }
  }
}
check("every other town pair and class costs what the formula says", same, pairs);
check("…e.g. SJO → Manuel Antonio, Standard", price(ride("SJO", "ManuelAntonio")).totalCents, 20200);
check("…e.g. Manuel Antonio → Puerto Jiménez, Standard", price(ride("ManuelAntonio", "PuertoJimenez")).totalCents, 26900);
check("…e.g. Sierpe → Puerto Jiménez, Standard", price(ride("Sierpe", "PuertoJimenez")).totalCents, 19700);

// --- 3. Season and night still apply on top -------------------------------------------------
const high = seasonForYmd(HIGH, catalog);
const peak = seasonForYmd(PEAK, catalog);
check("high season is +15%, peak +25% (built-in)", [high.multiplierBps, peak.multiplierBps], [11500, 12500]);
check("high season: pinned × 1.15", price(ride("SJO", "PuertoJimenez"), HIGH).totalCents, Math.round(49900 * 1.15));
check("peak season: pinned × 1.25", price(ride("SJO", "PuertoJimenez"), PEAK).totalCents, Math.round(49900 * 1.25));
check("a season multiplier changed in the database is followed",
  price(ride("SJO", "PuertoJimenez"), HIGH, { ...catalog, seasons: catalog.seasons.map((s) => (s.id === "high" ? { ...s, multiplierBps: 12000 } : s)) }).totalCents, 59880);
const night = price(ride("SJO", "PuertoJimenez", "sedan", { pickupTime: "23:30" }));
check("night pickup: +20% of the pinned price", [night.totalCents, night.nightCents], [59880, 9980]);
const nightHigh = price(ride("PuertoJimenez", "SJO", "van", { pickupTime: "03:30" }), HIGH);
check("night + high season, van, the other direction", [nightHigh.totalCents, nightHigh.nightCents], [Math.round(60500 * 1.15 * 1.2), Math.round(60500 * 1.15 * 0.2)]);
check("04:00 is day again", price(ride("SJO", "PuertoJimenez", "sedan", { pickupTime: "04:00" })).nightCents, 0);

// --- 4. Driver payout: 80% of the shared part ---------------------------------------------------
const day = price(ride("SJO", "PuertoJimenez"));
const pay = splitPayout(day.totalCents, day.passThroughCents, catalog, day.companyCostCents);
check("payout = 80% of the pinned price", [pay.payoutCents, pay.feeCents], [39920, 9980]);
const payNight = splitPayout(night.totalCents, night.passThroughCents, catalog, night.companyCostCents);
check("payout at night = 80% of the night price", payNight.payoutCents, Math.round(59880 * 0.8));

// --- 5. Stops, ferries and the boat fee are added to a pinned ride as to any other -----------
// (No stop is offered between SJO and Puerto Jiménez today, so pin a route that has one.)
const maPins = { ...catalog, pinnedPrices: [...catalog.pinnedPrices, { origin: "SJO", destination: "ManuelAntonio", vehicleId: "sedan", cents: 19900, bothWays: true }] };
const stopFormula = price(ride("SJO", "ManuelAntonio", "sedan", { stopIds: ["tarcoles", "carara"] }));
const stopPinned = price(ride("SJO", "ManuelAntonio", "sedan", { stopIds: ["tarcoles", "carara"] }), GREEN, maPins);
check("a pinned route with stops: only the ride part changes", stopPinned.totalCents - 19900, stopFormula.totalCents - 20200);
check("…the company-paid part of the stops is unchanged", stopPinned.companyCostCents, stopFormula.companyCostCents);
const stopPay = splitPayout(stopPinned.totalCents, stopPinned.passThroughCents, catalog, stopPinned.companyCostCents);
check("…payout = 80% of (price − company-paid costs)", stopPay.payoutCents, Math.round((stopPinned.totalCents - stopPinned.companyCostCents) * 0.8));
const stopNight = price(ride("SJO", "ManuelAntonio", "sedan", { stopIds: ["tarcoles", "carara"], pickupTime: "23:00" }), GREEN, maPins);
check("…the night premium is 20% of the pinned ride, not of the stops", stopNight.nightCents, Math.round(19900 * 0.2));
check("a class with no pin on that route keeps the formula", price(ride("SJO", "ManuelAntonio", "van"), GREEN, maPins).totalCents, price(ride("SJO", "ManuelAntonio", "van"), GREEN, formulaOnly).totalCents);

// The 4x4 + Sierpe boat combo follows the 4x4's pin and stays exactly its boat fee above it.
const combo = catalog.vehicles.find((v) => v.id === "sierpe_combo");
const drakePins = { ...catalog, pinnedPrices: [{ origin: "SJO", destination: "DrakeBay", vehicleId: "4x4", cents: 40000, bothWays: true }] };
check("combo = pinned 4x4 + the boat fee", price(ride("SJO", "DrakeBay", "sierpe_combo"), GREEN, drakePins).totalCents, 40000 + combo.extraFeeCents);
check("…and the 4x4 itself is the pin", price(ride("SJO", "DrakeBay", "4x4"), GREEN, drakePins).totalCents, 40000);
const comboNight = price(ride("SJO", "DrakeBay", "sierpe_combo", { pickupTime: "23:00" }), GREEN, drakePins);
check("…the boat fee is not marked up at night", comboNight.nightCents, 8000);
check("…without a pin the combo is still the formula 4x4 + boat",
  price(ride("SJO", "DrakeBay", "sierpe_combo"), GREEN, formulaOnly).totalCents - price(ride("SJO", "DrakeBay", "4x4"), GREEN, formulaOnly).totalCents, combo.extraFeeCents);
check("on SJO ↔ Puerto Jiménez the combo (if it were offered) is the 4x4 pin + the boat", pricing.rideCents("SJO", "PuertoJimenez", combo, catalog), 58500 + combo.extraFeeCents);

// A ferry on a pinned route is added after the season and passed through to the driver in full.
const ferryPins = { ...catalog, pinnedPrices: [{ origin: "SJO", destination: "Tamarindo", vehicleId: "sedan", cents: 30000, bothWays: true }] };
const ferryRoute = { km: 280, drivingMinutes: 300, totalMinutes: 390, ferries: 1, zones: true };
const ferrySpec = ride("SJO", "Tamarindo", "sedan", { destinationPlace: { id: "ChIJ_test_place_0001", label: "Hotel Test" } });
const ferry = price(ferrySpec, HIGH, ferryPins, ferryRoute);
check("ferry: pinned × season + the ferry fare", ferry.totalCents, Math.round(30000 * 1.15) + ferry.passThroughCents);
check("ferry fare is charged", ferry.passThroughCents > 0, true);
const ferryPay = splitPayout(ferry.totalCents, ferry.passThroughCents, catalog, 0);
check("ferry: payout = 80% of the shared part + the whole ferry", ferryPay.payoutCents, Math.round(30000 * 1.15 * 0.8) + ferry.passThroughCents);

// --- 6. Cash fee and promo codes work from the pinned total ----------------------------------
check("cash booking fee: 10% of the pinned price", pricing.cashFeeCents(day.totalCents, catalog.cashFeeBps), 4990);
const item = (p) => ({ kind: "transfer", totalCents: p.totalCents, passThroughCents: p.passThroughCents, companyCostCents: p.companyCostCents, boatCents: p.boatCents });
const ten = promo.applyPromo({ discount_type: "percent", value: 10, applies_to: "both" }, [item(day)], catalog).lines[0];
check("promo 10%: $49.90 off, split 50/50", [ten.discountCents, ten.driverCents, ten.platformCents], [4990, 2495, 2495]);
const tenMoney = promo.discountedMoney(day.totalCents, pay, ten);
check("…traveller pays, driver gets, we keep", [tenMoney.totalCents, tenMoney.payoutCents, tenMoney.feeCents], [44910, 37425, 7485]);
check("the cap: at most twice our commission (40% of the shared part)", promo.maxDiscountCents(item(day), catalog), 19960);
const big = promo.applyPromo({ discount_type: "percent", value: 60, applies_to: "both" }, [item(day)], catalog).lines[0];
check("promo 60% is capped at 40% of the pinned price", [big.discountCents, big.platformCents], [19960, 9980]);
check("…our half is never more than our commission", big.platformCents <= pay.feeCents, true);
const fixed = promo.applyPromo({ discount_type: "fixed", value: 300, applies_to: "rides" }, [item(day)], catalog).lines[0];
check("fixed $300 code on a $499 ride is capped too", fixed.discountCents, 19960);
const ferryCap = promo.maxDiscountCents(item(ferry), catalog);
check("the ferry is never discounted on a pinned ride", ferryCap, Math.round(Math.round(30000 * 1.15) * 0.4));

// --- 7. Direction: both ways by default, one way when asked ----------------------------------
const P = (origin, destination, cents, bothWays = true, vehicleId = "sedan") => ({ origin, destination, vehicleId, cents, bothWays });
check("both ways: forward", pins.pinnedCents([P("SJO", "Arenal", 15000)], "SJO", "Arenal", "sedan"), 15000);
check("both ways: back", pins.pinnedCents([P("SJO", "Arenal", 15000)], "Arenal", "SJO", "sedan"), 15000);
check("one way: forward", pins.pinnedCents([P("SJO", "Arenal", 15000, false)], "SJO", "Arenal", "sedan"), 15000);
check("one way: back uses the formula", pins.pinnedCents([P("SJO", "Arenal", 15000, false)], "Arenal", "SJO", "sedan"), null);
check("each direction its own price", [
  pins.pinnedCents([P("SJO", "Arenal", 15000, false), P("Arenal", "SJO", 17000, false)], "SJO", "Arenal", "sedan"),
  pins.pinnedCents([P("SJO", "Arenal", 15000, false), P("Arenal", "SJO", 17000, false)], "Arenal", "SJO", "sedan"),
], [15000, 17000]);
check("the ride's own direction wins over a both-ways pin written the other way",
  pins.pinnedCents([P("SJO", "Arenal", 15000), P("Arenal", "SJO", 17000, false)], "Arenal", "SJO", "sedan"), 17000);
check("another class is not pinned", pins.pinnedCents([P("SJO", "Arenal", 15000)], "SJO", "Arenal", "van"), null);
check("another town pair is not pinned", pins.pinnedCents([P("SJO", "Arenal", 15000)], "SJO", "Monteverde", "sedan"), null);
check("no pins at all", [pins.pinnedCents([], "SJO", "Arenal", "sedan"), pins.pinnedCents(undefined, "SJO", "Arenal", "sedan")], [null, null]);
check("a vehicle without an id always gets the formula (the admin's formula column)",
  pricing.rideCents("SJO", "PuertoJimenez", { priceFactorBps: 10000, extraFeeCents: 0 }, catalog), 42300);
check("a catalog cached before this feature (no pinnedPrices) prices by the formula",
  pricing.rideCents("SJO", "PuertoJimenez", catalog.vehicles.find((v) => v.id === "sedan"), { ...catalog, pinnedPrices: undefined }), 42300);
const oneWay = { ...catalog, pinnedPrices: catalog.pinnedPrices.map((p) => ({ ...p, bothWays: false })) };
check("one-way pin in the catalog: to Puerto Jiménez pinned, back by the formula",
  [price(ride("SJO", "PuertoJimenez"), GREEN, oneWay).totalCents, price(ride("PuertoJimenez", "SJO"), GREEN, oneWay).totalCents], [49900, 48600]);

// --- 8. Removing or changing a pin ---------------------------------------------------------------
const without = { ...catalog, pinnedPrices: catalog.pinnedPrices.filter((p) => p.vehicleId !== "sedan") };
check("removing one class's pin returns that class to the formula", price(ride("SJO", "PuertoJimenez"), GREEN, without).totalCents, 42300);
check("…the other classes stay pinned", price(ride("SJO", "PuertoJimenez", "van"), GREEN, without).totalCents, 60500);
const raised = { ...catalog, pinnedPrices: catalog.pinnedPrices.map((p) => (p.vehicleId === "sedan" ? { ...p, cents: 51500 } : p)) };
check("changing a pin changes the price", price(ride("SJO", "PuertoJimenez"), GREEN, raised).totalCents, 51500);
check("a formula change does not move a pinned route",
  price(ride("SJO", "PuertoJimenez"), GREEN, { ...catalog, rideFormula: { ...catalog.rideFormula, perKmCents: 150 } }).totalCents, 49900);
check("an area-factor change does not move a pinned route",
  price(ride("PuertoJimenez", "SJO"), GREEN, { ...catalog, areaFactorBps: { ...catalog.areaFactorBps, PuertoJimenez: 13000 } }).totalCents, 49900);

// --- 9. Typed hotels and addresses ---------------------------------------------------------------
const typedTo = (extra = {}) => ride("SJO", "PuertoJimenez", "sedan", { destinationPlace: { id: "ChIJ_test_place_0002", label: "A lodge" }, ...extra });
const inTown = { km: 372, drivingMinutes: 365, totalMinutes: 365, ferries: 0, zones: true };
const beyond = { km: 388, drivingMinutes: 400, totalMinutes: 400, ferries: 0 };
const nearer = { km: 330, drivingMinutes: 320, totalMinutes: 320, ferries: 0 };
const farBeyond = { km: 480, drivingMinutes: 520, totalMinutes: 520, ferries: 0 };
check("a hotel inside the town's zone costs the pinned price", price(typedTo(), GREEN, catalog, inTown).totalCents, 49900);
check("…the formula would have followed Google's km", price(typedTo(), GREEN, formulaOnly, inTown).totalCents, 42600);
check("a lodge beyond the town (longer road) is never cheaper than the town", price(typedTo(), GREEN, catalog, beyond).totalCents, 49900);
check("…its formula price alone would be lower", price(typedTo(), GREEN, formulaOnly, beyond).totalCents < 49900, true);
check("a place much further on pays the formula when that is more", price(typedTo(), GREEN, catalog, farBeyond).totalCents, price(typedTo(), GREEN, formulaOnly, farBeyond).totalCents);
check("…which is above the pinned price", price(typedTo(), GREEN, catalog, farBeyond).totalCents > 49900, true);
check("a place linked to the town but a shorter drive (Golfito) keeps the formula", price(typedTo(), GREEN, catalog, nearer).totalCents, price(typedTo(), GREEN, formulaOnly, nearer).totalCents);
check("night premium on a typed place in the zone is 20% of the pin", price(typedTo({ pickupTime: "23:00" }), GREEN, catalog, inTown).nightCents, 9980);
check("a typed place on another route is untouched",
  price(ride("SJO", "ManuelAntonio", "sedan", { destinationPlace: { id: "ChIJ_test_place_0003", label: "Hotel" } }), GREEN, catalog, { km: 162, drivingMinutes: 172, totalMinutes: 172, ferries: 0, zones: true }).totalCents,
  price(ride("SJO", "ManuelAntonio", "sedan", { destinationPlace: { id: "ChIJ_test_place_0003", label: "Hotel" } }), GREEN, formulaOnly, { km: 162, drivingMinutes: 172, totalMinutes: 172, ferries: 0 }).totalCents);

// Zones: straight-line km from the town's map point.
const at = (hub, lat, lng) => ({ id: "ChIJ_test_place_zone", label: "x", hub, lat, lng });
check("our towns themselves are always inside", pins.inHubZone(places.hubPlace("PuertoJimenez")), true);
check("a hotel in Puerto Jiménez town", pins.inHubZone(at("PuertoJimenez", 8.5372, -83.3005)), true);
check("Playa Platanares (5 km)", pins.inHubZone(at("PuertoJimenez", 8.5215, -83.2702)), true);
check("Matapalo (about 17 km) is outside", pins.inHubZone(at("PuertoJimenez", 8.3889, -83.2917)), false);
check("Golfito, across the gulf, is outside", pins.inHubZone(at("PuertoJimenez", 8.639, -83.166)), false);
check("San José city centre counts as SJO", pins.inHubZone(at("SJO", 9.9333, -84.0796)), true);
check("Alajuela counts as SJO", pins.inHubZone(at("SJO", 10.0163, -84.2116)), true);
check("Cartago is outside SJO's zone", pins.inHubZone(at("SJO", 9.8644, -83.9194)), false);
check("both ends inside → the route is flagged", pins.inPinZones(places.hubPlace("SJO"), at("PuertoJimenez", 8.5372, -83.3005)), true);
check("one end outside → not flagged", pins.inPinZones(at("SJO", 9.8644, -83.9194), places.hubPlace("PuertoJimenez")), false);
check("two places in the same town → not flagged", pins.inPinZones(at("SJO", 9.9333, -84.0796), at("SJO", 10.0163, -84.2116)), false);
const maps = readFileSync(new URL("../src/lib/googleMaps.ts", import.meta.url), "utf8");
check("the server sets the flag on every route it builds (rideRoute)", /\.\.\.\(inPinZones\(origin, destination\) \? \{ zones: true \} : \{\}\)/.test(maps), true);

// --- 10. Reading the database rows ------------------------------------------------------------------
const rows = [
  { origin_hub: "SJO", destination_hub: "PuertoJimenez", vehicle_class_id: "sedan", price: "499.00", both_ways: true },
  { origin_hub: "SJO", destination_hub: "Arenal", vehicle_class_id: "van", price: 219.5, both_ways: false },
  { origin_hub: "Narnia", destination_hub: "SJO", vehicle_class_id: "sedan", price: 100, both_ways: true },
  { origin_hub: "SJO", destination_hub: "SJO", vehicle_class_id: "sedan", price: 100, both_ways: true },
  { origin_hub: "SJO", destination_hub: "LIR", vehicle_class_id: "sedan", price: "abc", both_ways: true },
  { origin_hub: "SJO", destination_hub: "LIR", vehicle_class_id: "sedan", price: 0, both_ways: true },
];
check("rows → pins; unknown towns, same town and bad amounts are dropped", pins.readPinnedPrices(rows, HUB_IDS), [
  { origin: "SJO", destination: "PuertoJimenez", vehicleId: "sedan", cents: 49900, bothWays: true },
  { origin: "SJO", destination: "Arenal", vehicleId: "van", cents: 21950, bothWays: false },
]);
check("the built-in pins are the ones the migration seeds", (() => {
  const sql = readFileSync(new URL("../supabase/migrations/20261112000058_pinned_route_prices.sql", import.meta.url), "utf8");
  return pins.PINNED_PRICES_DEFAULT.every((p) => sql.includes(`('${p.vehicleId}', ${p.cents / 100})`)) && sql.includes("select 'SJO', 'PuertoJimenez', p.class_id, p.price, true");
})(), true);
check("every built-in pin names a real town and class", pins.PINNED_PRICES_DEFAULT.every((p) => HUBS.some((h) => h.id === p.origin) && HUBS.some((h) => h.id === p.destination) && catalog.vehicles.some((v) => v.id === p.vehicleId)), true);

// --- 11. Every screen uses the same function ----------------------------------------------------
// Route pages and "Popular routes" ("from $X"), in both directions and both languages.
for (const [a, b] of [["SJO", "PuertoJimenez"], ["PuertoJimenez", "SJO"]]) {
  for (const lang of ["en", "es"]) {
    const cat = localizeCatalog(catalog, lang);
    const from = pageFromPrices(a, b, cat);
    check(`route page ${a} → ${b} (${lang}): from $489 (Economy)`, [from.fromCents, from.cheapest.id], [48900, "economy"]);
    check(`route page ${a} → ${b} (${lang}): the class table`, pageVehiclePrices(a, b, cat).map((r) => [r.vehicle.id, r.cents]), Object.entries(SEED));
    check(`popular routes ${a} → ${b} (${lang})`, routeFromPrices(a, b, cat).fromCents, 48900);
    check(`route page ${a} → ${b} (${lang}): per person from the van shared by 7`, from.perPersonCents, Math.ceil(60500 / 700) * 100);
  }
}
check("route page of another route is unchanged", pageFromPrices("SJO", "ManuelAntonio", catalog).fromCents, pageFromPrices("SJO", "ManuelAntonio", formulaOnly).fromCents);
// The app's quote API, the website's request, the team's manual booking and the booking edit all
// price through quoteTransfer() / priceItem() with the live catalog (checked in their source).
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
check("app quote API → quoteTransfer with the live catalog", /await getCatalog\(\)/.test(src("lib/appQuote.ts")) && /quoteTransfer\(\{/.test(src("lib/appQuote.ts")), true);
check("website request → priceItem with the live catalog", /await getCatalog\(\)/.test(src("app/trip/actions.ts")) && /priceItem\(spec, item\.date, catalog, ride\?\.route\)/.test(src("app/trip/actions.ts")), true);
check("manual booking → priceItem with the live catalog", /await getCatalog\(\)/.test(src("app/admin/bookings/new/actions.ts")) && /priceItem\(s, date, catalog, route\)/.test(src("app/admin/bookings/new/actions.ts")), true);
check("booking edit → priceItem with the live catalog", /priceItem\(spec, input\.date, catalog, route\)/.test(src("lib/bookingEditServer.ts")), true);
check("priceItem → quoteTransfer → rideDriveCents → the pin", /quoteTransfer\(\{ \.\.\.spec, season, catalog/.test(src("lib/tripRequest.ts")) && /withPinnedPrice\(formulaCents, catalog\?\.pinnedPrices/.test(src("lib/pricing.ts")), true);
check("the live catalog reads the pins (so the price cache carries them)", /from\("pinned_route_prices"\)/.test(src("lib/catalogSource.ts")) && /pinnedPrices,/.test(src("lib/catalogSource.ts")), true);
const quote = pricing.quoteTransfer({ origin: "SJO", destination: "PuertoJimenez", vehicleId: "sedan", stopIds: [], pax: 2, season: seasonForYmd(GREEN, catalog), catalog, pickupTime: "09:00" });
check("quoteTransfer: base, total and drive time", [quote.baseCents, quote.totalCents, quote.driveMinutes], [49900, 49900, 360]);

console.log(`SJO ↔ Puerto Jiménez (green season): ${Object.entries(SEED).map(([id, c]) => `${id} ${usd(c)}`).join(" · ")}`);
console.log(`Standard: high season ${usd(price(ride("SJO", "PuertoJimenez"), HIGH).totalCents)} · night ${usd(night.totalCents)} · payout ${usd(pay.payoutCents)} · promo 10% → ${usd(tenMoney.totalCents)}`);
console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
