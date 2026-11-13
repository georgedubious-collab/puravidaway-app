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
eq("buffer is 2 hours (Jorge, 2026-11-12)", d.CLASH_BUFFER_MINUTES, 120);
eq("longest drive between our towns (Puerto Viejo ↔ Puerto Jiménez)", d.LONGEST_ROUTE_MINUTES, 585);
eq("unknown places are only checked inside longest drive + buffer", d.CHECK_TRAVEL_WINDOW_MINUTES, 705);

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
  // A traveller's own stop (src/lib/customStops.ts): its minutes there count; the extra driving to
  // reach it is already inside the saved drive time, and is added when there is no saved time.
  const own = { id: "custom-1", custom: true, name: "La Fortuna Waterfall", place_id: "ChIJwaterfallAAAAAA", lat: 10.44, lng: -84.67, minutes: 90, detour_km: 11, detour_min: 24 };
  eq("own stop: saved drive time (detour inside) + time there", d.busySpan(ride("SJO", "Arenal", "08:00", { drive_minutes: 204, sightseeing_stops: [own] }), CAT).minutes, 204 + 90);
  eq("own stop, no saved drive time: town table + detour + time there", d.busySpan(ride("SJO", "Arenal", "08:00", { sightseeing_stops: [own] }), CAT).minutes, routeMinutes("SJO", "Arenal") + 24 + 90);
  eq("own stop next to a catalog stop", d.busySpan(ride("SJO", "Arenal", "08:00", { drive_minutes: 204, sightseeing_stops: [{ id: stop.id }, own] }), CAT).minutes, 204 + 90 + stop.durationMin + stop.detourMin);
  eq("an own stop is never counted as an unknown 45-minute stop", d.busySpan(ride("SJO", "Arenal", "08:00", { drive_minutes: 100, sightseeing_stops: [{ ...own, minutes: 30 }] }), CAT).minutes, 130);
}
{
  const tour = { id: "t1", booking_ref: "CRPT-T1", status: "confirmed", service_type: "day_tour", catalog_item_id: "dt1", scheduled_at: at("07:00"), sightseeing_stops: [] };
  const s = d.busySpan(tour, CAT);
  eq("day tour: the catalog length (8 h)", s.minutes, 480);
  eq("…starts and ends in its region's town", [s.from, s.to], ["Arenal", "Arenal"]);
  const osa = d.busySpan({ ...tour, catalog_item_id: "dt3" }, CAT);
  eq("Osa tour: starts and ends in Puerto Jiménez, one of our towns", [osa.from, osa.to, osa.fromPlace, osa.toPlace], ["PuertoJimenez", "PuertoJimenez", null, null]);
  const osaTour = { ...tour, id: "osa", catalog_item_id: "dt3" }; // 07:00 + 7 h → free at 14:00 in Puerto Jiménez
  const osaClash = d.findClashes(ride("Sierpe", "SJO", "17:30"), [osaTour], CAT);
  eq("…a ride from Sierpe after it: Puerto Jiménez → Sierpe 2 h + 2 h margin, too tight (no more \"Revisar traslado\")",
    [osaClash.map((c) => [c.kind, c.gapMinutes, c.neededMinutes]), d.clashText(osaClash[0], "es")],
    [[["too_tight", 210, 240]], "Muy justo después de CRPT-T1: 3 h 30 min libres, necesita 4 h (manejo + 2 h de margen)"]);
  eq("…from Sierpe with enough time: fine", kinds(ride("Sierpe", "SJO", "18:00"), [osaTour]), []);
  eq("…a ride from Puerto Jiménez itself 2 h after it: fine", kinds(ride("PuertoJimenez", "SJO", "16:00"), [osaTour]), []);
  eq("…a ride into Puerto Jiménez before the tour must arrive 2 h early", kinds(ride("SJO", "PuertoJimenez", "00:30", { day: "2026-11-20" }), [osaTour]), ["too_tight"]);
  eq("Smart En-Route tour ends somewhere we don't know", d.busySpan({ ...tour, sightseeing_stops: [{ id: "en_route_upgrade" }] }, CAT).to, null);
  eq("unknown tour: a full day, estimated", [d.busySpan({ ...tour, catalog_item_id: "x" }, CAT).minutes, d.busySpan({ ...tour, catalog_item_id: "x" }, CAT).estimated], [480, true]);
}
eq("no pickup time: no span", d.busySpan({ ...ride("SJO", "LIR", "08:00"), scheduled_at: null }, CAT), null);
eq("span label in Costa Rica time, a. m. once when both are morning", d.spanLabel(d.busySpan(ride("SJO", "Arenal", "08:00"), CAT)), "8:00–10:45 a. m.");
eq("…English", d.spanLabel(d.busySpan(ride("SJO", "Arenal", "08:00"), CAT), "en"), "8:00–10:45 AM");
eq("…morning to afternoon", d.spanLabel(d.busySpan(ride("SJO", "Arenal", "11:30"), CAT)), "11:30 a. m.–2:15 p. m.");
{
  const late = d.busySpan(ride("LIR", "Tamarindo", "23:30"), CAT); // 90 min → 01:00 next day
  eq("late ride ends the next day", d.spanDays(late), ["2026-11-20", "2026-11-21"]);
  eq("…label says so", d.spanLabel(late, "es"), "11:30 p. m.–1:00 a. m. (+1 día)");
}

// --- Clashes ----------------------------------------------------------------------------------
// A: SJO 08:00 → La Fortuna (165 min) = free at 10:45 in La Fortuna.
const A = ride("SJO", "Arenal", "08:00");
eq("overlap", kinds(ride("Arenal", "Monteverde", "10:00"), [A]), ["overlap"]);
eq("overlap: a later booking that starts inside", kinds(A, [ride("SJO", "Tamarindo", "09:00")]), ["overlap"]);
eq("back-to-back in the same town with exactly the 2 h buffer: fine", kinds(ride("Arenal", "Monteverde", "12:45"), [A]), []);
eq("…119 minutes: too tight", kinds({ ...ride("Arenal", "Monteverde", "12:45"), scheduled_at: "2026-11-20T12:44:00-06:00" }, [A]), ["too_tight"]);
{
  // La Fortuna → Monteverde is 210 min + 120 buffer = 330 after 10:45 → 16:15.
  eq("other town, enough travel time + buffer: fine", kinds(ride("Monteverde", "SJO", "16:15"), [A]), []);
  const c = d.findClashes(ride("Monteverde", "SJO", "14:00"), [A], CAT);
  eq("other town, not enough travel time: too tight", c.map((x) => [x.kind, x.side, x.gapMinutes, x.neededMinutes]), [["too_tight", "before", 195, 330]]);
  eq("…readable in Spanish", d.clashText(c[0], "es"), `Muy justo después de ${A.booking_ref}: 3 h 15 min libres, necesita 5 h 30 min (manejo + 2 h de margen)`);
}
eq("the next booking is too close after this one", kinds(A, [ride("Tamarindo", "LIR", "12:00")]), ["too_tight"]);
{
  const typedPickup = { ...ride(null, "SJO", "13:00"), origin: "Villa Privada, Nuevo Arenal", origin_coords: { lat: 10.5, lng: -84.9 } };
  eq("unknown pickup place after a drop-off: check the travel time", kinds(typedPickup, [A]), ["check_travel"]);
  eq("…but not with more free time than the longest drive + buffer", kinds({ ...typedPickup, scheduled_at: at("23:30") }, [A]), []);
  eq("…in Spanish", d.clashText(d.findClashes(typedPickup, [A], CAT)[0], "es").startsWith("Revise el tiempo de traslado desde"), true);
}
eq("cancelled booking ignored", kinds(ride("Arenal", "Monteverde", "10:00"), [{ ...A, status: "cancelled" }]), []);
eq("a cancelled target clashes with nothing", kinds({ ...ride("Arenal", "Monteverde", "10:00"), status: "cancelled" }, [A]), []);
eq("the booking itself is skipped", kinds(A, [A]), []);
eq("other days don't clash", kinds(ride("Monteverde", "SJO", "08:00", { day: "2026-11-21" }), [A]), []);
{
  // Only the nearest booking before is checked for travel: an earlier drop-off at an unknown place
  // (would be "check the travel time") with a booking in between doesn't count.
  const early = { ...ride("SJO", null, "03:00"), destination: "Casa Azul, Playa Hermosa", destination_coords: { lat: 10.5 }, drive_minutes: 60 }; // free 04:00
  const mid = { ...ride(null, "Arenal", "06:00"), origin: "Casa Azul, Playa Hermosa", origin_coords: { lat: 10.5 }, drive_minutes: 180 }; // free 09:00 in La Fortuna
  eq("only the neighbours are checked for travel time", kinds(ride("Arenal", "SJO", "11:00"), [early, mid]), []);
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
eq("Puerto Jiménez short name", [d.shortPlace("Puerto Jiménez (Osa)", null), d.shortPlace("Lapa Ríos, Matapalo", { town: "PuertoJimenez" }, "en")], ["Puerto Jiménez", "Puerto Jiménez"]);
eq("typed place outside our towns: its first part", d.shortPlace("Casa Azul, Playa Hermosa", { lat: 1 }), "Casa Azul");
eq("long names are cut", d.shortPlace("A very long hotel name that goes on, Town", null).length, 22);

// --- Puerto Jiménez (2026-11-12): a town like the others for matching and typed places ---------
{
  const m = await import("../src/lib/matching.ts");
  const pl = await import("../src/lib/places.ts");
  const job = { origin_town: "PuertoJimenez", destination_town: "SJO", scheduled_at: at("13:00") };
  eq("a driver based in Puerto Jiménez: \"Starts in your area\"", [m.nearHome("PuertoJimenez", job), m.nearHome("Sierpe", job)], [true, false]);
  const inbound = { ...ride("SJO", "PuertoJimenez", "06:00"), status: "confirmed" }; // 6 h → free at 12:00 in Puerto Jiménez
  const r = m.returnMatch(job, [inbound]);
  eq("return trip: a drop-off in Puerto Jiménez matches a pickup there", [r?.kind, r?.gapMinutes], ["after", 60]);
  eq("trip length from the town table", m.tripDurationMinutes(inbound), 360);
  eq("town of a typed place saved with its town", m.townOf("Lapa Ríos, Matapalo", { town: "PuertoJimenez" }), "PuertoJimenez");
  eq("typed places: Matapalo and Golfito belong to Puerto Jiménez; Drake Bay lodges stay Drake Bay; Uvita stays Sierpe",
    [pl.nearestHub({ lat: 8.4, lng: -83.29 }), pl.nearestHub({ lat: 8.64, lng: -83.18 }), pl.nearestHub({ lat: 8.7, lng: -83.65 }), pl.nearestHub({ lat: 9.16, lng: -83.74 })],
    ["PuertoJimenez", "PuertoJimenez", "DrakeBay", "Sierpe"]);
  eq("Puerto Jiménez is a hub place with its own map point", [pl.hubOfPlaceId("hub:PuertoJimenez"), pl.hubPlace("PuertoJimenez").label], ["PuertoJimenez", "Puerto Jiménez (Osa)"]);
}

// --- The page assigns through the booking page's own actions -----------------------------------
const page = readFileSync(new URL("../src/app/admin/dispatch/page.tsx", import.meta.url), "utf8");
eq("calendar imports updateBooking, acceptOffer and repostJob from the booking actions",
  /import \{ acceptOffer, repostJob, updateBooking \} from "\.\.\/bookings\/actions"/.test(page), true);
eq("calendar asks before assigning", /kind: "always"/.test(page), true);
eq("calendar never shows traveller email or phone", /guest_email|guest_phone/.test(page), false);
const actions = readFileSync(new URL("../src/app/admin/bookings/actions.ts", import.meta.url), "utf8");
eq("updateBooking keeps the amount received when the calendar doesn't send it", /fd\.has\("amount_paid"\)/.test(actions), true);
eq("updateBooking keeps the internal notes when the calendar doesn't send them", /fd\.has\("admin_notes"\)/.test(actions), true);

// --- Driver assigned: the traveller and the driver are told, once per assignment ----------------
{
  const am = await import("../src/lib/assignmentMessages.ts");
  const DA = "00000000-0000-0000-0000-0000000000a1";
  const DB = "00000000-0000-0000-0000-0000000000b2";
  const ctx = (driverId, o = {}) => ({
    bookingId: "b-1", ref: "CRPT-1200", serviceType: "transfer", origin: "SJO Airport / San José", destination: "La Fortuna / Arenal",
    scheduledAt: "2026-11-20T08:00:00-06:00", payout: 140, viaOffer: false,
    driver: { id: driverId, fullName: driverId === DA ? "Carlos Mora" : "Andrea Rojas", email: driverId === DA ? "carlos@example.com" : "andrea@example.com", appLang: null },
    guest: { name: "Emily Smith", email: "emily@example.com", accessToken: "tok", language: "en" },
    siteUrl: "https://example.com", ...o,
  });
  // What updateBooking does on each save: notify only when shouldNotifyAssignment says so.
  const sent = [];
  let current = null;
  const save = (driverId) => {
    if (am.shouldNotifyAssignment(current, driverId)) sent.push(...am.assignmentMessages(ctx(driverId)));
    current = driverId;
  };
  save(DA);
  eq("manual assignment: traveller push + email and driver push + email, once each", sent.map((m) => m.kind), ["traveller_push", "traveller_email", "driver_push", "driver_email"]);
  const n1 = sent.length;
  save(DA);
  save(DA);
  eq("re-saving with the same driver (status, amount, notes) sends nothing", sent.length, n1);
  save(DB);
  eq("reassigning: the new driver and the traveller are told", sent.slice(n1).map((m) => [m.kind, m.kind.startsWith("driver") ? (m.userId ?? m.email.to) : (m.toEmail ?? m.email.to)]),
    [["traveller_push", "emily@example.com"], ["traveller_email", "emily@example.com"], ["driver_push", DB], ["driver_email", "andrea@example.com"]]);
  eq("removing the driver sends nothing here (handled elsewhere)", am.shouldNotifyAssignment(DB, null), false);

  const msgs = am.assignmentMessages(ctx(DA));
  const tPush = msgs.find((m) => m.kind === "traveller_push").message;
  eq("traveller hears the same text as an accepted offer (rideConfirmedPush)", tPush.title, "Your ride is confirmed");
  const tMail = msgs.find((m) => m.kind === "traveller_email").email;
  eq("…email in the language they booked in, with their trip link", [tMail.lang, tMail.lines.some((l) => /Carlos/.test(l)), JSON.stringify(tMail).includes("/trip/tok")], ["en", true, true]);
  const es = am.assignmentMessages(ctx(DA, { guest: { name: "Ana", email: "ana@example.com", accessToken: "t2", language: "es" } }));
  eq("Spanish booking: Spanish traveller messages", es.find((m) => m.kind === "traveller_push").message.title, "Su traslado está confirmado");
  const dPush = msgs.find((m) => m.kind === "driver_push").message;
  const dMail = msgs.find((m) => m.kind === "driver_email").email;
  eq("driver: Spanish by default", [dPush.title, dMail.subject.startsWith("Tiene el viaje CRPT-1200"), dMail.lang], ["Tiene el viaje CRPT-1200", true, "es"]);
  eq("…manual assignment wording, with their payout", [dMail.lines.some((l) => l.startsWith("Nuestro equipo le asignó el viaje CRPT-1200")), dMail.lines.includes("Su pago: $140.00.")], [true, true]);
  const en = am.assignmentMessages(ctx(DA, { viaOffer: true, driver: { id: DA, fullName: "Carlos Mora", email: "carlos@example.com", appLang: "en" } }));
  eq("driver app in English: the existing offer-accepted text", [en.find((m) => m.kind === "driver_push").message.title, en.find((m) => m.kind === "driver_email").email.lines[1].startsWith("Your offer was accepted: CRPT-1200")], ["You've got the ride CRPT-1200", true]);
  const forDriver = JSON.stringify(msgs.filter((m) => m.kind.startsWith("driver")));
  eq("driver messages never hold the traveller's email, name or the price they paid", /emily@example\.com|Emily|Smith|tok/.test(forDriver), false);
  eq("no traveller email on file: only the driver is told", am.assignmentMessages(ctx(DA, { guest: null })).map((m) => m.kind), ["driver_push", "driver_email"]);

  const actionsSrc = readFileSync(new URL("../src/app/admin/bookings/actions.ts", import.meta.url), "utf8");
  eq("updateBooking notifies only through shouldNotifyAssignment", /shouldNotifyAssignment\(before\.assigned_driver_id, driverId\)/.test(actionsSrc), true);
  eq("acceptOffer and updateBooking share the same sender", (actionsSrc.match(/prepareAssignmentNotices\(/g) ?? []).length, 2);
}

// --- Job board posting window (Jorge, 2026-11-12; src/lib/postingWindow.ts, migration 0054) ---
{
  const pw = await import("../src/lib/postingWindow.ts");
  const NOW = Date.parse("2026-11-20T10:00:00-06:00");
  const iso = (ms) => new Date(ms).toISOString();
  const open = { status: "pending_bids", posting_closes_at: iso(NOW + 35 * 60000) };
  const closed = { status: "pending_bids", posting_closes_at: iso(NOW - 60000) };
  eq("window is 1 hour, auto repost at 48 h", [pw.POSTING_WINDOW_MINUTES, pw.AUTO_REPOST_HOURS], [60, 48]);
  eq("posting state: open / closed / not on the board / posted before the window existed", [
    pw.postingState(open, NOW),
    pw.postingState(closed, NOW),
    pw.postingState({ status: "confirmed", posting_closes_at: open.posting_closes_at }, NOW),
    pw.postingState({ status: "pending_bids", posting_closes_at: null }, NOW),
  ], ["open", "closed", null, "closed"]);
  eq("minutes left", [pw.postingMinutesLeft(open, NOW), pw.postingMinutesLeft(closed, NOW)], [35, 0]);
  eq("team label (Spanish first)", [pw.postingLabel("closed", 2, 0, "es"), pw.postingLabel("closed", 1, 0, "en"), pw.postingLabel("open", 0, 35, "es")],
    ["Publicación cerrada · 2 ofertas", "Posting closed · 1 offer", "Abierta · quedan 35 min · 0 ofertas"]);
  const job = { ...closed, assigned_driver_id: null, driver_payout: 120, scheduled_at: iso(NOW + 30 * 3600000) };
  eq("repost offered on a closed posting without a driver", pw.canRepost(job, NOW), true);
  eq("…not while still open", pw.canRepost({ ...job, posting_closes_at: open.posting_closes_at }, NOW), false);
  eq("…not with a driver", pw.canRepost({ ...job, assigned_driver_id: "d1" }, NOW), false);
  eq("…not after pickup", pw.canRepost({ ...job, scheduled_at: iso(NOW - 60000) }, NOW), false);
  eq("…not without a payout", pw.canRepost({ ...job, driver_payout: null }, NOW), false);

  // The automatic repost run: claims in the database, then alerts the drivers about those jobs only.
  const calls = [];
  const deps = (ids) => ({ claim: async () => { calls.push("claim"); return ids; }, notify: async (x) => { calls.push(["notify", x]); } });
  eq("daytime run reposts and alerts", await pw.runAutoRepost(deps(["b1", "b2"]), new Date(NOW)), 2);
  eq("…drivers alerted for the claimed bookings", calls, ["claim", ["notify", ["b1", "b2"]]]);
  calls.length = 0;
  eq("nothing due: no alert", [await pw.runAutoRepost(deps([]), new Date(NOW)), calls], [0, ["claim"]]);
  calls.length = 0;
  const night = new Date(Date.parse("2026-11-20T23:30:00-06:00"));
  const early = new Date(Date.parse("2026-11-21T06:55:00-06:00"));
  eq("not at night (9 PM–7 AM Costa Rica): waits, claims nothing", [await pw.runAutoRepost(deps(["b1"]), night), await pw.runAutoRepost(deps(["b1"]), early), calls], [0, 0, []]);
  eq("…7 AM: runs", await pw.runAutoRepost(deps(["b1"]), new Date(Date.parse("2026-11-21T07:00:00-06:00"))), 1);

  // "Volver a publicar" goes through the database function, then the same driver alerts.
  const actionsSrc = readFileSync(new URL("../src/app/admin/bookings/actions.ts", import.meta.url), "utf8");
  const repost = actionsSrc.slice(actionsSrc.indexOf("export async function repostJob"), actionsSrc.indexOf("export async function updateBooking"));
  eq("repost: database function, then the new-job alerts", [/rpc\("repost_job"/.test(repost), /notifyDriversOfJobs\(\[id\]\)/.test(repost)], [true, true]);
  const cronSrc = readFileSync(new URL("../src/app/api/cron/eta/route.ts", import.meta.url), "utf8");
  eq("the 5-minute check runs the automatic repost", /autoRepostJobs\(\)/.test(cronSrc), true);
}

// --- Live trips and "Ver en el mapa" (src/lib/liveTrips.ts, 2026-11-13) ---------------------------
{
  const lv = await import("../src/lib/liveTrips.ts");
  const NOW = Date.parse("2026-11-13T10:00:00-06:00");
  const iso = (ms) => new Date(ms).toISOString();
  const trip = (min, extra = {}) => ({ status: "confirmed", assigned_driver_id: "d1", scheduled_at: iso(NOW + min * 60000), en_route_at: null, ...extra });
  eq("on the road: live", lv.isLiveTrip(trip(-300, { status: "in_progress" }), NOW), true);
  eq("pickup in 2 h: live", lv.isLiveTrip(trip(120), NOW), true);
  eq("pickup in exactly 3 h: live", lv.isLiveTrip(trip(180), NOW), true);
  eq("pickup in 4 h: not yet", lv.isLiveTrip(trip(240), NOW), false);
  eq("…unless the driver is already on the way", lv.isLiveTrip(trip(240, { en_route_at: iso(NOW) }), NOW), true);
  eq("pickup 13 h ago: gone", lv.isLiveTrip(trip(-13 * 60), NOW), false);
  eq("no driver: never on the map", lv.isLiveTrip(trip(60, { assigned_driver_id: null }), NOW), false);
  eq("not confirmed / on the road: never", ["pending_payment", "pending_bids", "completed", "cancelled"].map((s) => lv.isLiveTrip(trip(60, { status: s }), NOW)), [false, false, false, false]);
  eq("no pickup time: not live", lv.isLiveTrip({ ...trip(0), scheduled_at: null }, NOW), false);

  const A = "00000000-0000-0000-0000-00000000000a";
  const B = "00000000-0000-0000-0000-00000000000b";
  eq("map link focuses the booking", lv.liveMapHref(A), `/admin/live?booking=${A}`);
  eq("focus: the asked trip when it is live", lv.liveFocusId(B, [A, B]), B);
  eq("focus: upper-case id works", lv.liveFocusId(B.toUpperCase(), [A, B]), B);
  eq("focus: a trip no longer live → the first one", lv.liveFocusId("00000000-0000-0000-0000-00000000000c", [A, B]), A);
  eq("focus: garbage ignored", lv.liveFocusId("<script>", [A, B]), A);
  eq("focus: nothing live → none", lv.liveFocusId(A, []), null);
  eq("focus: repeated param, first wins", lv.liveFocusId([B, A], [A, B]), B);
  eq("stale after 10 min", [lv.isStaleLocation(iso(NOW - 9 * 60000), NOW), lv.isStaleLocation(iso(NOW - 11 * 60000), NOW)], [false, true]);
  eq("'hace 2 min'", [lv.agoText(iso(NOW - 2 * 60000), NOW, "es"), lv.agoText(iso(NOW - 75 * 60000), NOW, "en")], ["hace 2 min", "1 h 15 min ago"]);
  eq("driver WhatsApp: digits only", lv.driverWhatsAppHref("+506 8888-0000"), "https://wa.me/50688880000");
  eq("driver WhatsApp: none without a number", [lv.driverWhatsAppHref(null), lv.driverWhatsAppHref("12")], [null, null]);

  const livePage = readFileSync(new URL("../src/app/admin/live/page.tsx", import.meta.url), "utf8");
  eq("live page lists exactly isLiveTrip's trips", livePage.includes("(rows ?? []).filter((b) => isLiveTrip(b, now))"), true);
  eq("live page reads ?booking= through liveFocusId", livePage.includes("liveFocusId(sp.booking"), true);
  eq("live page never reads the traveller's contact", /guest_(phone|email)|trips\(/.test(livePage), false);
  const panel = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");
  eq("Inicio's map link only on live trips", /\{live && \(\s*<Link\s+href=\{liveMapHref\(b\.id\)\}/.test(panel), true);
  const crmPhone = readFileSync(new URL("../src/lib/adminPhone.ts", import.meta.url), "utf8");
  eq("booking bar's map button uses the same rule", crmPhone.includes('if (isLiveTrip(b, ctx.now)) out.push("map")'), true);
  eq("phone day view keeps the calendar's clash rules (findClashes, no copy)", page.includes("ClashLine") && !/CLASH_BUFFER_MINUTES\s*\*/.test(page), true);
}

if (failures.length) {
  console.error(`Dispatch: ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`Dispatch: ${passed} checks passed`);
