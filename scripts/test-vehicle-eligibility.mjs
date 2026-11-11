/**
 * Cases for the vehicle category rule (src/lib/vehicleEligibility.ts and the driver
 * app's copy, apps/driver/src/vehicleCategory.ts): which jobs a tagged vehicle receives.
 *
 *   npm run test:eligibility        (Node 22.6+; Node runs the TypeScript directly)
 *
 * The table below is the rule as Jorge decided it (2026-11-11). The database function
 * public.vehicle_can_serve() is checked against the same table by `npm run test:db`.
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
  // Day tours and expeditions carry no vehicle class: never filtered.
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

  // Texts: every category has a name and a hint in both languages; untagged says so.
  for (const id of lib.VEHICLE_CATEGORY_IDS) {
    for (const lang of ["es", "en"]) {
      check(`${label}: ${id} has a ${lang} name`, lib.categoryLabel(id, lang).length > 2, true);
      check(`${label}: ${id} has a ${lang} hint`, lib.categoryHint(id, lang).includes(lib.jobClassLabel(id, lang)), true);
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
