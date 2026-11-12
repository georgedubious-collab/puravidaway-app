/**
 * Cases for "fixed prices only" (Jorge, 2026-11-11): travellers book at the fixed price; the
 * "Driver offers" / "name your price" mode is gone from the website and the customer app.
 * An older page or app build may still send a ride as a traveller's offer; the server refuses
 * it with a clear message in English and Spanish (submitTripRequest() in src/app/trip/actions.ts
 * returns retiredItemError() before anything is looked up). Fixed-price requests are unchanged.
 *
 *   npm run test:fixed        (Node 22.15+; Node runs the TypeScript directly)
 *
 * Drivers' offers on their payout (job board, offer_job()) are a different thing and are not
 * touched: `npm run test:db` checks offer_job() and accept_offer() against the migrations.
 */
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

// The app's files import each other without ".ts"; add it for Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const warn = console.warn;
console.warn = () => {}; // the catalog warns about the WhatsApp number when loaded outside the site
const trip = await import("../src/lib/tripRequest.ts");
const { localizeServerMessage } = await import("../src/lib/serverMessagesEs.ts");
const { parseStoredCart } = await import("../src/lib/cart.ts");
const { BUILT_IN_CATALOG } = await import("../src/lib/catalogModel.ts");
console.warn = warn;

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};

const DATE = "2099-06-15";
const ride = { kind: "transfer", origin: "SJO", destination: "ManuelAntonio", vehicleId: "sedan", stopIds: [], pax: 2, pickupTime: "09:00" };
const offerRide = { ...ride, pricing: "bid", offerCents: 9000 };
const tour = { kind: "day_tour", tourId: "dt1", upgrade: false, pax: 2 };

// --- Recognising an offer -----------------------------------------------------------------
check("an offer ride (older page / app) is recognised", trip.isTravellerOfferSpec(offerRide), true);
check("…also with only offerCents", trip.isTravellerOfferSpec({ ...ride, offerCents: 9000 }), true);
check("a fixed ride is not", trip.isTravellerOfferSpec({ ...ride, pricing: "fixed" }), false);
check("a ride without a pricing field is not", trip.isTravellerOfferSpec(ride), false);
check("a day tour is not", trip.isTravellerOfferSpec(tour), false);
check("an offer ride is never parsed", trip.parseSpec(offerRide), null);
check("an unknown pricing value is never parsed", trip.parseSpec({ ...ride, pricing: "auction" }), null);

// --- The server's refusal, in English and Spanish ---------------------------------------------
check("a request with an offer is refused", trip.retiredItemError([{ spec: offerRide }]), trip.TRAVELLER_OFFER_ERROR);
check("…also when it is one item among others", trip.retiredItemError([{ spec: { ...ride, pricing: "fixed" } }, { spec: tour }, { spec: offerRide }]), trip.TRAVELLER_OFFER_ERROR);
check("a fixed request is not refused (pricing: fixed, as the apps send)", trip.retiredItemError([{ spec: { ...ride, pricing: "fixed" } }]), null);
check("a fixed request is not refused (no pricing field, as the website sends)", trip.retiredItemError([{ spec: ride }, { spec: tour }]), null);
check("a multi-day item is still refused with its own message", trip.retiredItemError([{ spec: { kind: "expedition", expeditionId: "md1", tierId: "base" } }]), trip.RETIRED_EXPEDITION_ERROR);
check("refusal message, English", trip.TRAVELLER_OFFER_ERROR, "Please book at the fixed price shown; offers are no longer available.");
// /api/v1/client/trip-request (the app) passes every error through localizeServerMessage.
check("refusal message, Spanish (usted)", localizeServerMessage(trip.TRAVELLER_OFFER_ERROR, "es"), "Por favor, reserve al precio fijo indicado; las ofertas ya no están disponibles.");
check("refusal message stays English for English", localizeServerMessage(trip.TRAVELLER_OFFER_ERROR, "en"), trip.TRAVELLER_OFFER_ERROR);

// The trip request action runs that check first (it needs a database past that point, so the
// wiring is checked in its source).
const action = readFileSync(new URL("../src/app/trip/actions.ts", import.meta.url), "utf8");
const at = (s) => action.indexOf(s);
check("submitTripRequest() refuses with retiredItemError()", at("const retired = retiredItemError(items);") > 0 && at("if (retired) return { ok: false, error: retired };") > 0, true);
check("…before the database or the catalog is touched", at("retiredItemError(items)") < at("createSupabaseAdminClient()") && at("retiredItemError(items)") < at("await getCatalog()"), true);
check("…and saves every new booking at the fixed price", /pricing_mode: "fixed",/.test(action) && !/pricing === "bid"/.test(action), true);

// --- Fixed rides still parse and price ------------------------------------------------------
const fixedOld = trip.parseSpec({ ...ride, pricing: "fixed" }); // what the apps and older pages send
const fixedNew = trip.parseSpec(ride); // what the website sends now
check("a fixed ride (pricing: fixed) parses", fixedOld?.kind, "transfer");
check("a ride without a pricing field parses", fixedNew?.kind, "transfer");
check("the parsed ride carries no pricing or offer fields", "pricing" in fixedOld || "offerCents" in fixedOld, false);
const priced = trip.priceItem(fixedOld, DATE, BUILT_IN_CATALOG);
check("a fixed ride is priced from the catalog", priced.totalCents > 0, true);
check("both forms cost the same", trip.priceItem(fixedNew, DATE, BUILT_IN_CATALOG).totalCents, priced.totalCents);

// --- A ride saved as an offer in a browser's trip comes back at the fixed price -------------
const stored = JSON.stringify([{ kind: "transfer", id: "x", title: "SJO → MA", detail: "d", date: DATE, totalCents: 9000, spec: offerRide }]);
const loaded = parseStoredCart(stored);
check("an old offer in the trip keeps the ride", loaded.length, 1);
check("…as a fixed-price ride (the server then shows the new total)", Boolean(loaded[0]?.spec) && !("pricing" in loaded[0].spec) && !("offerCents" in loaded[0].spec), true);
check("…which is no longer refused", trip.retiredItemError(loaded), null);

// --- Report -----------------------------------------------------------------------------------
console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
