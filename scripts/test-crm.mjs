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
 *   - the manual booking form with a typed hotel reaches the same price as the website;
 *   - the team's trip edit (src/lib/bookingEdit.ts, 2026-11-12): refused on cancelled / completed
 *     bookings, admin-only actions, no price change unless chosen, an accepted offer kept, promo
 *     50/50, night premium, the messages (once each; the driver's without traveller details or price).
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
const be = await import("../src/lib/bookingEdit.ts");
const { splitPayout } = await import("../src/lib/payout.ts");
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

// --- Driver removed / replaced (src/lib/driverChange.ts) + the ONE assignment sender ---------------
const dc = (await import("../src/lib/driverChange.ts")).driverChange;
const am = await import("../src/lib/assignmentMessages.ts");
// What updateBooking does for one save: the drop-out rules from driverChange, and the dispatch
// sender (shouldNotifyAssignment → assignmentMessages) for a new driver. Nothing else messages anyone.
const save = (beforeDriver, newDriver, status, reason) => {
  const c = dc({ beforeDriver, newDriver, status, reason });
  const ctx = {
    bookingId: "b1", ref: "CRPT-1", serviceType: "transfer", origin: "SJO Airport", destination: "Manuel Antonio",
    scheduledAt: "2026-12-01T15:00:00Z", payout: 120, viaOffer: false, siteUrl: "https://x",
    driver: { id: newDriver ?? "", fullName: "Andrea Rojas", email: "andrea@example.com", appLang: "es" },
    guest: { name: "Emily Smith", email: "emily@example.com", accessToken: "a".repeat(64), language: "en" },
  };
  const sent = newDriver && am.shouldNotifyAssignment(beforeDriver, newDriver) ? am.assignmentMessages(ctx).map((m) => m.kind) : [];
  return { c, sent, travellerMessages: sent.filter((k) => k.startsWith("traveller")).length + (c.tellTravellerNow ? 1 : 0) };
};
const unassign = save("d1", null, "confirmed", "driver_dropped");
eq("unassign (driver cancelled): back to open, NO traveller message, removed driver not emailed",
  [unassign.c.removed, unassign.c.status, unassign.c.reopened, unassign.travellerMessages, unassign.c.emailRemovedDriver, unassign.c.needsReason],
  ["d1", "pending_bids", true, 0, false, false]);
eq("unassign without a reason is refused", dc({ beforeDriver: "d1", newDriver: null, status: "confirmed", reason: "" }).needsReason, true);
const teamRemove = save("d1", null, "confirmed", "team");
eq("unassign (team decision): removed driver gets the 'reassigned' email; traveller still told nothing",
  [teamRemove.c.emailRemovedDriver, teamRemove.travellerMessages], [true, 0]);
const replace = save("d1", "d2", "confirmed", "team");
eq("replace: stays confirmed; ONE 'driver confirmed' (email + push) from the dispatch sender, nothing about the removal",
  [replace.c.removed, replace.c.status, replace.sent.filter((k) => k === "traveller_email").length, replace.sent.filter((k) => k === "traveller_push").length],
  ["d1", "confirmed", 1, 1]);
ok("driverChange no longer has its own 'driver confirmed' sender", !("sendDriverConfirmed" in replace.c));
eq("assign after an earlier drop-out → the same single 'driver confirmed'", save(null, "d2", "confirmed", "").sent.filter((k) => k === "traveller_email").length, 1);
eq("first manual assignment → the same single sender", save(null, "d2", "confirmed", "").sent, ["traveller_push", "traveller_email", "driver_push", "driver_email"]);
eq("same driver saved again: nothing sent, nothing removed", [save("d1", "d1", "confirmed", "").sent.length, save("d1", "d1", "confirmed", "").c.removed], [0, null]);
eq("unassign on a booking still waiting for payment keeps its status", dc({ beforeDriver: "d1", newDriver: null, status: "pending_payment", reason: "team" }).status, "pending_payment");
const re = cm.driverReassignedEmail({ lang: "es", driverName: "Carlos Mora", ref: "CRPT-1", route: "Aeropuerto SJO → Manuel Antonio", when: "2026-12-01 · 9:00 a. m.", tripsUrl: "https://x/driver/trips" });
ok("reassigned email: Spanish, neutral, says they don't need to do it", re.subject.startsWith("Viaje reasignado: CRPT-1") && re.lines[0] === "Hola Carlos:" && re.lines[1].includes("fue reasignado. Ya no tiene que hacerlo") && re.lines[1].includes("hora de Costa Rica"));
ok("reassigned email: no reason, traveller details or money", !/Emily|Smith|@|\+506|\$|USD|precio|price|motivo|reason|canceló|equipo decidió/i.test(JSON.stringify(re).replace("https://x/driver/trips", "")));
ok("reassigned email in English for drivers who use English", cm.driverReassignedEmail({ lang: "en", driverName: null, ref: "CRPT-1", route: "A → B", when: "x", tripsUrl: "u" }).lines[1].includes("was reassigned"));

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

// --- The team's trip edit (src/lib/bookingEdit.ts, 2026-11-12) ---------------------------------
{
  const { readFileSync } = await import("node:fs");
  const TODAY = "2099-06-01";
  for (const st of ["pending_payment", "pending_bids", "confirmed", "in_progress"]) ok(`edit allowed when ${st}`, be.canEditPlaces(st));
  for (const st of ["cancelled", "completed"]) ok(`edit refused when ${st}`, !be.canEditPlaces(st));

  const hotelA = { id: "ChIJhotelAAAAAAAA", label: "Hotel A" };
  const hotelB = { id: "ChIJhotelBBBBBBBB", label: "Hotel B" };
  const base = { date: "2099-06-15", time: "09:00", origin: { id: "hub:SJO", label: "SJO" }, destination: hotelA, notes: "AA 100", driverNotes: "" };
  ok("a ride edit is accepted", be.parseEditInput(base, "transfer", TODAY).ok);
  ok("past date refused", !be.parseEditInput({ ...base, date: "2099-05-31" }, "transfer", TODAY).ok);
  ok("same pickup and drop-off refused", !be.parseEditInput({ ...base, destination: base.origin }, "transfer", TODAY).ok);
  ok("made-up place id refused", !be.parseEditInput({ ...base, destination: { id: "x", label: "y" } }, "transfer", TODAY).ok);
  ok("phone number in the notes refused (the driver sees them)", !be.parseEditInput({ ...base, notes: "call +506 8888 7777" }, "transfer", TODAY).ok);
  ok("email in the driver message refused", !be.parseEditInput({ ...base, driverNotes: "ana@example.com" }, "transfer", TODAY).ok);
  ok("tour pickup place with a link refused", !be.parseEditInput({ date: "2099-06-15", time: "07:00", pickupPlace: "www.hotel.com" }, "day_tour", TODAY).ok);
  ok("tour pickup place over 120 characters refused", !be.parseEditInput({ date: "2099-06-15", time: "07:00", pickupPlace: "a".repeat(121) }, "day_tour", TODAY).ok);

  const booking = {
    id: "b1", booking_ref: "CRPT-1", status: "confirmed", service_type: "transfer", catalog_item_id: null,
    origin: "Juan Santamaría Airport (SJO)", destination: "Hotel A, Quepos",
    origin_coords: { lat: 9.9939, lng: -84.2088, place_id: "hub:SJO", town: "SJO", route: { km: 160, drivingMinutes: 190, totalMinutes: 190, ferries: 0 } },
    destination_coords: { lat: 9.43, lng: -84.16, place_id: hotelA.id, town: "ManuelAntonio" },
    sightseeing_stops: [], vehicle_class: "sedan", scheduled_at: "2099-06-15T09:00:00-06:00", passenger_count: 2,
    flight_or_hotel_notes: "AA 100", driver_notes: null, pickup_place: null, preferences: {}, sign_text: null, sign_hide_name: false,
    drive_minutes: 190, total_price: 200, night_premium: 0, driver_payout: 160, platform_fee: 40, company_costs: 0, pass_through: 0,
    cash_fee: 0, payment_mode: "full_100", promo_code: null, promo_discount: 0, claimed_at: null, assigned_driver_id: "d1", amount_paid: 0,
  };
  const same = be.parseEditInput(base, "transfer", TODAY).input;
  eq("nothing changed: no ends changed", be.changedEnds(booking, same), { origin: false, destination: false });
  eq("nothing changed: no changes", be.listChanges(booking, same, { origin: null, destination: null }), []);
  const moved = be.parseEditInput({ ...base, destination: hotelB, time: "23:00", notes: "AA 100 · lobby" }, "transfer", TODAY).input;
  eq("new drop-off detected by place id", be.changedEnds(booking, moved), { origin: false, destination: true });
  const changes = be.listChanges(booking, moved, { origin: null, destination: { text: "Hotel B, Manuel Antonio" } });
  eq("changes listed old → new", changes.map((c) => c.field), ["destination", "scheduled_at", "flight_or_hotel_notes"]);
  ok("a place / time change can move the price", be.affectsPrice(changes));
  ok("a notes-only change can't", !be.affectsPrice(changes.filter((c) => c.field === "flight_or_hotel_notes")));

  // New price, made exactly like a new booking: priceItem → promo → payout split.
  const sjo = places.hubPlace("SJO");
  const b2 = { id: hotelB.id, label: "Hotel B", hub: "ManuelAntonio", lat: 9.39, lng: -84.14 };
  const route = { km: 171, drivingMinutes: 205, totalMinutes: 205, ferries: 0 };
  const spec = be.specForBooking(booking, moved, sjo, b2);
  ok("the booking becomes a website ride spec (typed drop-off, same vehicle)", spec.kind === "transfer" && spec.destinationPlace?.id === hotelB.id && spec.vehicleId === "sedan" && !spec.originPlace);
  const priced = trip.priceItem(spec, "2099-06-15", catalog, route);
  {
    // A ride with the traveller's own stop (src/lib/customStops.ts): the edit keeps it and prices it
    // again from the detour the server measured on the new route, never as an unknown catalog stop.
    const own = { id: "custom-1", custom: true, name: "Rainmaker Park", place_id: "ChIJrainmakerAAAAAA", lat: 9.5, lng: -84.2, minutes: 60, detour_km: 14, detour_min: 30, price: 38 };
    const withOwn = be.specForBooking({ ...booking, sightseeing_stops: [own] }, moved, sjo, b2);
    eq("own stop: kept on the spec as place, name and minutes; no catalog stop made of it", [withOwn.stopIds, withOwn.customStops], [[], [{ id: own.place_id, label: "Rainmaker Park", minutes: 60 }]]);
    const measured = [{ id: own.place_id, label: own.name, lat: 9.5, lng: -84.2, minutes: 60, detourKm: 20, detourMin: 40 }];
    // 1 h × $20 + 20 km × $0.90 + 40 min × $10/h = $44.67 → $45.
    eq("own stop: 'use the new price' prices it on the new route", trip.priceItem(withOwn, "2099-06-15", catalog, route, measured).totalCents - priced.totalCents, 4500);
    let msg = "";
    try { trip.priceItem(withOwn, "2099-06-15", catalog, route, []); } catch (e) { msg = e.message; }
    ok("own stop: without the server's measurement the price is refused (and so kept)", /couldn't check the road distance for your stops/.test(msg));
    try { msg = ""; trip.priceItem(withOwn, "2099-06-15", catalog, route, [{ ...measured[0], detourMin: 120 }]); } catch (e) { msg = e.message; }
    ok("own stop: too far on the new route → refused with the 'message us' text (price kept with a warning)", /message us and we'll quote it/.test(msg));
  }
  const website = quoteTransfer({ origin: "SJO", destination: "ManuelAntonio", vehicleId: "sedan", stopIds: [], season: seasonForYmd("2099-06-15", catalog), catalog, route, pax: 2, pickupTime: "23:00" });
  eq("new price = the website's price for that ride and time", priced.totalCents, website.totalCents);
  ok("a 23:00 pickup carries the night premium", priced.nightCents > 0);
  const noPromo = be.editPromoLine(booking, { kind: "transfer", totalCents: priced.totalCents, passThroughCents: 0, companyCostCents: 0 }, null, catalog);
  eq("no promo code: no discount", noPromo.discountCents, 0);
  const m = be.newMoney(booking, priced, noPromo, catalog, false);
  const split = splitPayout(priced.totalCents, priced.passThroughCents, catalog, priced.companyCostCents);
  eq("payout from the usual split (20% commission)", Math.round(m.driver_payout * 100), split.payoutCents);
  eq("payout + our share = price", Math.round((m.driver_payout + m.platform_fee) * 100), Math.round(m.total_price * 100));
  eq("night premium recorded", m.night_premium, priced.nightCents / 100);
  eq("keep the price: nothing in the money update", be.moneyPatch(be.currentMoney(booking), be.currentMoney(booking)), {});
  const mp = be.moneyPatch(be.currentMoney(booking), m);
  ok("use the new price: total and payout in the update", "total_price" in mp && "driver_payout" in mp);

  // Accepted offer: the amount stays unless the team updates it.
  const offered = { ...booking, claimed_at: "2099-06-01T10:00:00Z", driver_payout: 150, platform_fee: 50 };
  ok("accepted offer detected", be.hasAcceptedOffer(offered) && !be.hasAcceptedOffer(booking));
  const kept = be.newMoney(offered, priced, noPromo, catalog, true);
  eq("accepted offer kept as the payout", kept.driver_payout, 150);
  eq("…our share takes the difference", Math.round(kept.platform_fee * 100), Math.round(kept.total_price * 100) - 15000);
  eq("…or updated from the usual split when asked", Math.round(be.newMoney(offered, priced, noPromo, catalog, false).driver_payout * 100), split.payoutCents);

  // Promo code: same rule as a new booking, split 50/50.
  const promoBooking = { ...booking, promo_code: "SUMMER10", promo_discount: 18 };
  const item = { kind: "transfer", totalCents: priced.totalCents, passThroughCents: 0, companyCostCents: 0, boatCents: priced.boatCents };
  const line = be.editPromoLine(promoBooking, item, { discount_type: "percent", value: 10, applies_to: "both" }, catalog);
  eq("percent code applies to the new price", line.discountCents, Math.round(priced.totalCents * 0.1));
  eq("discount split 50/50 (driver's half rounded down)", [line.driverCents, line.platformCents], [Math.floor(line.discountCents / 2), line.discountCents - Math.floor(line.discountCents / 2)]);
  const pm = be.newMoney(promoBooking, priced, line, catalog, false);
  eq("promo: traveller pays price − discount", Math.round(pm.total_price * 100), priced.totalCents - line.discountCents);
  eq("promo: driver gives up half", Math.round(pm.driver_payout * 100), split.payoutCents - line.driverCents);
  eq("deleted code: the old discount is kept", be.editPromoLine(promoBooking, item, null, catalog).discountCents, 1800);
  ok("cash booking: the cash fee follows the new price", be.newMoney({ ...booking, payment_mode: "cash_driver" }, priced, noPromo, catalog, false).cash_fee > 0);

  // Day tour: the pickup place is free text; only the date / time can move the price.
  const tour = { ...booking, service_type: "day_tour", catalog_item_id: catalog.dayTours[0].id, vehicle_class: null, origin: null, destination: null, origin_coords: null, destination_coords: null, pickup_place: "Hotel Uno" };
  const tin = be.parseEditInput({ date: "2099-06-15", time: "09:00", pickupPlace: "Hotel Dos" }, "day_tour", TODAY).input;
  eq("tour: pickup place change listed", be.listChanges(tour, tin, { origin: null, destination: null }).map((c) => c.field), ["pickup_place"]);
  ok("tour spec for re-pricing", be.specForBooking(tour, tin, null, null)?.kind === "day_tour");

  // Reminders go out again only when the new pickup is more than 28 h away.
  const NOW = Date.parse("2099-06-10T12:00:00Z");
  eq("moved far ahead: reminders reset", be.scheduleResets(changes, "2099-06-15T23:00:00-06:00", NOW), { late_alert_at: null, reminder_traveller_at: null, reminder_driver_at: null });
  eq("moved to within 28 h: reminders not sent twice", be.scheduleResets(changes, "2099-06-11T08:00:00-06:00", NOW), { late_alert_at: null });
  eq("time unchanged: nothing reset", be.scheduleResets(changes.filter((c) => c.field !== "scheduled_at"), "2099-06-15T23:00:00-06:00", NOW), {});

  // Messages: once each; the driver's never hold the traveller's contact or price.
  const ctx = {
    bookingId: "b1", ref: "CRPT-1", serviceType: "transfer", tourName: null,
    origin: booking.origin, destination: "Hotel B, Manuel Antonio", scheduledAt: "2099-06-15T23:00:00-06:00", changes,
    price: { before: 200, after: 230 }, payout: { before: 160, after: 184 },
    driver: { id: "d1", fullName: "Carlos Mora", email: "carlos@example.com", appLang: null },
    guest: { name: "Ana Smith", email: "ana@example.com", accessToken: "tok", language: "en" },
    siteUrl: "https://example.com",
  };
  const msgs = be.bookingEditMessages(ctx);
  eq("one traveller email, one driver push, one driver email", msgs.map((x) => x.kind), ["traveller_email", "driver_push", "driver_email"]);
  eq("nothing when nothing changed", be.bookingEditMessages({ ...ctx, changes: [] }).length, 0);
  eq("no driver assigned: only the traveller", be.bookingEditMessages({ ...ctx, driver: null }).map((x) => x.kind), ["traveller_email"]);
  const tr = msgs[0].email;
  ok("traveller email in English with the new price and trip link", tr.lang === "en" && tr.lines.some((l) => l.includes("$230.00")) && tr.button?.url.endsWith("/trip/tok"));
  ok("traveller email never names the driver's payout", !JSON.stringify(tr).includes("184"));
  const trEs = be.bookingEditMessages({ ...ctx, guest: { ...ctx.guest, language: "es" } })[0].email;
  ok("traveller email in Spanish (usted) when they booked in Spanish", trEs.lang === "es" && trEs.subject.startsWith("Actualizamos su reserva") && trEs.lines.some((l) => l.startsWith("Destino")));
  const driverText = JSON.stringify(msgs.slice(1));
  ok("driver messages in Spanish by default", msgs[2].email.lang === "es" && msgs[1].message.title.startsWith("Cambio en el viaje"));
  ok("driver messages never hold the traveller's name, email or price", !/Ana|ana@example\.com|\$230|\$200\b/.test(driverText));
  ok("driver email shows their new payout", msgs[2].email.lines.some((l) => l.includes("$184.00")));
  ok("driver in English when their app is in English", be.bookingEditMessages({ ...ctx, driver: { ...ctx.driver, appLang: "en" } })[2].email.subject.startsWith("Ride CRPT-1 changed"));
  ok("no message names the owner or the other brands", !/Travel Planner|Familia M[aá]gica|Jorge/i.test(JSON.stringify(msgs)));

  // The server actions: admin-only, refused on cancelled / completed, sent once, price only when chosen.
  const src = readFileSync(new URL("../src/app/admin/bookings/editActions.ts", import.meta.url), "utf8");
  const fnBody = (name) => {
    const start = src.indexOf(`export async function ${name}`);
    return src.slice(start, src.indexOf("\n}\n", start));
  };
  for (const fn of ["previewBookingEdit", "saveBookingEdit"]) {
    const body = fnBody(fn);
    const role = body.indexOf('await requireRole("admin"');
    ok(`${fn} checks the admin role before anything else`, role > 0 && role < body.indexOf("load(") && role < body.indexOf("getTeamLang"));
  }
  ok("save refuses cancelled / completed in the update itself", src.includes('.not("status", "in", "(completed,cancelled)")'));
  ok("save touches money only when the team chose the new price", src.includes("...(money ? moneyPatch(before, money) : {})") && src.includes('opts?.priceChoice === "new"'));
  eq("save sends the notices once (one after())", (fnBody("saveBookingEdit").match(/after\(/g) ?? []).length, 1);
  ok("the edit card is shown only when the booking can be edited", readFileSync(new URL("../src/app/admin/bookings/[id]/page.tsx", import.meta.url), "utf8").includes("canEditPlaces(b.status) && (b.service_type"));
}

console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
