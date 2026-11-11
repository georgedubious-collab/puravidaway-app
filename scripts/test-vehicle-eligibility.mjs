/**
 * Cases for the vehicle category rule (src/lib/vehicleEligibility.ts and the driver
 * app's copy, apps/driver/src/vehicleCategory.ts): which jobs a tagged vehicle receives.
 *
 *   npm run test:eligibility        (Node 22.6+; Node runs the TypeScript directly)
 *
 * The table below is the rule as Jorge decided it (2026-11-11), including van_4x4 (a van
 * that is also a 4x4 receives both sets of jobs) and the seat rule (a job is only for a
 * driver with ONE approved vehicle of the right category and with enough seats). The
 * database functions are checked against the same cases by `npm run test:db`.
 */
import * as site from "../src/lib/vehicleEligibility.ts";
import * as app from "../apps/driver/src/vehicleCategory.ts";

const JOBS = ["economy", "sedan", "suv", "4x4", "van", "sierpe_combo"];
/** vehicle category → the jobs it receives */
const EXPECTED = {
  economy: ["economy"],
  sedan: ["economy", "sedan"],
  suv: ["economy", "sedan", "suv"],
  "4x4": ["economy", "sedan", "suv", "4x4", "sierpe_combo"],
  van: ["economy", "sedan", "suv", "van"],
  van_4x4: ["economy", "sedan", "suv", "van", "4x4", "sierpe_combo"],
};

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  if (got === want) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};

for (const [label, lib] of [["site", site], ["driver app", app]]) {
  for (const [vehicle, serves] of Object.entries(EXPECTED)) {
    for (const job of JOBS) check(`${label}: ${vehicle} vehicle, ${job} job`, lib.vehicleCanServe(vehicle, job), serves.includes(job));
  }
  // Not tagged yet: every job, as before categories existed.
  for (const job of JOBS) check(`${label}: untagged vehicle, ${job} job`, lib.vehicleCanServe(null, job), true);
  // Day tours (and multi-day trips booked before they were retired) carry no vehicle class: never filtered.
  for (const vehicle of Object.keys(EXPECTED)) check(`${label}: ${vehicle} vehicle, job without a class`, lib.vehicleCanServe(vehicle, null), true);
  // A class added later in /admin/pricing is not hidden from everyone.
  check(`${label}: unknown job class is open`, lib.vehicleCanServe("sedan", "limo"), true);
  // An unknown tag (the database refuses it) serves nothing.
  check(`${label}: unknown vehicle tag serves nothing`, lib.vehicleCanServe("bus", "sedan"), false);

  // A driver: at least one APPROVED vehicle that can serve.
  const sedan = { status: "approved", vehicle_class: "sedan" };
  const van = { status: "approved", vehicle_class: "van" };
  const pendingVan = { status: "pending", vehicle_class: "van" };
  const untagged = { status: "approved", vehicle_class: null };
  check(`${label}: sedan driver, suv job`, lib.driverCanServe([sedan], "suv"), false);
  check(`${label}: sedan driver, economy job`, lib.driverCanServe([sedan], "economy"), true);
  check(`${label}: sedan + van driver, suv job`, lib.driverCanServe([sedan, van], "suv"), true);
  check(`${label}: van driver, 4x4 job`, lib.driverCanServe([van], "4x4"), false);
  check(`${label}: van driver, sierpe_combo job`, lib.driverCanServe([van], "sierpe_combo"), false);
  check(`${label}: a van that isn't approved doesn't count`, lib.driverCanServe([sedan, pendingVan], "van"), false);
  check(`${label}: an untagged vehicle sees everything`, lib.driverCanServe([sedan, untagged], "4x4"), true);
  check(`${label}: day tour, sedan driver`, lib.driverCanServe([sedan], null), true);
  check(`${label}: no vehicles, ride job`, lib.driverCanServe([], "sedan"), false);

  // A van that is also a 4x4 gets both sets of jobs.
  const van4x4 = { status: "approved", vehicle_class: "van_4x4" };
  for (const job of ["van", "suv", "4x4", "sierpe_combo"]) check(`${label}: van_4x4 driver, ${job} job`, lib.driverCanServe([van4x4], job), true);
  check(`${label}: van_4x4 is a category the team can pick`, lib.isVehicleCategory("van_4x4"), true);
  check(`${label}: van_4x4 is called Van 4x4`, lib.categoryLabel("van_4x4", "es") + "|" + lib.categoryLabel("van_4x4", "en"), "Van 4x4|Van 4x4");

  // Seats: same answers as offer_job() / driver_jobs() in the database.
  check(`${label}: 4 seats, 6 travellers`, lib.seatsFit(4, 6), false);
  check(`${label}: 8 seats, 6 travellers`, lib.seatsFit(8, 6), true);
  check(`${label}: exactly enough seats`, lib.seatsFit(6, 6), true);
  check(`${label}: no seat number counts as 0 seats`, lib.seatsFit(null, 1), false);
  check(`${label}: a job without a traveller count fits any vehicle`, lib.seatsFit(null, null) && lib.seatsFit(4, undefined), true);
  const sedan4 = { status: "approved", vehicle_class: "sedan", passenger_capacity: 4 };
  const van8 = { status: "approved", vehicle_class: "van", passenger_capacity: 8 };
  const noSeats = { status: "approved", vehicle_class: null, passenger_capacity: null };
  const fourByFour4 = { status: "approved", vehicle_class: "4x4", passenger_capacity: 4 };
  check(`${label}: 4-seat sedan driver, 6-traveller van job`, lib.driverCanServe([sedan4], "van", 6), false);
  check(`${label}: 4-seat sedan driver, 6-traveller sedan job`, lib.driverCanServe([sedan4], "sedan", 6), false);
  check(`${label}: 4-seat sedan driver, 3-traveller sedan job`, lib.driverCanServe([sedan4], "sedan", 3), true);
  check(`${label}: 8-seat van driver, 6-traveller van job`, lib.driverCanServe([van8], "van", 6), true);
  check(`${label}: 8-seat van driver, 9-traveller van job`, lib.driverCanServe([van8], "van", 9), false);
  check(`${label}: day tour for 6, 4-seat sedan driver`, lib.driverCanServe([sedan4], null, 6), false);
  check(`${label}: day tour for 6, 8-seat van driver`, lib.driverCanServe([van8], null, 6), true);
  check(`${label}: a vehicle without a seat number gets no job with travellers`, lib.driverCanServe([noSeats], "sedan", 1), false);
  check(`${label}: a vehicle without a seat number, job without a count`, lib.driverCanServe([noSeats], "sedan", null), true);
  check(`${label}: job with neither class nor count is open`, lib.driverCanServe([], null, null), true);
  // Category and seats must be right on the SAME vehicle.
  check(`${label}: 4-seat 4x4 + 8-seat van, 6-traveller 4x4 job`, lib.driverCanServe([fourByFour4, van8], "4x4", 6), false);
  check(`${label}: 4-seat 4x4 + 8-seat van, 6-traveller van job`, lib.driverCanServe([fourByFour4, van8], "van", 6), true);
  check(`${label}: an 8-seat van that isn't approved doesn't count`, lib.driverCanServe([sedan4, { ...van8, status: "pending" }], "van", 6), false);

  // Texts: every category has a name and a hint in both languages; untagged says so.
  for (const id of lib.VEHICLE_CATEGORY_IDS) {
    for (const lang of ["es", "en"]) {
      check(`${label}: ${id} has a ${lang} name`, lib.categoryLabel(id, lang).length > 2, true);
      // van_4x4 is not a class travellers book: its hint lists the van and the 4x4 jobs.
      const own = id === "van_4x4" ? ["van", "4x4", "sierpe_combo"] : [id];
      check(`${label}: ${id} has a ${lang} hint`, own.every((j) => lib.categoryHint(id, lang).includes(lib.jobClassLabel(j, lang))), true);
    }
  }
  check(`${label}: untagged label`, lib.categoryLabel(null, "es"), "Sin categoría: recibe todos los trabajos");
  check(`${label}: the 4-traveller category is not called an SUV`, /suv/i.test(lib.categoryLabel("suv", "en") + lib.categoryLabel("suv", "es")), false);
}

// The two copies say the same thing, word for word.
for (const id of [...site.VEHICLE_CATEGORY_IDS, null]) {
  for (const lang of ["es", "en"]) {
    check(`same name for ${id} (${lang})`, app.categoryLabel(id, lang), site.categoryLabel(id, lang));
    check(`same hint for ${id} (${lang})`, app.categoryHint(id, lang), site.categoryHint(id, lang));
  }
}

console.log(`${passed} eligibility checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
