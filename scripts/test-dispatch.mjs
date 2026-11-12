/**
 * Cases for the dispatch calendar (src/lib/dispatch.ts): how long a booking keeps a driver busy,
 * and when giving a driver one more booking clashes with what they already have.
 *
 *   npm run test:dispatch        (Node 22.15+; Node runs the TypeScript directly)
 *
 * The page itself is checked for the one rule that matters most: it assigns through the booking
 * page's own server actions (updateBooking / acceptOffer), so the change history and the
 * notifications are the same. `npm run test:db` checks that both paths write the same history.
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

const d = await import("../src/lib/dispatch.ts");
const { routeMinutes, SIGHTSEEING_STOPS } = await import("../src/lib/catalog.ts");
const { BUILT_IN_CATALOG } = await import("../src/lib/catalogModel.ts");

let passed = 0;
const failures = [];
const eq = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) passed++;
  else failures.push(`${name}: expected ${w}, got ${g}`);
};

const CAT = { stops: BUILT_IN_CATALOG.stops, dayTours: BUILT_IN_CATALOG.dayTours };
const at = (hhmm, day = "2026-11-20") => `${day}T${hhmm}:00-06:00`;
let n = 0;
/** A ride between two of our towns (hub names as stored for town-to-town bookings). */
const ride = (from, to, hhmm, extra = {}) => ({
  id: `b${++n}`,
  booking_ref: `CRPT-${1000 + n}`,
  status: "confirmed",
  service_type: "transfer",
  scheduled_at: at(hhmm, extra.day),
  origin_coords: { town: from },
  destination_coords: { town: to },
  origin: null,
  destination: null,
  sightseeing_stops: [],
  ...extra,
});
const kinds = (target, others) => d.findClashes(target, others, CAT).map((c) => c.kind);

// --- Constants --------------------------------------------------------------------------------
eq("buffer is 30 minutes", d.CLASH_BUFFER_MINUTES, 30);
eq("longest drive between our towns (Drake Bay ↔ Puerto Viejo)", d.LONGEST_ROUTE_MINUTES, 555);
eq("unknown places are only checked inside longest drive + buffer", d.CHECK_TRAVEL_WINDOW_MINUTES, 585);

// --- Busy span --------------------------------------------------------------------------------
const stop = SIGHTSEEING_STOPS[0];
{
  const s = d.busySpan(ride("SJO", "Arenal", "08:00", { drive_minutes: 180, sightseeing_stops: [{ id: stop.id }] }), CAT);
  eq("saved drive time + stop time + detour", s.minutes, 180 + stop.durationMin + stop.detourMin);
  eq("…not estimated", s.estimated, false);
  eq("…towns", [s.from, s.to], ["SJO", "Arenal"]);
}
eq("no saved drive time: the catalog's town-to-town minutes", d.busySpan(ride("SJO", "Arenal", "08:00"), CAT).minutes, routeMinutes("SJO", "Arenal"));
eq("Drake Bay includes the Sierpe boat (catalog)", d.busySpan(ride("SJO", "DrakeBay", "05:00"), CAT).minutes, 330);
eq("an old booking with the town's name only", d.busySpan({ ...ride(null, null, "08:00"), origin_coords: null, destination_coords: null, origin: "SJO Airport / San José", destination: "Manuel Antonio" }, CAT).minutes, 175);
{
  const typed = { ...ride(null, null, "08:00"), origin: "Hotel Nowhere, Somewhere", destination: "Casa Azul, Elsewhere", origin_coords: { lat: 9.9, lng: -84 }, destination_coords: { lat: 10, lng: -85 } };
  const s = d.busySpan(typed, CAT);
  eq("typed places, no drive time anywhere: default, marked estimated", [s.minutes, s.estimated], [d.UNKNOWN_DRIVE_MINUTES, true]);
  eq("…and no towns", [s.from, s.to], [null, null]);
  eq("typed places with the saved road route", d.busySpan({ ...typed, origin_coords: { route: { totalMinutes: 212 } } }, CAT).minutes, 212);
}
eq("a stop no longer in the catalog counts 45 min", d.busySpan(ride("SJO", "Arenal", "08:00", { drive_minutes: 100, sightseeing_stops: [{ id: "gone" }] }), CAT).minutes, 145);
{
  const tour = { id: "t1", booking_ref: "CRPT-T1", status: "confirmed", service_type: "day_tour", catalog_item_id: "dt1", scheduled_at: at("07:00"), sightseeing_stops: [] };
  const s = d.busySpan(tour, CAT);
  eq("day tour: the catalog length (8 h)", s.minutes, 480);
  eq("…starts and ends in its region's town", [s.from, s.to], ["Arenal", "Arenal"]);
  eq("Smart En-Route tour ends somewhere we don't know", d.busySpan({ ...tour, sightseeing_stops: [{ id: "en_route_upgrade" }] }, CAT).to, null);
  eq("unknown tour: a full day, estimated", [d.busySpan({ ...tour, catalog_item_id: "x" }, CAT).minutes, d.busySpan({ ...tour, catalog_item_id: "x" }, CAT).estimated], [480, true]);
}
eq("no pickup time: no span", d.busySpan({ ...ride("SJO", "LIR", "08:00"), scheduled_at: null }, CAT), null);
eq("span label in Costa Rica time", d.spanLabel(d.busySpan(ride("SJO", "Arenal", "08:00"), CAT)), "08:00–10:45");
{
  const late = d.busySpan(ride("LIR", "Tamarindo", "23:30"), CAT); // 90 min → 01:00 next day
  eq("late ride ends the next day", d.spanDays(late), ["2026-11-20", "2026-11-21"]);
  eq("…label says so", d.spanLabel(late, "es"), "23:30–01:00 (+1 día)");
}

// --- Clashes ----------------------------------------------------------------------------------
// A: SJO 08:00 → La Fortuna (165 min) = free at 10:45 in La Fortuna.
const A = ride("SJO", "Arenal", "08:00");
eq("overlap", kinds(ride("Arenal", "Monteverde", "10:00"), [A]), ["overlap"]);
eq("overlap: a later booking that starts inside", kinds(A, [ride("SJO", "Tamarindo", "09:00")]), ["overlap"]);
eq("back-to-back in the same town with exactly the buffer: fine", kinds(ride("Arenal", "Monteverde", "11:15"), [A]), []);
eq("…one minute less: too tight", kinds({ ...ride("Arenal", "Monteverde", "11:15"), scheduled_at: "2026-11-20T11:14:00-06:00" }, [A]), ["too_tight"]);
{
  // La Fortuna → Monteverde is 210 min + 30 buffer = 240 after 10:45 → 14:45.
  eq("other town, enough travel time + buffer: fine", kinds(ride("Monteverde", "SJO", "14:45"), [A]), []);
  const c = d.findClashes(ride("Monteverde", "SJO", "14:00"), [A], CAT);
  eq("other town, not enough travel time: too tight", c.map((x) => [x.kind, x.side, x.gapMinutes, x.neededMinutes]), [["too_tight", "before", 195, 240]]);
  eq("…readable in Spanish", d.clashText(c[0], "es"), `Muy justo después de ${A.booking_ref}: 3 h 15 min libres, necesita 4 h (manejo + 30 min)`);
}
eq("the next booking is too close after this one", kinds(A, [ride("Tamarindo", "LIR", "12:00")]), ["too_tight"]);
{
  const typedPickup = { ...ride(null, "SJO", "13:00"), origin: "Villa Privada, Nuevo Arenal", origin_coords: { lat: 10.5, lng: -84.9 } };
  eq("unknown pickup place after a drop-off: check the travel time", kinds(typedPickup, [A]), ["check_travel"]);
  eq("…but not with more free time than the longest drive + buffer", kinds({ ...typedPickup, scheduled_at: at("20:31") }, [A]), []);
  eq("…in Spanish", d.clashText(d.findClashes(typedPickup, [A], CAT)[0], "es").startsWith("Revise el tiempo de traslado desde"), true);
}
eq("cancelled booking ignored", kinds(ride("Arenal", "Monteverde", "10:00"), [{ ...A, status: "cancelled" }]), []);
eq("a cancelled target clashes with nothing", kinds({ ...ride("Arenal", "Monteverde", "10:00"), status: "cancelled" }, [A]), []);
eq("the booking itself is skipped", kinds(A, [A]), []);
eq("other days don't clash", kinds(ride("Monteverde", "SJO", "08:00", { day: "2026-11-21" }), [A]), []);
{
  // Only the nearest booking before is checked for travel: an earlier far-away drop-off with a
  // booking in between doesn't count twice.
  const early = ride("SJO", "Tamarindo", "03:00"); // free 07:50 in Tamarindo
  const mid = ride("Tamarindo", "Arenal", "08:30"); // 240 → free 12:30 in La Fortuna
  eq("only the neighbours are checked for travel time", kinds(ride("Arenal", "SJO", "13:00"), [early, mid]), []);
}

// --- Warnings for one driver + vehicle --------------------------------------------------------
const base = { booking: ride("Arenal", "Monteverde", "10:00"), driverBookings: [A], blockedDays: new Set(), categoryOk: true, seatsOk: true, documentsOk: true, onHold: false };
eq("clash shown as a warning", d.candidateWarnings(base, CAT).map((w) => w.code), ["overlap"]);
eq("blocked day", d.candidateWarnings({ ...base, driverBookings: [], blockedDays: new Set(["2026-11-20"]) }, CAT).map((w) => w.code), ["blocked_day"]);
eq("blocked next day only counts when the ride runs past midnight",
  [
    d.candidateWarnings({ ...base, booking: ride("LIR", "Tamarindo", "23:30"), driverBookings: [], blockedDays: new Set(["2026-11-21"]) }, CAT).map((w) => w.code),
    d.candidateWarnings({ ...base, booking: ride("LIR", "Tamarindo", "20:00"), driverBookings: [], blockedDays: new Set(["2026-11-21"]) }, CAT).map((w) => w.code),
  ],
  [["blocked_day"], []]);
eq("category, seats, documents, hold, request",
  d.candidateWarnings({ ...base, driverBookings: [], categoryOk: false, seatsOk: false, documentsOk: false, onHold: true, preferences: ["sin Wi-Fi"] }, CAT).map((w) => w.code),
  ["category", "seats", "documents", "review_hold", "preference"]);
eq("all clear", d.candidateWarnings({ ...base, driverBookings: [] }, CAT), []);
eq("English text", d.candidateWarnings({ ...base, driverBookings: [], blockedDays: new Set(["2026-11-20"]) }, CAT, "en")[0].text, "Blocked that day as unavailable");

// --- Short place names --------------------------------------------------------------------------
eq("town short name", d.shortPlace("La Fortuna / Arenal", null), "La Fortuna");
eq("typed place mapped to a town", d.shortPlace("Hotel Tabacón, La Fortuna", { town: "Arenal" }), "La Fortuna");
eq("typed place outside our towns: its first part", d.shortPlace("Casa Azul, Playa Hermosa", { lat: 1 }), "Casa Azul");
eq("long names are cut", d.shortPlace("A very long hotel name that goes on, Town", null).length, 22);

// --- The page assigns through the booking page's own actions -----------------------------------
const page = readFileSync(new URL("../src/app/admin/dispatch/page.tsx", import.meta.url), "utf8");
eq("calendar imports updateBooking and acceptOffer from the booking actions",
  /import \{ acceptOffer, updateBooking \} from "\.\.\/bookings\/actions"/.test(page), true);
eq("calendar asks before assigning", /kind: "always"/.test(page), true);
eq("calendar never shows traveller email or phone", /guest_email|guest_phone/.test(page), false);
const actions = readFileSync(new URL("../src/app/admin/bookings/actions.ts", import.meta.url), "utf8");
eq("updateBooking keeps the amount received when the calendar doesn't send it", /fd\.has\("amount_paid"\)/.test(actions), true);
eq("updateBooking keeps the internal notes when the calendar doesn't send them", /fd\.has\("admin_notes"\)/.test(actions), true);

if (failures.length) {
  console.error(`Dispatch: ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`Dispatch: ${passed} checks passed`);
