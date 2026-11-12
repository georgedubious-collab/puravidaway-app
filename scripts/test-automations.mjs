/**
 * Cases for the three automatic messages (docs/PROJECT.md §4.7): the day-before reminder
 * (traveller + driver), the low-rating alert to the team and the "book your return / a day
 * tour" email with its unsubscribe link. Rules: src/lib/automationRules.ts; messages:
 * src/lib/travellerMessages.ts and src/lib/automationMessages.ts; link: src/lib/unsubscribeToken.ts.
 * The database side (columns set once, RLS on email_optouts) is in supabase/tests/rls.test.mjs.
 *
 *   npm run test:automations      (Node 22.6+; Node runs the TypeScript directly)
 *   RENDER_DIR=/some/folder npm run test:automations   also writes every new email as HTML there
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { join } from "node:path";

// The app's files import each other without ".ts"; add it for Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const r = await import("../src/lib/automationRules.ts");
const tm = await import("../src/lib/travellerMessages.ts");
const am = await import("../src/lib/automationMessages.ts");
const tok = await import("../src/lib/unsubscribeToken.ts");
const html = await import("../src/lib/emailHtml.ts");
const { DAY_TOURS } = await import("../src/lib/catalog.ts");

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};

const H = 3600 * 1000;
/** A moment in Costa Rica time (UTC−6): cr("2026-11-20", 12) = noon on 20 November. */
const cr = (ymd, hour, min = 0) => new Date(Date.parse(`${ymd}T00:00:00Z`) + (hour + 6) * H + min * 60000);
const iso = (d) => d.toISOString();
const plus = (d, hours) => new Date(d.getTime() + hours * H);
const NOON = cr("2026-11-20", 12);

// --- 1. Day-before reminder: the window ---------------------------------------------------------
const due = (now, pickupHours, confirmed = null) => r.dayBeforeReminderDue(now, iso(plus(now, pickupHours)), confirmed);
check("pickup 19 h away: no", due(NOON, 19), false);
check("pickup 19 h 59 min away: no", due(NOON, 19 + 59 / 60), false);
check("pickup exactly 20 h away: yes", due(NOON, 20), true);
check("pickup 24 h away: yes", due(NOON, 24), true);
check("pickup exactly 28 h away: yes", due(NOON, 28), true);
check("pickup 28 h 1 min away: no", due(NOON, 28 + 1 / 60), false);
check("pickup 29 h away: no", due(NOON, 29), false);
check("pickup already passed: no", due(NOON, -1), false);
check("no pickup time: no", r.dayBeforeReminderDue(NOON, null, null), false);

// Quiet hours: 9 PM to 7 AM Costa Rica time.
check("10 PM, pickup 24 h away: waits (quiet hours)", due(cr("2026-11-20", 22), 24), false);
check("6:59 AM, pickup 24 h away: waits", due(cr("2026-11-20", 6, 59), 24), false);
check("7:00 AM, pickup 24 h away: yes", due(cr("2026-11-20", 7), 24), true);
check("8:59 PM, pickup 24 h away: yes", due(cr("2026-11-20", 20, 59), 24), true);
check("9:00 PM, pickup 24 h away: waits", due(cr("2026-11-20", 21), 24), false);
// The window opens at night and the morning comes after the 20-hour mark: sent at 7 AM.
{
  const pickup = iso(cr("2026-11-22", 2)); // 2 AM on the 22nd: window 10 PM on the 20th → 6 AM on the 21st, all night.
  check("night-only window: nothing at 11 PM", r.dayBeforeReminderDue(cr("2026-11-20", 23), pickup, null), false);
  check("night-only window: nothing at 6:59 AM", r.dayBeforeReminderDue(cr("2026-11-21", 6, 59), pickup, null), false);
  check("night-only window: sent at 7 AM (19 h before the pickup)", r.dayBeforeReminderDue(cr("2026-11-21", 7), pickup, null), true);
  check("night-only window: still due at 7:07 AM (the hourly check)", r.dayBeforeReminderDue(cr("2026-11-21", 7, 7), pickup, null), true);
  check("night-only window: confirmed 19 h 30 min before the pickup → none", r.dayBeforeReminderDue(cr("2026-11-21", 7, 7), pickup, iso(cr("2026-11-21", 6, 30))), false);
  check("night-only window: confirmed 21 h before → sent", r.dayBeforeReminderDue(cr("2026-11-21", 7, 7), pickup, iso(cr("2026-11-21", 5))), true);
}
{
  // Window opening at 8 PM (pickup at midnight two days later): sent at once, before quiet hours.
  const pickup = iso(cr("2026-11-22", 0));
  check("window opening at 8 PM: sent at 8:07 PM", r.dayBeforeReminderDue(cr("2026-11-20", 20, 7), pickup, null), true);
  // A normal window that was missed (job down) is not sent after the 20-hour mark.
  check("normal window missed: not sent 19 h before", r.dayBeforeReminderDue(cr("2026-11-21", 5), iso(cr("2026-11-22", 0)), null), false);
}
check("next 7 AM after 11 PM", iso(r.nextSendable(cr("2026-11-20", 23))), iso(cr("2026-11-21", 7)));
check("next 7 AM after 3 AM", iso(r.nextSendable(cr("2026-11-21", 3))), iso(cr("2026-11-21", 7)));
check("daytime stays as is", iso(r.nextSendable(NOON)), iso(NOON));

// Confirmed less than 20 hours before the pickup: none (the confirmation was just sent).
check("confirmed 25 h before, pickup 24 h away: yes", due(NOON, 24, iso(plus(NOON, -1))), true);
check("confirmed 19 h before the pickup: none", r.dayBeforeReminderDue(NOON, iso(plus(NOON, 20)), iso(plus(NOON, 1))), false);
check("old bookings without confirmed_at: yes", due(NOON, 22, null), true);

// Once only, separately for the traveller and the driver.
{
  const b = (id, o = {}) => ({
    id, status: "confirmed", scheduled_at: iso(plus(NOON, 24)), confirmed_at: null, assigned_driver_id: "d1",
    reminder_traveller_at: null, reminder_driver_at: null, ...o,
  });
  check("both due", r.planDayBeforeReminders(NOON, [b("a")]), { traveller: ["a"], driver: ["a"] });
  check("traveller already reminded: driver only", r.planDayBeforeReminders(NOON, [b("a", { reminder_traveller_at: iso(NOON) })]), { traveller: [], driver: ["a"] });
  check("driver already reminded: traveller only", r.planDayBeforeReminders(NOON, [b("a", { reminder_driver_at: iso(NOON) })]), { traveller: ["a"], driver: [] });
  check("both reminded: nothing", r.planDayBeforeReminders(NOON, [b("a", { reminder_traveller_at: iso(NOON), reminder_driver_at: iso(NOON) })]), { traveller: [], driver: [] });
  check("not confirmed: nothing", r.planDayBeforeReminders(NOON, [b("a", { status: "pending_bids" })]), { traveller: [], driver: [] });
  check("no driver: nothing", r.planDayBeforeReminders(NOON, [b("a", { assigned_driver_id: null })]), { traveller: [], driver: [] });
}

// --- The driver's reminder: never the traveller's contact details, name or price ---------------
const SJO = { place_id: "hub:SJO", town: "SJO", lat: 9.99, lng: -84.2 };
const MA = { place_id: "hub:ManuelAntonio", town: "ManuelAntonio", lat: 9.39, lng: -84.14 };
const ARENAS = { place_id: "ChIJJ9uN0123456789abcd", town: "ManuelAntonio", lat: 9.398381, lng: -84.160801 };
const booking = {
  id: "11111111-2222-3333-4444-555555555555",
  booking_ref: "CRPT-10492",
  service_type: "transfer",
  origin: "SJO Airport / San José",
  destination: "Arenas Del Mar Beachfront & Rainforest Resort, Manuel Antonio, Quepos",
  origin_coords: SJO,
  destination_coords: ARENAS,
  scheduled_at: iso(cr("2026-11-22", 14, 30)),
  passenger_count: 4,
  luggage_count: 3,
  carry_on_count: 2,
  flight_or_hotel_notes: "Flight AA 1234 lands 2:05 PM",
  driver_notes: "Two kids, one is 4 years old",
  preferences: { language: "english", wifi: false, stroller: true, childSeats: 1, pets: false },
  vehicle_class: "suv",
  payment_mode: "cash_driver",
  total_price: 185,
  cash_fee: 18.5,
  amount_paid: 0,
  sign_text: null,
  sign_hide_name: false,
};
const GUEST = { name: "Emily Rose Smith", email: "emily.smith@example.com", phone: "+506 8888 7777" };
const rendered = [];
for (const lang of ["es", "en"]) {
  const d = am.driverReminderFor(lang, booking, { guestName: GUEST.name, driverFullName: "Carlos Mora Jiménez", tourName: null, siteUrl: "https://www.example.com" });
  const email = am.driverReminderEmail(lang, d);
  const push = am.driverReminderPush(lang, d);
  const all = JSON.stringify([email, push]);
  check(`driver (${lang}): no traveller email`, all.includes(GUEST.email) || /@/.test(all), false);
  check(`driver (${lang}): no traveller phone`, all.includes("8888") || all.includes("7777") || all.includes("+506"), false);
  check(`driver (${lang}): no full name, only the sign's short name`, [all.includes("Rose"), all.includes("Smith"), all.includes("Emily S.")], [false, false, true]);
  check(`driver (${lang}): no price, fee or amount`, ["185", "203", "18.5", "$"].some((p) => all.includes(p)), false);
  check(`driver (${lang}): has the sign, flight, bags, extras and cash flag`,
    [all.includes("“Emily S.”"), all.includes("AA 1234"), /3 (large|grandes) \+ 2/.test(all), /child seat|niños/.test(all), /(Collect cash|Cobrar en efectivo)/.test(all)], [true, true, true, true, true]);
  check(`driver (${lang}): airport pickup`, /(arrivals|llegadas)/.test(all), true);
  check(`driver (${lang}): links to the driver's own trip page`, email.button.url, "https://www.example.com/driver/trips/11111111-2222-3333-4444-555555555555");
  rendered.push([`driver-reminder-${lang}`, { to: "driver@example.com", ...email }]);
}
check("driver Spanish by default wording", am.driverReminderEmail("es", am.driverReminderFor("es", booking, { guestName: GUEST.name, driverFullName: "Carlos", tourName: null, siteUrl: "" })).subject.startsWith("Recordatorio: viaje CRPT-10492"), true);
{
  // Ferry and boat flags, same rules as the driver app.
  const f = (o, d, extra = {}) => r.driverTripFacts({ ...booking, origin: "x", destination: "y", flight_or_hotel_notes: null, origin_coords: { town: o }, destination_coords: { town: d }, owed: 0, payment_mode: "online", ...extra });
  check("ferry: SJO → Southern Nicoya", f("SJO", "SouthNicoya").ferry, true);
  check("no ferry: Tamarindo → Southern Nicoya (by road)", f("Tamarindo", "SouthNicoya").ferry, false);
  check("boat: to Drake Bay", f("SJO", "DrakeBay").boat, true);
  check("no cash flag when paid online", f("SJO", "Arenal").cash, false);
  check("cash flag when the driver collects", f("SJO", "Arenal", { payment_mode: "cash_driver", owed: 50 }).cash, true);
}

// --- The traveller's reminder ---------------------------------------------------------------
for (const lang of ["en", "es"]) {
  const a = {
    guestName: GUEST.name, driver: "Carlos", ref: "CRPT-10492", ride: true, origin: lang === "es" ? "Aeropuerto SJO / San José" : "SJO Airport / San José",
    destination: "Manuel Antonio", when: lang === "es" ? "22 de noviembre de 2026 · 2:30 p. m." : "2026-11-22 · 2:30 PM",
    car: { name: "Toyota Fortuner 2022", color: lang === "es" ? "blanco" : "white", plate: "BCD123" }, sign: "Emily S.", airport: true,
    tripUrl: "https://www.example.com/trip/abc",
  };
  const e = tm.dayBeforeEmail(lang, a);
  const all = JSON.stringify([e, tm.dayBeforePush(lang, a)]);
  check(`traveller (${lang}): driver first name, car, plate, sign, airport promise`,
    [all.includes("Carlos"), all.includes("Toyota Fortuner 2022"), all.includes("BCD123"), all.includes("“Emily S.”"), /(arrivals|llegadas)/.test(all), /60/.test(all)], [true, true, true, true, true, true]);
  check(`traveller (${lang}): call our team / chat`, /(Call our team|Llamar a nuestro equipo)/.test(all), true);
  check(`traveller (${lang}): no 24/7, no owner brand`, /24\/7|Travel Planner|Familia/.test(all), false);
  rendered.push([`traveller-reminder-airport-${lang}`, { to: GUEST.email, ...e }]);
  const tour = tm.dayBeforeEmail(lang, { ...a, ride: false, origin: "Arenal Volcano 1968 Lava Trails", destination: "", sign: null, airport: false, car: null });
  check(`tour reminder (${lang}): no sign, no airport promise`, /rótulo|name sign|arrivals|llegadas/.test(JSON.stringify(tour)), false);
  rendered.push([`traveller-reminder-tour-${lang}`, { to: GUEST.email, ...tour }]);
}
check("Spanish reminder uses usted", /\busted\b|\bsu conductor\b|Su conductor/.test(JSON.stringify(tm.dayBeforeEmail("es", { guestName: "Ana", driver: "Carlos", ref: "X", ride: true, origin: "A", destination: "B", when: "w", car: null, sign: "Ana", airport: false, tripUrl: "u" }))), true);

// --- 2. Low-rating alert -----------------------------------------------------------------------
check("1, 2, 3 stars alert the team", [1, 2, 3].map(r.isLowRating), [true, true, true]);
check("4 and 5 stars don't", [4, 5].map(r.isLowRating), [false, false]);
check("nonsense never alerts", [0, 6, 2.5, NaN].map(r.isLowRating), [false, false, false, false]);
{
  const e = am.lowRatingTeamEmail({ ref: "CRPT-10492", route: "SJO Airport / San José → Manuel Antonio", when: "2026-11-22 · 2:30 PM", driverName: "Carlos Mora", stars: 2, comment: "Late and rude.", adminUrl: "https://www.example.com/admin/bookings/1111" });
  check("team alert: subject", e.subject, "Low rating: 2★ for Carlos Mora (CRPT-10492)");
  check("team alert: stars, comment, link", [e.lines.some((l) => l.includes("★★☆☆☆ (2/5)")), e.lines.some((l) => l.includes("Late and rude.")), e.button.url.endsWith("/admin/bookings/1111")], [true, true, true]);
  rendered.push(["team-low-rating-en", { to: "team@example.com", ...e }]);
}

// --- 3. Follow-up: timing ------------------------------------------------------------------------
{
  const done = iso(cr("2026-11-20", 15)); // completed 3 PM on the 20th
  check("same day: no (the rating request went out today)", r.followupDue(cr("2026-11-20", 20), done), false);
  check("next day 6:59 AM: no (quiet hours)", r.followupDue(cr("2026-11-21", 6, 59), done), false);
  check("next day 7:00 AM: yes", r.followupDue(cr("2026-11-21", 7), done), true);
  check("next day 8:59 PM: yes", r.followupDue(cr("2026-11-21", 20, 59), done), true);
  check("next day 9 PM: no (quiet hours)", r.followupDue(cr("2026-11-21", 21), done), false);
  check("two days later: still yes (job was down)", r.followupDue(cr("2026-11-22", 9), done), true);
  check("three days later: no, expired", [r.followupDue(cr("2026-11-23", 9), done), r.followupExpired(cr("2026-11-23", 9), done)], [false, true]);
  check("completed 11:30 PM: next morning is the next day", r.followupDue(cr("2026-11-21", 7, 7), iso(cr("2026-11-20", 23, 30))), true);
  check("completed 00:30 AM: not that same morning", r.followupDue(cr("2026-11-21", 7, 7), iso(cr("2026-11-21", 0, 30))), false);
}

// --- Follow-up: skip rules -------------------------------------------------------------------
{
  const ride = { id: "b1", service_type: "transfer", scheduled_at: iso(cr("2026-11-20", 9)), origin: { text: "SJO Airport / San José", coords: SJO }, destination: { text: "Arenas Del Mar…", coords: ARENAS } };
  const base = { email: "a@example.com", optedOut: false, others: [], stars: null };
  check("normal ride: sent", r.followupSkipReason(ride, base), null);
  check("day tour: skipped", r.followupSkipReason({ ...ride, service_type: "day_tour" }, base), "not_a_ride");
  check("drop-off at the airport: skipped", r.followupSkipReason({ ...ride, origin: ride.destination, destination: ride.origin }, base), "airport_dropoff");
  check("drop-off at LIR (typed place naming the airport): skipped",
    r.followupSkipReason({ ...ride, destination: { text: "Daniel Oduber Quirós International Airport (LIR)", coords: { place_id: "ChIJxyz0123456789LIR", town: "LIR", lat: 10.59, lng: -85.54 } } }, base), "airport_dropoff");
  check("hotel near LIR but not the airport: not skipped",
    r.followupSkipReason({ ...ride, destination: { text: "Hilton Garden Inn Liberia", coords: { place_id: "ChIJxyz0123456789HGI", town: "LIR", lat: 10.6, lng: -85.53 } } }, base), null);
  check("opted out: skipped", r.followupSkipReason(ride, { ...base, optedOut: true }), "opted_out");
  check("no email: skipped", r.followupSkipReason(ride, { ...base, email: null }), "no_email");
  check("rated 2 stars: skipped", r.followupSkipReason(ride, { ...base, stars: 2 }), "low_rating");
  check("rated 5 stars: sent", r.followupSkipReason(ride, { ...base, stars: 5 }), null);
  const back = { id: "b2", status: "confirmed", service_type: "transfer", scheduled_at: iso(cr("2026-11-27", 10)), origin: { text: "Manuel Antonio", coords: MA }, destination: { text: "SJO Airport / San José", coords: SJO } };
  check("return already booked: skipped", r.followupSkipReason(ride, { ...base, others: [back] }), "return_booked");
  check("return booked but cancelled: sent", r.followupSkipReason(ride, { ...base, others: [{ ...back, status: "cancelled" }] }), null);
  check("reversed ride earlier than this one doesn't count", r.followupSkipReason(ride, { ...base, others: [{ ...back, scheduled_at: iso(cr("2026-11-18", 10)) }] }), null);
  check("a later ride elsewhere doesn't count", r.followupSkipReason(ride, { ...base, others: [{ ...back, destination: { text: "La Fortuna / Arenal", coords: { place_id: "hub:Arenal", town: "Arenal" } } }] }), null);
  check("a day tour later doesn't count", r.followupSkipReason(ride, { ...base, others: [{ ...back, service_type: "day_tour" }] }), null);

  // The way back: from ↔ to swapped, as a shareable ride-builder link.
  check("return link: typed hotel → our airport town", r.returnRideHref(ride.origin, ride.destination),
    "/?from=ChIJJ9uN0123456789abcd&fromName=Arenas+Del+Mar%E2%80%A6&fromAt=9.39838%2C-84.16080&to=SJO");
  check("return link between two towns, Spanish", r.returnRideHref({ text: "x", coords: { place_id: "hub:Arenal", town: "Arenal" } }, { text: "y", coords: MA }, "/es"), "/es?from=ManuelAntonio&to=Arenal");
  check("return link for an older booking (text only)", r.returnRideHref({ text: "SJO Airport / San José", coords: null }, { text: "Manuel Antonio", coords: null }), "/?from=ManuelAntonio&to=SJO");
  check("no usable places: no link", r.returnRideHref({ text: "somewhere", coords: null }, { text: "else", coords: null }), null);

  // Up to two tours where the ride ended, none where there are none.
  check("tours near Manuel Antonio: up to two, from that region", r.toursNear(ride.destination, DAY_TOURS).map((t) => t.region), DAY_TOURS.filter((t) => t.region === "ManuelAntonio").slice(0, 2).map(() => "ManuelAntonio"));
  check("no tours near Tamarindo", r.toursNear({ text: "Tamarindo / Guanacaste", coords: { place_id: "hub:Tamarindo", town: "Tamarindo" } }, DAY_TOURS), []);
}

// --- Follow-up email --------------------------------------------------------------------------
for (const lang of ["en", "es"]) {
  const e = tm.followupEmail(lang, {
    guestName: GUEST.name,
    origin: lang === "es" ? "Aeropuerto SJO / San José" : "SJO Airport / San José",
    destination: "Manuel Antonio",
    returnUrl: "https://www.example.com" + r.returnRideHref({ text: "SJO", coords: SJO }, { text: "MA", coords: MA }, lang === "es" ? "/es" : "/"),
    region: lang === "es" ? "Manuel Antonio / Pacífico Central" : "Manuel Antonio / Central Pacific",
    tours: [
      { name: "Manuel Antonio National Park guided walk", fromPrice: "$95", url: "https://www.example.com/?tab=tours" },
      { name: "Damas Island mangrove boat tour", fromPrice: "$120", url: "https://www.example.com/?tab=tours" },
    ],
  });
  const u = tm.followupUnsubscribeText(lang);
  const full = { to: GUEST.email, ...e, unsubscribe: { ...u, pageUrl: "https://www.example.com/unsubscribe?t=TOKEN", oneClickUrl: "https://www.example.com/api/unsubscribe?t=TOKEN" } };
  check(`follow-up (${lang}): return link swaps the route`, e.button.url.endsWith(lang === "es" ? "/es?from=ManuelAntonio&to=SJO" : "/?from=ManuelAntonio&to=SJO"), true);
  check(`follow-up (${lang}): two tours with their price`, e.links.map((l) => /\$\d+/.test(l.label)), [true, true]);
  check(`follow-up (${lang}): unsubscribe link and one-click headers`, [html.emailHtml(full).includes("/unsubscribe?t=TOKEN"), html.emailText(full).includes("/unsubscribe?t=TOKEN"), html.emailHeaders(full)],
    [true, true, { "List-Unsubscribe": "<https://www.example.com/api/unsubscribe?t=TOKEN>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }]);
  check(`follow-up (${lang}): no 24/7, no owner brand`, /24\/7|Travel Planner|Familia/.test(JSON.stringify(full)), false);
  rendered.push([`traveller-followup-${lang}`, full]);
  const noTours = tm.followupEmail(lang, { guestName: "Ana", origin: "SJO", destination: "Tamarindo", returnUrl: "u", region: null, tours: [] });
  check(`follow-up without tours (${lang}): no tour line`, [noTours.lines.length, noTours.links.length], [2, 0]);
}
check("booking emails have no unsubscribe headers", html.emailHeaders({ to: "a@b.c", subject: "s", lines: [] }), undefined);

// --- Unsubscribe token --------------------------------------------------------------------------
{
  const SECRET = "test-secret-0123456789-abcdef";
  const t = tok.makeUnsubscribeToken("Emily.Smith@Example.com ", SECRET);
  check("valid token gives the (lower-case) address", tok.readUnsubscribeToken(t, SECRET), "emily.smith@example.com");
  check("wrong secret: invalid", tok.readUnsubscribeToken(t, SECRET + "x"), null);
  const [body, sig] = t.split(".");
  const other = Buffer.from("someone.else@example.com").toString("base64url");
  check("tampered address: invalid", tok.readUnsubscribeToken(`${other}.${sig}`, SECRET), null);
  const flipped = sig.slice(0, -2) + (sig.at(-2) === "A" ? "B" : "A") + sig.at(-1);
  check("tampered signature: invalid", tok.readUnsubscribeToken(`${body}.${flipped}`, SECRET), null);
  check("garbage: invalid", ["", "abc", "a.b", null, 42, `${body}.`, `${body}.${sig}.x`].map((x) => tok.readUnsubscribeToken(x, SECRET)), [null, null, null, null, null, null, null]);
  check("no secret: never valid", tok.readUnsubscribeToken(t, ""), null);
  let threw = false;
  try { tok.makeUnsubscribeToken("a@b.c", "short"); } catch { threw = true; }
  check("a short secret refuses to make links", threw, true);
}

// --- Write the new emails out to look at them --------------------------------------------------
if (process.env.RENDER_DIR) {
  mkdirSync(process.env.RENDER_DIR, { recursive: true });
  for (const [name, e] of rendered) {
    writeFileSync(join(process.env.RENDER_DIR, `${name}.html`), `<!doctype html><meta charset="utf-8"><title>${e.subject}</title>
<p style="font:13px monospace;color:#555;max-width:560px;margin:12px auto">To: ${e.to}<br>Subject: ${e.subject}</p>${html.emailHtml(e)}`);
  }
  console.log(`Wrote ${rendered.length} emails to ${process.env.RENDER_DIR}`);
}

console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
