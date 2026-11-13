/**
 * Cases for "add your own stop" on a ride (Jorge, 2026-11-12): src/lib/customStops.ts,
 * quoteTransfer() in src/lib/pricing.ts, parseSpec() / priceItem() in src/lib/tripRequest.ts,
 * the payout split, promo codes, the cash fee, what is saved on the booking and what drivers see.
 *
 *   npm run test:stops        (Node 22.15+; Node runs the TypeScript directly)
 *
 * The rule: an own stop costs what the driver's part of a catalog stop costs,
 *   waiting time × the hourly wait rate (from the database; $20 today)
 *   + extra road km × the ride formula's per-km rate + extra driving minutes × its per-hour rate,
 *   rounded to whole dollars, then the season. Not the vehicle factor, not the night premium.
 * "Extra" = Google's road route through the stops (the traveller's order) minus the direct
 * route; stop n's extra is what it adds on top of the stops before it. The server measures it:
 * nothing the browser or the app sends about detours or prices is used.
 * `npm run test:db` checks the database side (limits, the driver's functions, arrival time).
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const cs = await import("../src/lib/customStops.ts");
const pricing = await import("../src/lib/pricing.ts");
const { BUILT_IN_CATALOG, seasonForYmd } = await import("../src/lib/catalogModel.ts");
const { parseSpec, priceItem } = await import("../src/lib/tripRequest.ts");
const { splitPayout } = await import("../src/lib/payout.ts");
const promo = await import("../src/lib/promo.ts");
const dispatch = await import("../src/lib/dispatch.ts");
const matching = await import("../src/lib/matching.ts");
const be = await import("../src/lib/bookingEdit.ts");
const { localizeServerMessage } = await import("../src/lib/serverMessagesEs.ts");
const { mapsDirectionsUrl } = await import("../src/lib/places.ts");
const { hasContactDetails } = await import("../src/lib/preferences.ts");

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};
const refused = (fn) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e.message;
  }
};
const usd = (c) => `$${(c / 100).toFixed(2)}`;

const catalog = BUILT_IN_CATALOG; // wait $20/h, ride formula $0.90/km + $10/h, commission 20%, limits 3 / 240 / 90
const GREEN = "2027-06-15";
const HIGH = "2027-02-10";
const green = seasonForYmd(GREEN, catalog);
const high = seasonForYmd(HIGH, catalog);

// Jorge's example. The detours are road estimates for the tests (the live site asks Google):
// the waterfall is ~5.5 km up a dead-end road from La Fortuna; Proyecto Asis is off the San Ramón road.
const WATERFALL = { id: "ChIJwaterfallAAAAAA", label: "La Fortuna Waterfall", lat: 10.4433, lng: -84.6712, minutes: 90, detourKm: 11, detourMin: 24 };
const ASIS = { id: "ChIJasisAAAAAAAAAA", label: "Proyecto Asis", lat: 10.4, lng: -84.5, minutes: 120, detourKm: 24, detourMin: 38 };
const spec = (own, more = {}) => ({
  kind: "transfer",
  origin: "Arenal",
  destination: "ManuelAntonio",
  vehicleId: "sedan",
  stopIds: [],
  ...(own.length ? { customStops: own.map(({ id, label, minutes }) => ({ id, label, minutes })) } : {}),
  pax: 2,
  pickupTime: "08:00",
  ...more,
});

// --- 1. The price of one stop: wait × rate + km × per-km + minutes × per-hour, whole dollars.
check("1 h 30 at $20/h + 11 km × $0.90 + 24 min × $10/h = $43.90 → $44", cs.customStopCents(WATERFALL, catalog), 4400);
check("2 h + 24 km + 38 min = $67.93 → $68", cs.customStopCents(ASIS, catalog), 6800);
check("a stop on the way costs the waiting time only", cs.customStopCents({ minutes: 60, detourKm: 0, detourMin: 0 }, catalog), 2000);
check("30 min on the way: $10", cs.customStopCents({ minutes: 30, detourKm: 0, detourMin: 0 }, catalog), 1000);
{
  const parts = cs.customStopParts(WATERFALL, catalog);
  check("the parts: waiting $30.00, km $9.90, driving $4.00", [parts.waitCents, Math.round(parts.kmCents), parts.driveCents], [3000, 990, 400]);
}
// The rates come from the catalog (the database), never from the code.
check("wait rate $25/h from the settings: 1 h on the way = $25", cs.customStopCents({ minutes: 60, detourKm: 0, detourMin: 0 }, { ...catalog, waitPerHourCents: 2500 }), 2500);
check(
  "per-km $1.00 and per-hour $12 from the settings",
  cs.customStopCents(WATERFALL, { waitPerHourCents: 2000, rideFormula: { ...catalog.rideFormula, perKmCents: 100, perHourCents: 1200 } }),
  Math.round((3000 + 1100 + 480) / 100) * 100,
);
{
  // Exactly the catalog-stop rule: the same inputs give the same price as stopPriceCents().
  const { stopPriceCents } = await import("../src/lib/catalog.ts");
  check("same sum as a catalog stop's driver part", cs.customStopCents(ASIS, catalog), stopPriceCents({ durationMin: 120, detourKm: 24, detourMin: 38 }, catalog.rideFormula, catalog.waitPerHourCents));
}

// --- 2. Detours from the routes: each stop adds what it adds on top of the stops before it.
{
  const direct = { km: 235, drivingMinutes: 290, ferries: 0 };
  const viaOne = { km: 246, drivingMinutes: 314, ferries: 0 };
  const viaTwo = { km: 270, drivingMinutes: 352, ferries: 0 };
  check("stop 1 = route via 1 − direct; stop 2 = route via 1+2 − route via 1", cs.detoursFromRoads(direct, [viaOne, viaTwo]), [
    { detourKm: 11, detourMin: 24 },
    { detourKm: 24, detourMin: 38 },
  ]);
  check("a stop on the road adds nothing, never a negative detour", cs.detoursFromRoads(direct, [{ km: 234.6, drivingMinutes: 289, ferries: 0 }]), [{ detourKm: 0, detourMin: 0 }]);
  check("km keep one decimal", cs.detoursFromRoads(direct, [{ km: 238.26, drivingMinutes: 296, ferries: 0 }])[0].detourKm, 3.3);
  check("a stop that adds a ferry crossing isn't priced online", cs.detoursFromRoads(direct, [{ km: 300, drivingMinutes: 400, ferries: 1 }]), null);
  check("no stops, no detours", cs.detoursFromRoads(direct, []), []);
}

// --- 3. In the ride's price: with the stops, before the season; not the vehicle, not the night.
const q = (more) => pricing.quoteTransfer({ origin: "Arenal", destination: "ManuelAntonio", vehicleId: "sedan", stopIds: [], season: green, catalog, pax: 2, ...more });
const plain = q({});
const withOwn = q({ customStops: [WATERFALL, ASIS] });
check("the two stops add $44 + $68 = $112 in green season", withOwn.totalCents - plain.totalCents, 11200);
check("…reported as customStopsCents, inside stopsCents", [withOwn.customStopsCents, withOwn.stopsCents], [11200, 11200]);
check("no own stops: nothing changes", [plain.customStopsCents, q({ customStops: [] }).totalCents, q({ customStops: null }).totalCents], [0, plain.totalCents, plain.totalCents]);
check("the drive time includes the extra driving (24 + 38 min)", withOwn.driveMinutes - plain.driveMinutes, 62);
check("the stop time is the time there (90 + 120 min)", withOwn.stopsMinutes, 210);
check("door to door = drive + stops", withOwn.totalMinutes, plain.totalMinutes + 62 + 210);
{
  const hi = pricing.quoteTransfer({ origin: "Arenal", destination: "ManuelAntonio", vehicleId: "sedan", stopIds: [], season: high, catalog, pax: 2 });
  const hiOwn = pricing.quoteTransfer({ origin: "Arenal", destination: "ManuelAntonio", vehicleId: "sedan", stopIds: [], season: high, catalog, pax: 2, customStops: [WATERFALL, ASIS] });
  check("high season marks the stops up like catalog stops (×1.15)", hiOwn.totalCents - hi.totalCents, Math.round(11200 * (high.multiplierBps / 10000)));
  const van = q({ vehicleId: "van", pax: 6 });
  const vanOwn = q({ vehicleId: "van", pax: 6, customStops: [WATERFALL, ASIS] });
  check("a van pays the same for the stops as a sedan (no vehicle factor on stops)", vanOwn.totalCents - van.totalCents, 11200);
  check("travellers don't change it either (no per-person part)", q({ pax: 4, vehicleId: "suv", customStops: [WATERFALL] }).totalCents - q({ pax: 4, vehicleId: "suv" }).totalCents, 4400);
  const night = q({ pickupTime: "23:00" });
  const nightOwn = q({ pickupTime: "23:00", customStops: [WATERFALL, ASIS] });
  check("a night pickup doesn't mark the stops up", [nightOwn.nightCents, nightOwn.totalCents - night.totalCents], [night.nightCents, 11200]);
  const cat = catalog.stops.find((s) => s.corridors.includes("Arenal")) ?? catalog.stops[0];
  const both = q({ stopIds: [cat.id], customStops: [WATERFALL] });
  check("catalog stops and own stops add up", both.stopsCents, q({ stopIds: [cat.id] }).stopsCents + 4400);
}

// --- 4. The request: only the place id, the name and the minutes are read.
{
  const parsed = parseSpec({
    ...spec([WATERFALL, ASIS]),
    customStops: [
      { id: WATERFALL.id, label: "  La Fortuna   Waterfall ", minutes: 90, price: 1, cents: 1, detourKm: 0, detourMin: 0, lat: 0, lng: 0 },
      { id: ASIS.id, label: "Proyecto Asis", minutes: 120 },
    ],
  });
  check("parsed, tidied, extra fields dropped", parsed.customStops, [
    { id: WATERFALL.id, label: "La Fortuna Waterfall", minutes: 90 },
    { id: ASIS.id, label: "Proyecto Asis", minutes: 120 },
  ]);
  check("a ride without own stops has no customStops field", "customStops" in parseSpec(spec([])), false);
  check("older pages and apps (no field) still parse", parseSpec({ ...spec([]), customStops: undefined }) !== null, true);
  for (const [name, bad] of [
    ["minutes not offered (45)", [{ id: WATERFALL.id, label: "X", minutes: 45 }]],
    ["minutes as text", [{ id: WATERFALL.id, label: "X", minutes: "90" }]],
    ["a negative time", [{ id: WATERFALL.id, label: "X", minutes: -60 }]],
    ["one of our towns as a stop", [{ id: "hub:SJO", label: "SJO", minutes: 60 }]],
    ["no name", [{ id: WATERFALL.id, label: "  ", minutes: 60 }]],
    ["not a list", { id: WATERFALL.id }],
    ["more than 10 entries", Array.from({ length: 11 }, (_, i) => ({ id: `ChIJplace${i}AAAAAAAA`, label: "X", minutes: 30 }))],
  ]) {
    check(`refused: ${name}`, parseSpec({ ...spec([]), customStops: bad }), null);
  }
}

// --- 5. The server's price: only its own lookups count.
const price = (s, date, own, cat = catalog) => priceItem(parseSpec(s), date, cat, null, own);
const base = price(spec([]), GREEN, []);
const two = price(spec([WATERFALL, ASIS]), GREEN, [WATERFALL, ASIS]);
check("priced by the server: ride + $112", two.totalCents, base.totalCents + 11200);
check("nothing in it is a pass-through or a company-paid cost", [two.passThroughCents, two.companyCostCents], [0, 0]);
{
  // The browser claims the stops are free and on the way: the server's own detours decide.
  const lying = { ...spec([WATERFALL, ASIS]), customStops: [{ id: WATERFALL.id, label: WATERFALL.label, minutes: 90, detourKm: 0, detourMin: 0, price: 0 }, { id: ASIS.id, label: ASIS.label, minutes: 120, cents: 0 }] };
  check("client-sent prices and detours are ignored", price(lying, GREEN, [WATERFALL, ASIS]).totalCents, two.totalCents);
  check("own stops in the request but none looked up: refused", refused(() => price(spec([WATERFALL]), GREEN, [])), cs.customStopErrors.unchecked);
  check("…also when nothing is passed at all", refused(() => price(spec([WATERFALL]), GREEN, undefined)), cs.customStopErrors.unchecked);
  check("looked-up stops that aren't the requested ones: refused", refused(() => price(spec([WATERFALL]), GREEN, [ASIS])), cs.customStopErrors.unchecked);
  check("a different time than requested: refused", refused(() => price(spec([WATERFALL]), GREEN, [{ ...WATERFALL, minutes: 30 }])), cs.customStopErrors.unchecked);
  check("looked-up stops on a ride that asked for none are not charged", price(spec([]), GREEN, [WATERFALL]).totalCents, base.totalCents);
  check("high season", price(spec([WATERFALL, ASIS]), HIGH, [WATERFALL, ASIS]).totalCents - price(spec([]), HIGH, []).totalCents, Math.round(11200 * (high.multiplierBps / 10000)));
  const m = refused(() => price(spec([WATERFALL], { vehicleId: "economy" }), GREEN, [WATERFALL]));
  check("Economy is a direct ride: own stops refused like catalog stops", /direct ride without stops/.test(m ?? ""), true);
  const rate25 = price(spec([WATERFALL, ASIS]), GREEN, [WATERFALL, ASIS], { ...catalog, waitPerHourCents: 2500 });
  // 1.5 h × $25 + 9.90 + 4.00 = $51.40 → $51; 2 h × $25 + 21.60 + 6.33 = $77.93 → $78.
  check("a new wait rate in the settings changes the price ($25/h → $51 + $78)", rate25.totalCents - base.totalCents, 12900);
}

// --- 6. Limits (from the settings): how many, how long, how far.
{
  const THIRD = { id: "ChIJgardenAAAAAAAA", label: "Else Kientzler Garden", lat: 10.09, lng: -84.35, minutes: 30, detourKm: 6, detourMin: 12 };
  const FOURTH = { id: "ChIJfourthAAAAAAAA", label: "Soda", lat: 10, lng: -84.4, minutes: 30, detourKm: 0, detourMin: 0 };
  const short = [{ ...WATERFALL, minutes: 60 }, { ...ASIS, minutes: 60 }, THIRD];
  check("3 stops, 2 h 30 at stops, 74 min of extra driving: fine", refused(() => price(spec(short), GREEN, short)), null);
  const four = [...short, FOURTH];
  check("a 4th stop is refused, pointing to our team", refused(() => price(spec(four), GREEN, four)), cs.customStopErrors.tooMany(3));
  const long = [{ ...WATERFALL, minutes: 180 }, { ...ASIS, minutes: 90 }];
  check("4 h 30 at stops is refused", refused(() => price(spec(long), GREEN, long)), cs.customStopErrors.tooLong(240));
  check("exactly 4 h is fine", refused(() => price(spec([{ ...WATERFALL, minutes: 120 }, ASIS]), GREEN, [{ ...WATERFALL, minutes: 120 }, ASIS])), null);
  const far = [{ ...WATERFALL, detourMin: 60 }, { ...ASIS, detourMin: 31 }];
  check("91 min of extra driving is refused", refused(() => price(spec(far), GREEN, far)), cs.customStopErrors.tooFar);
  check("exactly 90 min is fine", refused(() => price(spec([{ ...WATERFALL, detourMin: 60 }, { ...ASIS, detourMin: 30 }]), GREEN, [{ ...WATERFALL, detourMin: 60 }, { ...ASIS, detourMin: 30 }])), null);
  // The time limit counts the catalog stops on the same ride too, but only when there is an own stop.
  const slow = catalog.stops.filter((s) => s.corridors.includes("SJO") && s.corridors.includes("ManuelAntonio"));
  const sjo = (own, stopIds) => ({ ...spec(own), origin: "SJO", destination: "ManuelAntonio", stopIds });
  const catMinutes = slow.reduce((n, s) => n + s.durationMin, 0);
  check("(the test route has catalog stops)", slow.length > 0 && catMinutes > 60, true);
  const filler = { ...WATERFALL, minutes: 180 };
  check(
    "catalog + own stops together above 4 h: refused",
    refused(() => price(sjo([filler], slow.map((s) => s.id)), GREEN, [filler])),
    catMinutes + 180 > 240 ? cs.customStopErrors.tooLong(240) : null,
  );
  check("catalog stops alone are never refused by the limit", refused(() => price(sjo([], slow.map((s) => s.id)), GREEN, [])), null);
  check("the limits come from the settings: 1 stop allowed", refused(() => price(spec([WATERFALL, ASIS]), GREEN, [WATERFALL, ASIS], { ...catalog, customStopLimits: { maxStops: 1, maxWaitMinutes: 240, maxDetourMinutes: 90 } })), cs.customStopErrors.tooMany(1));
  check("…5 hours allowed", refused(() => price(spec(long), GREEN, long, { ...catalog, customStopLimits: { maxStops: 3, maxWaitMinutes: 300, maxDetourMinutes: 90 } })), null);
  check("…switched off (0 stops)", refused(() => price(spec([WATERFALL]), GREEN, [WATERFALL], { ...catalog, customStopLimits: { maxStops: 0, maxWaitMinutes: 240, maxDetourMinutes: 90 } })), cs.customStopErrors.off);
  check("before the server answers, the page checks count and time only", cs.customStopsProblem([{ minutes: 180 }, { minutes: 90 }], 0), cs.customStopErrors.tooLong(240));
  check("no own stops: no problem, whatever the catalog stops take", cs.customStopsProblem([], 600), null);

  // The refusals: friendly, point to our team, never a name or a promise of hours.
  const all = [cs.customStopErrors.tooMany(3), cs.customStopErrors.tooLong(240), cs.customStopErrors.tooLong(90), cs.customStopErrors.tooLong(45), cs.customStopErrors.tooFar, cs.customStopErrors.off, cs.customStopErrors.boat, cs.customStopErrors.twice, cs.customStopErrors.unchecked];
  for (const m of all) {
    const es = localizeServerMessage(m, "es");
    check(`Spanish for: ${m.slice(0, 40)}…`, es !== m && /[áéíóúñ]|parada/.test(es), true);
    check(`…asks to message us when the English does`, /escríbanos y le cotizamos\.$/.test(es), cs.isAskUsError(m));
    check(`…no owner, parent brand or 24/7`, /jorge|travel planner|familia m[aá]gica|24\/7/i.test(m + es), false);
  }
  check("limit messages end by pointing to our team", [cs.isAskUsError(all[0]), cs.isAskUsError(all[1]), cs.isAskUsError(all[4]), cs.isAskUsError(cs.customStopErrors.twice)], [true, true, true, false]);
  check("Spanish, 4 hours", localizeServerMessage(cs.customStopErrors.tooLong(240), "es"), "Las paradas pueden sumar hasta 4 horas en total. Para un recorrido más largo, escríbanos y le cotizamos.");
  check("Spanish, 3 stops", localizeServerMessage(cs.customStopErrors.tooMany(3), "es"), "Puede agregar hasta 3 paradas propias. Para un recorrido más largo, escríbanos y le cotizamos.");
  check("the card's note about tickets", [cs.CUSTOM_STOP_ENTRANCE.en, cs.CUSTOM_STOP_ENTRANCE.es], ["Entrance tickets not included; paid at the place", "Entradas no incluidas; se pagan en el lugar"]);
}

// --- 7. Money after the price: payout 80 / 20, promo code 50 / 50, cash fee.
const pay = splitPayout(two.totalCents, two.passThroughCents, catalog, two.companyCostCents);
const payBase = splitPayout(base.totalCents, 0, catalog, 0);
check("the driver gets 80% of the stops ($112 → $89.60)", pay.payoutCents - payBase.payoutCents, 8960);
check("we keep 20% of them ($22.40)", pay.feeCents - payBase.feeCents, 2240);
{
  const item = { kind: "transfer", totalCents: two.totalCents, passThroughCents: 0, companyCostCents: 0, boatCents: 0 };
  check("a promo code discounts the stops like the ride (the whole price is shared)", promo.sharedCents(item), two.totalCents);
  const ten = promo.applyPromo({ discount_type: "percent", value: 10, applies_to: "rides" }, [item], catalog).lines[0];
  check("10% off takes 10% of ride + stops", ten.discountCents, Math.round(two.totalCents * 0.1));
  check("…half from the driver (rounded down), the rest from us", [ten.driverCents, ten.platformCents], [Math.floor(ten.discountCents / 2), ten.discountCents - Math.floor(ten.discountCents / 2)]);
  const money = promo.discountedMoney(two.totalCents, pay, ten);
  check("price − discount; payout and our share reduced", [money.totalCents, money.payoutCents, money.feeCents], [two.totalCents - ten.discountCents, pay.payoutCents - ten.driverCents, pay.feeCents - ten.platformCents]);
  check("the 10% cash fee is charged on what is left", pricing.cashFeeCents(money.totalCents, catalog.cashFeeBps), Math.round((money.totalCents * catalog.cashFeeBps) / 10000));
}

// --- 8. On the booking: what is saved, and what a driver gets.
const stored = cs.storedCustomStops([WATERFALL, ASIS], catalog);
check("saved in order with name, place, minutes, detour and the price before the season", stored, [
  { id: "custom-1", custom: true, name: "La Fortuna Waterfall", place_id: WATERFALL.id, lat: 10.4433, lng: -84.6712, minutes: 90, detour_km: 11, detour_min: 24, price: 44 },
  { id: "custom-2", custom: true, name: "Proyecto Asis", place_id: ASIS.id, lat: 10.4, lng: -84.5, minutes: 120, detour_km: 24, detour_min: 38, price: 68 },
]);
{
  // stops_for_driver() (migration 0036) removes every "price"; nothing else in an entry is money.
  const forDriver = stored.map((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== "price")));
  check("without 'price' a driver's entry holds no money", [JSON.stringify(forDriver).match(/price|cents|usd|\$/i), forDriver.flatMap((e) => Object.values(e)).some((v) => v === 44 || v === 68)], [null, false]);
  check("…its fields", Object.keys(forDriver[0]), ["id", "custom", "name", "place_id", "lat", "lng", "minutes", "detour_km", "detour_min"]);
  check("…but the name, the time there and the map point", [forDriver[0].name, forDriver[0].minutes, forDriver[0].lat, forDriver[0].lng], ["La Fortuna Waterfall", 90, 10.4433, -84.6712]);
  const saved = [{ id: "tarcoles", price: 15 }, ...stored];
  check("read back from a booking: own stops only", cs.customStopsOf(saved).map((s) => s.name), ["La Fortuna Waterfall", "Proyecto Asis"]);
  check("…malformed entries are left out", cs.customStopsOf([{ id: "custom-1", custom: true }, "x", null, { id: "custom-2", custom: true, name: "Y", minutes: 30 }]).map((s) => s.name), ["Y"]);
  check("names for lists", saved.map((s) => cs.savedStopLabel(s, catalog.stops)), [catalog.stops.find((s) => s.id === "tarcoles").name, "La Fortuna Waterfall (1 h 30 min)", "Proyecto Asis (2 h)"]);
  check("an unknown id and the tour upgrade keep their old labels", [cs.savedStopLabel({ id: "gone" }, catalog.stops), cs.savedStopLabel({ id: "en_route_upgrade" }, catalog.stops)], ["gone", "Smart En-Route Transfer"]);
  check("back to the shape the price needs", cs.pricedFromStored(cs.customStopsOf(stored)[0]), { id: WATERFALL.id, label: WATERFALL.label, lat: 10.4433, lng: -84.6712, minutes: 90, detourKm: 11, detourMin: 24 });
  check("time texts", [30, 60, 90, 120, 180].map(cs.stopTimeText), ["30 min", "1 h", "1 h 30 min", "2 h", "3 h"]);
  check("names of real places aren't taken for contact details", ["La Fortuna Waterfall", "Proyecto Asis", "Else Kientzler Botanical Garden", "Soda La Hormiga 2", "Mirador El Silencio"].some(hasContactDetails), false);

  // Dispatch calendar and driver matching: the trip lasts drive (with the detours) + time at the stops.
  const at = "2027-06-15T08:00:00-06:00";
  const ride = { id: "b1", status: "confirmed", service_type: "transfer", scheduled_at: at, origin: null, destination: null, origin_coords: { town: "Arenal" }, destination_coords: { town: "ManuelAntonio" }, sightseeing_stops: stored };
  const CAT = { stops: catalog.stops, dayTours: catalog.dayTours };
  check("calendar: saved drive time (detours inside) + 210 min at the stops", dispatch.busySpan({ ...ride, drive_minutes: 352 }, CAT).minutes, 352 + 210);
  check("calendar: no saved drive time: town table + detours + time at the stops", dispatch.busySpan(ride, CAT).minutes, plain.driveMinutes + 62 + 210);
  check("calendar: with a catalog stop too", dispatch.busySpan({ ...ride, drive_minutes: 352, sightseeing_stops: [{ id: "tarcoles" }, ...stored] }, CAT).minutes, 352 + 210 + catalog.stops.find((s) => s.id === "tarcoles").durationMin + catalog.stops.find((s) => s.id === "tarcoles").detourMin);
  check("matching: road time + each own stop's time and detour", matching.tripDurationMinutes(ride), plain.driveMinutes + 62 + 210);
  check("matching: a catalog stop still counts 45 min", matching.tripDurationMinutes({ ...ride, sightseeing_stops: [{ id: "tarcoles" }] }), plain.driveMinutes + 45);

  // The team's trip edit prices the saved own stops again (src/lib/bookingEdit.ts).
  const booking = { service_type: "transfer", vehicle_class: "sedan", passenger_count: 2, sightseeing_stops: saved, preferences: null, sign_text: null, catalog_item_id: null };
  const hub = (id) => ({ id: `hub:${id}`, label: id, hub: id, lat: 0, lng: 0 });
  const edit = be.specForBooking(booking, { date: GREEN, time: "08:00", notes: "", driverNotes: "" }, hub("Arenal"), hub("ManuelAntonio"));
  check("edit: catalog stops stay catalog stops", edit.stopIds, ["tarcoles"]);
  check("edit: own stops go in as saved (place, name, minutes)", edit.customStops, [{ id: WATERFALL.id, label: "La Fortuna Waterfall", minutes: 90 }, { id: ASIS.id, label: "Proyecto Asis", minutes: 120 }]);
  const again = priceItem({ ...edit, stopIds: [] }, GREEN, catalog, null, cs.customStopsOf(saved).map(cs.pricedFromStored));
  check("edit: same price as when it was booked", again.totalCents, two.totalCents);
}
check("the route link carries the stops in order", new URL(mapsDirectionsUrl({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, [{ lat: 5, lng: 6 }, { lat: 7, lng: 8 }])).searchParams.get("waypoints"), "5,6|7,8");
check("…and is unchanged without stops", new URL(mapsDirectionsUrl({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })).searchParams.has("waypoints"), false);

// --- The worked example -------------------------------------------------------------------------
const hiTwo = price(spec([WATERFALL, ASIS]), HIGH, [WATERFALL, ASIS]);
console.log("La Fortuna → La Fortuna Waterfall (1 h 30) → Proyecto Asis (2 h) → Manuel Antonio / Quepos, Standard Sedan, 2 travellers");
console.log(`  Ride (town table, green season):                      ${usd(base.totalCents)}`);
for (const s of [WATERFALL, ASIS]) {
  const p = cs.customStopParts(s, catalog);
  console.log(
    `  ${s.label}: wait ${cs.stopTimeText(s.minutes)} ${usd(p.waitCents)} + ${s.detourKm} km ${usd(p.kmCents)} + ${s.detourMin} min driving ${usd(p.driveCents)} = ${usd(p.waitCents + p.kmCents + p.driveCents)} → ${usd(cs.customStopCents(s, catalog))}`,
  );
}
console.log(`  Total green season: ${usd(two.totalCents)} · driver ${usd(pay.payoutCents)} · our share ${usd(pay.feeCents)} · high season total ${usd(hiTwo.totalCents)}`);
console.log(`  Door to door: ${plain.driveMinutes + 62} min driving + 210 min at the stops`);
console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
