/**
 * Prints every email and push notification a traveller can receive, in English
 * and in Spanish, with sample data. Nothing is sent. Use it to proofread the
 * wording in src/lib/travellerMessages.ts:
 *
 *   node scripts/preview-traveller-messages.mjs            (everything)
 *   node scripts/preview-traveller-messages.mjs subjects   (subjects and push titles only)
 *
 * Needs Node 22.15 or newer (it reads the TypeScript files directly).
 */
import { registerHooks } from "node:module";

// The app's files import each other without ".ts"; add it for Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const m = await import("../src/lib/travellerMessages.ts");
const { formatScheduledAtFor } = await import("../src/lib/dates.ts");
const { placeNameFor } = await import("../src/lib/catalogEs.ts");

const only = process.argv[2] === "subjects";
const tripUrl = "https://example.com/trip/<code>";
const at = "2026-11-22T15:00:00+00:00"; // 9:00 AM in Costa Rica

for (const lang of ["en", "es"]) {
  const when = formatScheduledAtFor(at, lang);
  const origin = placeNameFor("Liberia Airport (LIR)", lang);
  const destination = placeNameFor("Tamarindo / Guanacaste", lang);
  const driver = m.driverFirstName(lang, "Carlos Mora");
  const review = { guestName: "Ana Smith", driver, ref: "CRPT-10492", ride: true, origin, destination, tripUrl };
  const itemLines = [
    m.requestItemLine(lang, { ref: "CRPT-10492", date: "2026-11-22", time: "09:00", kind: "transfer", what: `${origin} → ${destination}` }),
    m.requestItemLine(lang, { ref: "CRPT-10493", date: "2026-11-24", time: "07:00", kind: "day_tour", what: lang === "es" ? "Tour de ejemplo" : "Sample tour" }),
    m.requestItemLine(lang, { ref: "CRPT-10494", date: "2026-11-26", time: "06:00", kind: "expedition", what: lang === "es" ? "Expedición de ejemplo" : "Sample expedition" }),
  ];
  const emails = {
    "Trip request received (cash + expedition online)": m.tripRequestEmail(lang, {
      guestName: "Ana Smith",
      refs: ["CRPT-10492", "CRPT-10493", "CRPT-10494"],
      itemLines,
      paymentLine: m.requestPaymentLine(lang, { cashCents: 23100, onlineCents: 120000, feeTotalCents: 2100, feePercent: "10%" }),
      tripUrl,
    }),
    "Trip request received (online in full)": m.tripRequestEmail(lang, {
      guestName: "Ana Smith",
      refs: ["CRPT-10492"],
      itemLines: itemLines.slice(0, 1),
      paymentLine: m.requestPaymentLine(lang, { cashCents: 0, onlineCents: 21000, feeTotalCents: 0, feePercent: "10%" }),
      tripUrl,
    }),
    "Ride confirmed": m.rideConfirmedEmail(lang, { guestName: "Ana Smith", driver, ref: "CRPT-10492", origin, destination, when, tripUrl }),
    "Driver on the way": m.onTheWayEmail(lang, { guestName: "Ana Smith", driver, ref: "CRPT-10492", when, tripUrl }),
    "Rating request (ride)": m.reviewRequestEmail(lang, review),
    "Rating request (tour)": m.reviewRequestEmail(lang, { ...review, ride: false }),
    "Rating reminder": m.reviewReminderEmail(lang, review),
    "New chat message (team)": m.chatMessageEmail(lang, { guestName: "Ana Smith", ref: "CRPT-10492", from: "team", snippet: "…", chatUrl: tripUrl }),
    "New chat message (driver)": m.chatMessageEmail(lang, { guestName: null, ref: "CRPT-10492", from: "driver", snippet: "…", chatUrl: tripUrl }),
  };
  const pushes = {
    "Ride confirmed": m.rideConfirmedPush(lang, { driver, when }),
    "Driver on the way": m.onTheWayPush(lang, { driver, when }),
    "Driver on the way (no name)": m.onTheWayPush(lang, { driver: m.driverFirstName(lang, null), when }),
    "Rating request": m.reviewRequestPush(lang, { driver, ride: true }),
  };

  console.log(`\n================ ${lang === "es" ? "ESPAÑOL" : "ENGLISH"} ================`);
  for (const [name, e] of Object.entries(emails)) {
    console.log(`\n[email] ${name}\n  Subject: ${e.subject}`);
    if (!only) console.log([...e.lines, `[ ${e.button.label} ]`].map((l) => `  ${l}`).join("\n"));
  }
  for (const [name, p] of Object.entries(pushes)) {
    console.log(`\n[push] ${name}\n  ${p.title}${only ? "" : `\n  ${p.body}`}`);
  }
}
