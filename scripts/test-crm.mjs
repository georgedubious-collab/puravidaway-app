/**
 * Cases for CRM part 3 (2026-11-12):
 *   - the refund calculator (src/lib/refundPolicy.ts): 24 h exactly, 23:59, no-show, team / driver
 *     cancel, weather, nothing received, the team's change needing a reason;
 *   - the one-tap WhatsApp messages (src/lib/whatsappMessages.ts): English and Spanish, encoded
 *     safely in the wa.me link, buttons that wait for a driver / a balance;
 *   - the cancellation emails and the team's "driver removed" alert (src/lib/cancellationMessages.ts):
 *     the driver's email never holds the traveller's details or any price;
 *   - the driver scorecard maths (src/lib/scorecard.ts);
 *   - customers (src/lib/customers.ts): the grouping key, tags, search text;
 *   - the manual booking form with a typed hotel reaches the same price as the website.
 *
 *   npm run test:crm        (Node 22.15+; Node runs the TypeScript directly)
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
const r = await import("../src/lib/refundPolicy.ts");
const wa = await import("../src/lib/whatsappMessages.ts");
const cm = await import("../src/lib/cancellationMessages.ts");
const sc = await import("../src/lib/scorecard.ts");
const cu = await import("../src/lib/customers.ts");
const places = await import("../src/lib/places.ts");
const trip = await import("../src/lib/tripRequest.ts");
const { quoteTransfer } = await import("../src/lib/pricing.ts");
const { BUILT_IN_CATALOG, seasonForYmd } = await import("../src/lib/catalogModel.ts");
console.warn = warn;

let passed = 0;
const failures = [];
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};
const ok = (name, cond) => (cond ? passed++ : failures.push(name));

// --- Refund calculator ----------------------------------------------------------------------------
const PICKUP = "2026-12-01T15:00:00.000Z"; // 9:00 AM Costa Rica
const before = (ms) => new Date(Date.parse(PICKUP) - ms).toISOString();
const H = 3_600_000;
const trav = (askedAt, extra = {}) => r.refundByPolicy({ by: "traveller", pickupAt: PICKUP, askedAt, amountReceived: 120.5, ...extra });
eq("exactly 24 h before → full refund", trav(before(24 * H)), { refund: 120.5, rule: "free_24h", hoursBefore: 24 });
eq("23 h 59 min before → no refund", trav(before(24 * H - 60_000)).refund, 0);
eq("…rule: late", trav(before(24 * H - 60_000)).rule, "late_or_no_show");
eq("23:59:59.999 before → still no refund", trav(before(24 * H - 1)).refund, 0);
eq("3 days before → full refund", trav(before(72 * H)).refund, 120.5);
eq("no-show (asked early but didn't show) → no refund", trav(before(72 * H), { noShow: true }), { refund: 0, rule: "late_or_no_show", hoursBefore: 72 });
eq("after the pickup time → no refund", trav(before(-2 * H)).refund, 0);
eq("hours before after the pickup are negative", trav(before(-2 * H)).hoursBefore, -2);
eq("team cancels 1 h before → full refund", r.refundByPolicy({ by: "team", pickupAt: PICKUP, askedAt: before(H), amountReceived: 80 }), { refund: 80, rule: "we_cancelled", hoursBefore: 1 });
eq("driver cancels → full refund", r.refundByPolicy({ by: "driver", pickupAt: PICKUP, askedAt: before(H), amountReceived: 80 }).rule, "we_cancelled");
eq("weather → full refund proposed", r.refundByPolicy({ by: "weather", pickupAt: PICKUP, askedAt: before(H), amountReceived: 80 }), { refund: 80, rule: "weather", hoursBefore: 1 });
eq("cash booking, nothing received, early → $0", r.refundByPolicy({ by: "traveller", pickupAt: PICKUP, askedAt: before(48 * H), amountReceived: 0 }).refund, 0);
eq("no pickup time: traveller → no automatic refund", r.refundByPolicy({ by: "traveller", pickupAt: null, askedAt: PICKUP, amountReceived: 50 }).refund, 0);
eq("money is rounded to cents", r.refundByPolicy({ by: "team", pickupAt: PICKUP, askedAt: PICKUP, amountReceived: 10.005 }).refund, 10.01);
eq("Costa Rica time typed → instant", r.crLocalToIso("2026-11-30T09:00"), "2026-11-30T15:00:00.000Z");
eq("instant → Costa Rica time box", r.isoToCrLocal("2026-11-30T15:00:00.000Z"), "2026-11-30T09:00");
eq("bad time box", r.crLocalToIso("30/11/2026 9:00"), null);
eq("refund equal to the policy needs no reason", r.refundProblem(120.5, 120.5, 120.5, "", "es"), null);
ok("changed refund without a reason is refused (ES)", /motivo/.test(r.refundProblem(60, 120.5, 120.5, "", "es") ?? ""));
eq("changed refund with a reason is fine", r.refundProblem(60, 120.5, 120.5, "Half the tour ran", "en"), null);
ok("refund above what was received is refused", /more than/.test(r.refundProblem(130, 120.5, 120.5, "goodwill", "en") ?? ""));
ok("unreadable amount is refused", Boolean(r.refundProblem(r.parseMoney("12,50"), 0, 20, "", "en")));
ok("every rule has words in both languages", ["free_24h", "late_or_no_show", "we_cancelled", "weather"].every((x) => r.ruleText(x, "es") && r.ruleText(x, "en")));

// --- WhatsApp messages ----------------------------------------------------------------------------
const facts = {
  lang: "en",
  guestName: "Emily Rose Smith",
  ref: "CRPT-10492",
  what: "SJO Airport → Manuel Antonio",
  when: "2026-12-01 · 9:00 AM",
  tripUrl: "https://www.costaricaprivatetransfers.com/trip/abc",
  driver: "Carlos",
  vehicle: wa.vehicleText({ make_model: "Toyota Hiace", year: 2021, color: "white", plate: "BCD123" }, "en"),
  sign: "Emily S.",
  amountDue: 0,
};
eq("vehicle as the trip page shows it", facts.vehicle, "Toyota Hiace 2021 · white · plate BCD123");
eq("vehicle in Spanish says placa", wa.vehicleText({ make_model: "Toyota Hiace", plate: "BCD123" }, "es"), "Toyota Hiace · placa BCD123");
const enConfirmed = wa.waMessage("driver_confirmed", facts);
ok("EN driver confirmed: first name, car, time, sign, link", ["Hi Emily!", "Carlos", "Toyota Hiace 2021", "9:00 AM", '"Emily S."', facts.tripUrl].every((s) => enConfirmed.includes(s)));
const es = { ...facts, lang: "es", when: "1 de diciembre de 2026 · 9:00 a. m.", vehicle: wa.vehicleText({ make_model: "Toyota Hiace", year: 2021, color: "blanco", plate: "BCD123" }, "es") };
const esConfirmed = wa.waMessage("driver_confirmed", es);
ok("ES driver confirmed uses usted and «»", esConfirmed.startsWith("¡Hola Emily!") && esConfirmed.includes("Su conductor") && esConfirmed.includes("«Emily S.»") && esConfirmed.includes("placa BCD123"));
ok("ES never uses tú forms", !/\b(tu|tus|te)\b/i.test(Object.values({ a: wa.waMessage("received", es), b: esConfirmed, c: wa.waMessage("day_before", es), d: wa.waMessage("looking_into_it", es) }).join(" ")));
const link = wa.waLink("+506 8888-1234", esConfirmed);
ok("wa.me link uses digits only", link.startsWith("https://wa.me/50688881234?text="));
eq("text survives the link (accents, «», →, &, emoji)", decodeURIComponent(new URL(link).searchParams.get("text")), esConfirmed);
const tricky = wa.waMessage("received", { ...facts, guestName: "Zoë & Ana #1", what: "A → B?x=1&y=2" });
eq("special characters are encoded, not broken", decodeURIComponent(new URL(wa.waLink("15551234567", tricky)).searchParams.get("text")), tricky);
ok("no raw & or # in the query", !/[&#\s]/.test(wa.waLink("15551234567", tricky).split("?text=")[1]));
eq("00 prefix dropped", wa.waDigits("00506 8888 1234"), "50688881234");
eq("too short is no number", wa.waLink("1234", "x"), null);
eq("no phone → no link", wa.waLink(null, "x"), null);
ok("driver buttons wait for a driver", Boolean(wa.waUnavailable("driver_confirmed", { ...facts, driver: null }, "es")) && Boolean(wa.waUnavailable("day_before", { ...facts, driver: null }, "en")));
ok("payment reminder waits for a balance", Boolean(wa.waUnavailable("payment_reminder", facts, "es")));
const pay = wa.waMessage("payment_reminder", { ...facts, amountDue: 145 });
ok("payment reminder shows the amount and trip link", pay.includes("$145.00") && pay.includes(facts.tripUrl));
ok("ES day-before reminder", wa.waMessage("day_before", es).includes("Le recordamos su viaje de mañana"));
ok("tours: no sign line", !wa.waMessage("driver_confirmed", { ...facts, sign: null }).includes("sign"));
ok("all five kinds have both labels", wa.WA_KINDS.every((k) => wa.waButtonLabel(k, "es") && wa.waButtonLabel(k, "en")));

// --- Cancellation emails ---------------------------------------------------------------------------
const tc = { lang: "en", guestName: "Emily Smith", ref: "CRPT-1", what: "SJO Airport → Manuel Antonio", when: "2026-12-01 · 9:00 AM", by: "team", amountReceived: 120, refundDue: 120, tripUrl: "https://x/trip/abc" };
const te = cm.travellerCancelEmail(tc);
ok("traveller email: subject, sorry, refund amount", te.subject === "Your booking CRPT-1 is cancelled" && te.lines.some((l) => l.includes("very sorry")) && te.lines.some((l) => l.includes("$120.00")));
const tes = cm.travellerCancelEmail({ ...tc, lang: "es", by: "traveller", refundDue: 0 });
ok("traveller email ES, late cancel: no refund line", tes.subject === "Su reserva CRPT-1 quedó cancelada" && tes.lines.some((l) => l.includes("no tiene reembolso")) && tes.lines.some((l) => l.includes("como nos pidió")));
ok("nothing received → no money line", !cm.travellerCancelEmail({ ...tc, amountReceived: 0, refundDue: 0 }).lines.some((l) => l.includes("$") || l.includes("policy")));
ok("weather → offers another date", cm.travellerCancelEmail({ ...tc, by: "weather" }).lines.some((l) => l.includes("another date")));
const de = cm.driverCancelEmail({ lang: "es", driverName: "Carlos Mora", ref: "CRPT-1", route: "Aeropuerto SJO → Manuel Antonio", when: "2026-12-01 · 9:00 a. m.", tripsUrl: "https://x/driver/trips" });
const deText = JSON.stringify(de);
ok("driver email in Spanish by default wording", de.subject.startsWith("Viaje cancelado") && de.lines[0] === "Hola Carlos:");
ok("driver email never holds traveller details or money", !/Emily|Smith|@|\+506|\$|USD|reembolso|refund|precio|price/i.test(deText));
const alert = cm.driverRemovedTeamEmail({ ref: "CRPT-1", route: "SJO → MA", when: "x", driver: "Carlos Mora", reason: "driver_dropped", reopened: true, replacedBy: null, bookingUrl: "https://x/admin/bookings/1" });
ok("team alert (Spanish) says the traveller was not told and the booking reopened", alert.lines.some((l) => l.includes("NO se le avisó")) && alert.lines.some((l) => l.includes("Abierta para conductores")) && alert.lines.some((l) => l.includes("el conductor canceló")));

// --- Driver removed / replaced (src/lib/driverChange.ts) ------------------------------------------
const dc = (await import("../src/lib/driverChange.ts")).driverChange;
const unassign = dc({ beforeDriver: "d1", newDriver: null, status: "confirmed", reason: "driver_dropped", hadRemovalBefore: false });
eq("unassign: back to open for drivers, traveller not told, no confirmed email",
  [unassign.removed, unassign.status, unassign.reopened, unassign.tellTravellerNow, unassign.sendDriverConfirmed, unassign.needsReason],
  ["d1", "pending_bids", true, false, false, false]);
eq("unassign without a reason is refused", dc({ beforeDriver: "d1", newDriver: null, status: "confirmed", reason: "", hadRemovalBefore: false }).needsReason, true);
const replace = dc({ beforeDriver: "d1", newDriver: "d2", status: "confirmed", reason: "team", hadRemovalBefore: false });
eq("replace: stays confirmed, new driver → existing 'driver confirmed' email; nothing about the removal",
  [replace.removed, replace.status, replace.tellTravellerNow, replace.sendDriverConfirmed], ["d1", "confirmed", false, true]);
eq("assign after an earlier drop-out → 'driver confirmed' email",
  dc({ beforeDriver: null, newDriver: "d2", status: "confirmed", reason: "", hadRemovalBefore: true }).sendDriverConfirmed, true);
eq("first ever manual assignment: unchanged (no new email)",
  dc({ beforeDriver: null, newDriver: "d2", status: "confirmed", reason: "", hadRemovalBefore: false }).sendDriverConfirmed, false);
eq("same driver saved again: nothing happens",
  [dc({ beforeDriver: "d1", newDriver: "d1", status: "confirmed", reason: "", hadRemovalBefore: true }).removed, dc({ beforeDriver: "d1", newDriver: "d1", status: "confirmed", reason: "", hadRemovalBefore: true }).sendDriverConfirmed],
  [null, false]);
eq("unassign on a booking still waiting for payment keeps its status",
  dc({ beforeDriver: "d1", newDriver: null, status: "pending_payment", reason: "team", hadRemovalBefore: false }).status, "pending_payment");

// --- Scorecard -----------------------------------------------------------------------------------
const NOW = new Date("2026-11-12T18:00:00Z");
const day = (n) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const card = sc.scorecard(
  [
    { status: "completed", scheduled_at: day(2), late_alert_at: null, driver_payout: 100, driver_settled_at: day(1) },
    { status: "completed", scheduled_at: day(10), late_alert_at: day(10), driver_payout: "80.50", driver_settled_at: null },
    { status: "completed", scheduled_at: day(40), late_alert_at: null, driver_payout: 60.25, driver_settled_at: day(35) },
    { status: "completed", scheduled_at: day(-1), late_alert_at: null, driver_payout: 10, driver_settled_at: null }, // future: not in 30 days
    { status: "confirmed", scheduled_at: day(-3), late_alert_at: null, driver_payout: 999, driver_settled_at: day(1) },
    { status: "cancelled", scheduled_at: day(5), late_alert_at: day(5), driver_payout: 50, driver_settled_at: null },
  ],
  [{ stars: 5, comment: "Great" }, { stars: 4, comment: "" }, { stars: 3, comment: null }, { stars: 5, comment: " ok " }],
  [{ status: "accepted" }, { status: "declined" }, { status: "submitted" }, { status: "withdrawn" }, { status: "accepted" }],
  1,
  NOW,
);
eq("scorecard", card, {
  completed30: 2,
  completedAll: 4,
  ratingAvg: 4.25,
  ratingCount: 4,
  commentShare: 50,
  alerts: 1,
  onTimeShare: 75,
  dropOuts: 1,
  offersSent: 4,
  offersAccepted: 2,
  acceptShare: 50,
  paidOut: 160.25,
});
eq("empty scorecard has no made-up shares", sc.scorecard([], [], [], 0, NOW), {
  completed30: 0, completedAll: 0, ratingAvg: null, ratingCount: 0, commentShare: null, alerts: 0, onTimeShare: null,
  dropOuts: 0, offersSent: 0, offersAccepted: 0, acceptShare: null, paidOut: 0,
});

// --- Customers -----------------------------------------------------------------------------------
eq("key: email, trimmed and lower-case", cu.customerKey("  Emily@Example.COM ", "+1 555", "t1"), "emily@example.com");
eq("key: phone digits when no email", cu.customerKey("", "+506 8888-1234", "t1"), "tel:50688881234");
eq("key: the trip when neither", cu.customerKey(null, null, "t1"), "trip:t1");
eq("profile link round trip", cu.parseCustomerKey(cu.customerHref("ana+cr@example.com").split("/").pop()), "ana+cr@example.com");
eq("odd key refused", cu.parseCustomerKey("%E0%A4%A"), null);
eq("upper-case key refused", cu.parseCustomerKey("Ana@x.com"), null);
eq("tags cleaned", cu.cleanTags(" VIP, honeymoon ,,vip, Early flight "), ["VIP", "honeymoon", "Early flight"]);
eq("at most 12 tags", cu.cleanTags(Array.from({ length: 20 }, (_, i) => `t${i}`).join(",")).length, 12);
eq("long tag cut to 30", cu.cleanTags("x".repeat(50))[0].length, 30);
ok("VIP any case", cu.isVip(["vip"]) && !cu.isVip(["vipp"]));
ok("repeat = 2+ bookings not cancelled", cu.isRepeat({ bookings: 3, cancelled: 1 }) && !cu.isRepeat({ bookings: 2, cancelled: 1 }));
eq("search text can't change the query", cu.cleanCustomerSearch("ana),or(id.eq.1*"), "ana or id.eq.1");
eq("filters", cu.parseCustomerFilters({ q: "ana", sort: "spent", page: "3" }), { q: "ana", sort: "spent", page: 3 });
eq("bad page → 1", cu.parseCustomerFilters({ page: "-2" }).page, 1);
eq("customers link keeps search + sort", cu.customersHref({ q: "ana", sort: "spent", page: 1 }, { page: 2 }), "/admin/customers?q=ana&sort=spent&page=2");
eq("trip day ES", cu.tripDay("2026-12-01T03:00:00Z", "es"), "30 nov 2026");
eq("trip day EN", cu.tripDay("2026-12-01T15:00:00Z", "en"), "Dec 1, 2026");

// --- Manual booking: a typed hotel is priced exactly like on the website ----------------------------
const catalog = BUILT_IN_CATALOG;
const DATE = "2099-06-15";
const hotel = { id: "ChIJarenasDelMarTest01", label: "Arenas Del Mar Beachfront & Rainforest Resort", hub: "ManuelAntonio", lat: 9.383, lng: -84.144 };
const sjo = places.hubPlace("SJO");
const route = { km: 171, drivingMinutes: 205, totalMinutes: 205, ferries: 0 };
for (const pickupTime of ["09:00", "23:30"]) {
  // What the website shows (TransfersView: quoteTransfer with the Google route).
  const website = quoteTransfer({ origin: "SJO", destination: "ManuelAntonio", vehicleId: "sedan", stopIds: [], season: seasonForYmd(DATE, catalog), catalog, route, pax: 2, pickupTime });
  // What the team's form sends (same shared helper) and the server prices (priceItem, after resolveTransfer).
  const sent = { kind: "transfer", ...places.placeSpecFields(sjo, hotel), vehicleId: "sedan", stopIds: [], pax: 2, pickupTime, pricing: "fixed" };
  const spec = trip.parseSpec(sent);
  ok(`typed hotel accepted by the server's request check (${pickupTime})`, spec && spec.destinationPlace?.id === hotel.id && !spec.originPlace);
  const team = trip.priceItem(spec, DATE, catalog, route);
  eq(`typed hotel: team price = website price (${pickupTime})`, team.totalCents, website.totalCents);
  eq(`typed hotel: night part matches (${pickupTime})`, team.nightCents, website.nightCents);
}
const hubOnly = trip.priceItem(trip.parseSpec({ kind: "transfer", origin: "SJO", destination: "ManuelAntonio", vehicleId: "sedan", stopIds: [], pax: 2, pickupTime: "09:00" }), DATE, catalog, null);
const typed = trip.priceItem(trip.parseSpec({ kind: "transfer", ...places.placeSpecFields(sjo, hotel), vehicleId: "sedan", stopIds: [], pax: 2, pickupTime: "09:00" }), DATE, catalog, { ...route, km: 260, drivingMinutes: 300, totalMinutes: 300 });
ok("a longer real route costs more than the town-to-town price (the route is really used)", typed.totalCents > hubOnly.totalCents);
eq("the shared helper keeps hub picks as before (no typed place)", places.placeSpecFields(sjo, places.hubPlace("Arenal")), { origin: "SJO", destination: "Arenal" });
let threw = false;
try {
  trip.priceItem(trip.parseSpec({ kind: "transfer", ...places.placeSpecFields(sjo, hotel), vehicleId: "sedan", stopIds: [], pax: 2, pickupTime: "09:00" }), DATE, catalog, null);
} catch {
  threw = true;
}
ok("typed place without a route is refused (never priced as a guess)", threw);

console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
