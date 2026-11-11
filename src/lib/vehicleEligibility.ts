/**
 * Which jobs a driver's vehicle may take, by vehicle category (Jorge, 2026-11-11).
 *
 * The rule itself lives in the database: public.vehicle_can_serve() in
 * supabase/migrations/20261111000038_vehicle_categories.sql (van_4x4: migration 0039), used by the job board
 * (driver_jobs) and by offers (offer_job). This file mirrors it for the pages that
 * decide outside the database: job alerts, the admin's assignment warning and the
 * vehicle pickers. apps/driver/src/vehicleCategory.ts is the driver app's copy.
 * `npm run test:eligibility` checks this file and the app's copy against the table
 * below; `npm run test:db` checks the database function.
 *
 *   vehicle tagged   receives jobs booked as
 *   economy          economy
 *   sedan            economy, sedan                  (sedans AND compact SUVs)
 *   suv (MPV)        economy, sedan, suv
 *   4x4              economy, sedan, suv, 4x4, sierpe_combo
 *   van              economy, sedan, suv, van        (not 4x4 jobs: those are about rough roads)
 *   van_4x4          economy, sedan, suv, van, 4x4, sierpe_combo   (a van that is also a 4x4)
 *
 * Not tagged yet (null) = not filtered by category, as before categories existed.
 * A job without a class (day tours, expeditions) is open to every category.
 * Seats are a second, separate check (seatsFit): the vehicle must seat the travellers, and a
 * vehicle without a seat number seats nobody. The board and the alerts need ONE approved
 * vehicle that passes both (migration 20261111000039_vehicle_categories_2.sql).
 *
 * No imports, so Node can run it directly in the test script.
 */

/** Categories a vehicle can be tagged with (driver_vehicles.vehicle_class). */
export const VEHICLE_CATEGORY_IDS = ["economy", "sedan", "suv", "4x4", "van", "van_4x4"] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORY_IDS)[number];

/** Job classes the rule knows (vehicle_classes ids a ride can be booked as). */
export const JOB_CLASS_IDS = ["economy", "sedan", "suv", "4x4", "van", "sierpe_combo"] as const;

export const CATEGORY_SERVES: Record<VehicleCategory, readonly string[]> = {
  economy: ["economy"],
  sedan: ["economy", "sedan"],
  suv: ["economy", "sedan", "suv"],
  "4x4": ["economy", "sedan", "suv", "4x4", "sierpe_combo"],
  van: ["economy", "sedan", "suv", "van"],
  // A van that is also a 4x4: everything a van gets plus everything a 4x4 gets.
  van_4x4: ["economy", "sedan", "suv", "van", "4x4", "sierpe_combo"],
};

export function isVehicleCategory(v: unknown): v is VehicleCategory {
  return typeof v === "string" && (VEHICLE_CATEGORY_IDS as readonly string[]).includes(v);
}

/** Same answers as public.vehicle_can_serve(vehicle_class, job_class). */
export function vehicleCanServe(vehicleClass: string | null | undefined, jobClass: string | null | undefined): boolean {
  if (!vehicleClass || !jobClass) return true;
  // A class added later in /admin/pricing is not restricted, so it is never hidden from everyone.
  if (!(JOB_CLASS_IDS as readonly string[]).includes(jobClass)) return true;
  return isVehicleCategory(vehicleClass) && CATEGORY_SERVES[vehicleClass].includes(jobClass);
}

/**
 * Enough seats for the group? Same answer as offer_job() and driver_jobs(): a job without a
 * traveller count fits any vehicle; a vehicle without a seat number counts as 0 seats.
 */
export function seatsFit(passengerCapacity: number | null | undefined, passengerCount: number | null | undefined): boolean {
  if (passengerCount == null) return true;
  return (passengerCapacity ?? 0) >= passengerCount;
}

/**
 * Does the driver have at least one approved vehicle that may take the job: right category
 * AND enough seats, on the same vehicle? (driver_jobs' rule; day tours carry travellers but
 * no class, so only the seats count for them)
 */
export function driverCanServe(
  vehicles: { status: string; vehicle_class?: string | null; passenger_capacity?: number | null }[],
  jobClass: string | null | undefined,
  passengerCount?: number | null,
): boolean {
  if (!jobClass && passengerCount == null) return true;
  return vehicles.some(
    (v) => v.status === "approved" && vehicleCanServe(v.vehicle_class, jobClass) && seatsFit(v.passenger_capacity, passengerCount),
  );
}

type Lang = "es" | "en";

/** Names for the team and for drivers (Spanish first). Travellers see the catalog names instead. */
const CATEGORY_NAME: Record<VehicleCategory, [string, string]> = {
  economy: ["Sedán económico", "Economy sedan"],
  sedan: ["Sedán (o SUV compacto)", "Sedan (or compact SUV)"],
  suv: ["Minivan (MPV)", "Minivan (MPV)"],
  "4x4": ["4x4 ejecutivo", "Executive 4x4"],
  van: ["Van / microbús", "Van"],
  van_4x4: ["Van 4x4", "Van 4x4"],
};

/** Job classes as they read in the hint. */
const JOB_NAME: Record<string, [string, string]> = {
  economy: ["Sedán económico", "Economy sedan"],
  sedan: ["Sedán estándar", "Standard sedan"],
  suv: ["Minivan (MPV)", "Minivan (MPV)"],
  "4x4": ["4x4 ejecutivo", "Executive 4x4"],
  van: ["Van", "Van"],
  sierpe_combo: ["4x4 + lancha de Sierpe", "4x4 + Sierpe boat"],
};

const pick = (pair: [string, string], lang: Lang) => pair[lang === "en" ? 1 : 0];

export const UNTAGGED_LABEL: [string, string] = ["Sin categoría: recibe todos los trabajos", "No category: receives every job"];

/** "Sedán (o SUV compacto)", or the untagged text. */
export function categoryLabel(vehicleClass: string | null | undefined, lang: Lang = "es"): string {
  return isVehicleCategory(vehicleClass) ? pick(CATEGORY_NAME[vehicleClass], lang) : pick(UNTAGGED_LABEL, lang);
}

/** A job class by name, for warnings ("no cubre Minivan (MPV)"). */
export function jobClassLabel(jobClass: string, lang: Lang = "es"): string {
  return JOB_NAME[jobClass] ? pick(JOB_NAME[jobClass], lang) : jobClass;
}

/** One line: which jobs a vehicle of this category receives. */
export function categoryHint(vehicleClass: string | null | undefined, lang: Lang = "es"): string {
  if (!isVehicleCategory(vehicleClass)) {
    return lang === "en"
      ? "Receives every job until our team sets its category."
      : "Recibe todos los trabajos hasta que nuestro equipo le asigne una categoría.";
  }
  const jobs = CATEGORY_SERVES[vehicleClass].map((j) => jobClassLabel(j, lang)).join(", ");
  return (lang === "en" ? "Receives jobs for: " : "Recibe trabajos de: ") + jobs + (lang === "en" ? ", and day tours." : ", y tours de un día.");
}
