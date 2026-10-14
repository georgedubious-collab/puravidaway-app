/**
 * Driver KYC rules shared by the driver portal (/driver) and the admin vault
 * (/admin/drivers). Keep in line with DRIVER_CHECKS in src/lib/trust.ts (what
 * the site promises) and with supabase/migrations/…0006_driver_vehicles.sql
 * (what the database enforces).
 *
 * The driver (person) and each vehicle are reviewed separately: a driver can
 * register several vehicles, each with its own documents and photos.
 */

export interface DocSpec {
  key: string;
  label: string;
  hint?: string;
  required: boolean;
}

/** Documents about the person. */
export const DRIVER_DOCS: DocSpec[] = [
  { key: "driver_photo", label: "Your photo", hint: "A clear photo of your face for your profile.", required: true },
  { key: "id_front", label: "Cédula or passport: front", required: true },
  { key: "id_back", label: "Cédula: back", hint: "For a passport, upload the photo page again.", required: true },
  { key: "license", label: "Driver's licence", hint: "Front and back in one photo or PDF.", required: true },
  { key: "criminal_record", label: "Criminal record certificate (hoja de delincuencia)", hint: "Issued no more than 30 days ago.", required: true },
  { key: "ict_permit", label: "ICT tourist-transport permit", hint: "Optional. Drivers who have it get an ICT badge.", required: false },
];

/** Documents about each vehicle (photos are a separate list). */
export const VEHICLE_DOCS: DocSpec[] = [
  { key: "insurance", label: "INS insurance policy", hint: "Showing this vehicle and the valid dates.", required: true },
  { key: "dekra", label: "Dekra / RTV inspection", hint: "Current certificate.", required: true },
  { key: "marchamo", label: "Marchamo (current year)", required: true },
  { key: "vehicle_registration", label: "Registration (tarjeta de circulación)", hint: "Optional.", required: false },
];

export const MIN_VEHICLE_PHOTOS = 2;
export const MAX_VEHICLE_PHOTOS = 12;

export const DRIVER_DOC_KEYS = new Set(DRIVER_DOCS.map((d) => d.key));
export const VEHICLE_DOC_KEYS = new Set(VEHICLE_DOCS.map((d) => d.key));

export const MAX_DOC_BYTES = 10 * 1024 * 1024;

/** The criminal record certificate must be this recent when the driver is approved. */
export const CRIMINAL_RECORD_MAX_AGE_DAYS = 30;
/** Days of grace after the INS policy's end date (licence, Dekra and Marchamo have none). */
export const INSURANCE_GRACE_DAYS = 15;

export type KycStatus = "pending" | "approved" | "rejected" | "suspended";

export interface DriverRecord {
  id: string;
  cedula_number: string | null;
  ict_permit_number: string | null;
  license_number: string | null;
  license_expiry: string | null;
  criminal_record_date: string | null;
  kyc_status: KycStatus;
  kyc_note: string | null;
  needs_review: boolean;
  documents: Record<string, string>;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface VehicleRecord {
  id: string;
  driver_id: string;
  plate: string | null;
  make_model: string | null;
  year: number | null;
  color: string | null;
  passenger_capacity: number | null;
  ins_policy_number: string | null;
  ins_insurance_expiry: string | null;
  dekra_inspection_expiry: string | null;
  marchamo_year: number | null;
  documents: Record<string, string>;
  photos: string[];
  status: KycStatus;
  note: string | null;
  needs_review: boolean;
  reviewed_at: string | null;
}

/**
 * Dated documents that must be RE-UPLOADED when renewed: after the first
 * review, the date changes only together with the new file (the database
 * enforces this too).
 */
export type RenewField = "license_expiry" | "ins_insurance_expiry" | "dekra_inspection_expiry" | "marchamo_year";
export const RENEWABLE: Record<string, { field: RenewField; ask: string; kind: "date" | "year" }> = {
  license: { field: "license_expiry", ask: "New expiry date", kind: "date" },
  insurance: { field: "ins_insurance_expiry", ask: "Policy valid until", kind: "date" },
  dekra: { field: "dekra_inspection_expiry", ask: "Valid until", kind: "date" },
  marchamo: { field: "marchamo_year", ask: "Year it covers", kind: "year" },
};

export interface Issue {
  text: string;
  /** True when it stops trips (or, for an applicant, approval) until fixed. */
  blocking: boolean;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/* ---------------------------- the person -------------------------------- */

export function missingDriverDocs(d: Pick<DriverRecord, "documents">): DocSpec[] {
  return DRIVER_DOCS.filter((doc) => doc.required && !d.documents?.[doc.key]);
}

export function missingDriverDetails(d: DriverRecord): string[] {
  const out: string[] = [];
  if (!d.cedula_number) out.push("Cédula / passport number");
  if (!d.license_number) out.push("Licence number");
  if (!d.license_expiry) out.push("Licence expiry");
  if (!d.criminal_record_date) out.push("Criminal record certificate date");
  return out;
}

/** Licence validity, and for applicants the age of the criminal record certificate. */
export function driverIssues(d: DriverRecord, today: string, soon: string): Issue[] {
  const out: Issue[] = [];
  if (d.license_expiry) {
    if (d.license_expiry < today)
      out.push({ text: `Driver's licence expired ${d.license_expiry}. Upload the renewed licence to receive trips again.`, blocking: true });
    else if (d.license_expiry <= soon)
      out.push({ text: `Driver's licence expires ${d.license_expiry}. Upload the renewed one before then; there is no grace period.`, blocking: false });
  }
  if (d.kyc_status === "pending" && d.criminal_record_date && criminalRecordTooOld(d.criminal_record_date, today)) {
    out.push({
      text: `Criminal record certificate is from ${d.criminal_record_date}. It must be issued no more than ${CRIMINAL_RECORD_MAX_AGE_DAYS} days before approval; upload a new one.`,
      blocking: true,
    });
  }
  return out;
}

export function criminalRecordTooOld(issued: string, today: string): boolean {
  return issued < addDaysYmd(today, -CRIMINAL_RECORD_MAX_AGE_DAYS);
}

/* ---------------------------- vehicles ---------------------------------- */

export function missingVehicleItems(v: VehicleRecord): string[] {
  const out: string[] = [];
  if (!v.plate) out.push("Plate number");
  if (!v.make_model) out.push("Make and model");
  if (!v.year) out.push("Year");
  if (!v.passenger_capacity) out.push("Passenger seats");
  if (!v.ins_insurance_expiry) out.push("Insurance valid-until date");
  if (!v.dekra_inspection_expiry) out.push("Dekra valid-until date");
  if (!v.marchamo_year) out.push("Marchamo year");
  for (const doc of VEHICLE_DOCS) if (doc.required && !v.documents?.[doc.key]) out.push(doc.label);
  const photos = v.photos?.length ?? 0;
  if (photos < MIN_VEHICLE_PHOTOS) out.push(`Photos (at least ${MIN_VEHICLE_PHOTOS}: outside and inside)`);
  return out;
}

/** Mirrors vehicle_documents_current() in the database. */
export function vehicleIssues(v: VehicleRecord, today: string, soon: string): Issue[] {
  const out: Issue[] = [];
  const year = Number(today.slice(0, 4));
  const name = v.plate || v.make_model || "Vehicle";

  if (v.ins_insurance_expiry) {
    const graceEnd = addDaysYmd(v.ins_insurance_expiry, INSURANCE_GRACE_DAYS);
    if (graceEnd < today)
      out.push({ text: `${name}: INS insurance expired ${v.ins_insurance_expiry} and the ${INSURANCE_GRACE_DAYS}-day grace period is over. Upload the renewed policy.`, blocking: true });
    else if (v.ins_insurance_expiry < today)
      out.push({ text: `${name}: INS insurance expired ${v.ins_insurance_expiry}. Upload the renewed policy by ${graceEnd} or this vehicle stops getting trips.`, blocking: false });
    else if (v.ins_insurance_expiry <= soon)
      out.push({ text: `${name}: INS insurance expires ${v.ins_insurance_expiry}. Upload the renewed policy when you have it.`, blocking: false });
  }
  if (v.dekra_inspection_expiry) {
    if (v.dekra_inspection_expiry < today)
      out.push({ text: `${name}: Dekra expired ${v.dekra_inspection_expiry}. Upload the new certificate.`, blocking: true });
    else if (v.dekra_inspection_expiry <= soon)
      out.push({ text: `${name}: Dekra expires ${v.dekra_inspection_expiry}. Upload the new certificate before then; there is no grace period.`, blocking: false });
  }
  if (v.marchamo_year !== null) {
    if (v.marchamo_year < year)
      out.push({ text: `${name}: Marchamo ${v.marchamo_year} is out of date. Upload the ${year} Marchamo.`, blocking: true });
    else if (v.marchamo_year === year && today.slice(5) >= "12-01")
      out.push({ text: `${name}: Marchamo ${year + 1} is due by December 31. Upload it as soon as it's paid.`, blocking: false });
  }
  return out;
}

export function vehicleRoadLegal(v: VehicleRecord, today: string): boolean {
  return (
    !!v.ins_insurance_expiry && !!v.dekra_inspection_expiry && v.marchamo_year !== null &&
    !vehicleIssues(v, today, today).some((i) => i.blocking)
  );
}

/** Mirrors is_approved_driver(): approved, licence current, ≥1 approved road-legal vehicle. */
export function canTakeTrips(d: DriverRecord, vehicles: VehicleRecord[], today: string): boolean {
  return (
    d.kyc_status === "approved" &&
    !!d.license_expiry && d.license_expiry >= today &&
    vehicles.some((v) => v.status === "approved" && vehicleRoadLegal(v, today))
  );
}

export const STATUS_LABEL: Record<KycStatus, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Not approved",
  suspended: "Suspended",
};
