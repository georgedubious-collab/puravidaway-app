/**
 * Driver KYC rules shared by the driver portal (/driver) and the admin vault
 * (/admin/drivers). Keep the required list in line with DRIVER_CHECKS in
 * src/lib/trust.ts: the site promises these checks for every partner driver.
 */

export interface DriverDoc {
  key: string;
  label: string;
  hint?: string;
  required: boolean;
}

export const DRIVER_DOCS: DriverDoc[] = [
  { key: "driver_photo", label: "Your photo", hint: "A clear photo of your face for your profile.", required: true },
  { key: "cedula", label: "Cédula or passport", hint: "Front and back in one file or photo.", required: true },
  { key: "license", label: "Driver's licence", hint: "Front and back.", required: true },
  { key: "criminal_record", label: "Criminal record certificate (hoja de delincuencia)", hint: "Issued in the last 3 months.", required: true },
  { key: "vehicle_registration", label: "Vehicle registration", hint: "Tarjeta de circulación or título de propiedad.", required: true },
  { key: "insurance", label: "Proof of insurance", hint: "INS policy showing the vehicle and valid dates.", required: true },
  { key: "dekra", label: "Dekra / RTV inspection", hint: "Current inspection certificate or sticker.", required: true },
  { key: "marchamo", label: "Marchamo (current year)", required: true },
  { key: "vehicle_photos", label: "Vehicle photos", hint: "Outside and inside, in one file or photo.", required: true },
  { key: "ict_permit", label: "ICT tourist-transport permit", hint: "Optional. Drivers who have it get an ICT badge.", required: false },
];

export const DOC_KEYS = new Set(DRIVER_DOCS.map((d) => d.key));

export const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const DOC_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export type KycStatus = "pending" | "approved" | "rejected" | "suspended";

export interface DriverRecord {
  id: string;
  cedula_number: string | null;
  ict_permit_number: string | null;
  license_number: string | null;
  license_expiry: string | null;
  marchamo_year: number | null;
  ins_policy_number: string | null;
  ins_insurance_expiry: string | null;
  dekra_inspection_expiry: string | null;
  criminal_record_date: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  passenger_capacity: number | null;
  kyc_status: KycStatus;
  kyc_note: string | null;
  needs_review: boolean;
  documents: Record<string, string>;
  submitted_at: string | null;
  reviewed_at: string | null;
}

/** Required documents that haven't been uploaded yet. */
export function missingDocs(d: Pick<DriverRecord, "documents">): DriverDoc[] {
  return DRIVER_DOCS.filter((doc) => doc.required && !d.documents?.[doc.key]);
}

/** Required details that are still empty. */
export function missingDetails(d: DriverRecord): string[] {
  const out: string[] = [];
  if (!d.cedula_number) out.push("Cédula / passport number");
  if (!d.license_number) out.push("Licence number");
  if (!d.license_expiry) out.push("Licence expiry");
  if (!d.ins_insurance_expiry) out.push("Insurance expiry");
  if (!d.dekra_inspection_expiry) out.push("Dekra expiry");
  if (!d.marchamo_year) out.push("Marchamo year");
  if (!d.criminal_record_date) out.push("Criminal record certificate date");
  if (!d.vehicle_model) out.push("Vehicle model");
  if (!d.vehicle_year) out.push("Vehicle year");
  if (!d.passenger_capacity) out.push("Passenger seats");
  return out;
}

/** Days of grace after the INS policy's end date (licence and Marchamo have none). */
export const INSURANCE_GRACE_DAYS = 15;

/**
 * Documents that expire on a date and must be RE-UPLOADED when renewed: after
 * the first review, the driver changes the date only by uploading the new
 * document together with it (enforced in the database too).
 */
export const RENEWABLE: Record<string, { field: "license_expiry" | "ins_insurance_expiry" | "marchamo_year"; ask: string; kind: "date" | "year" }> = {
  license: { field: "license_expiry", ask: "New expiry date", kind: "date" },
  insurance: { field: "ins_insurance_expiry", ask: "Policy valid until", kind: "date" },
  marchamo: { field: "marchamo_year", ask: "Year it covers", kind: "year" },
};

export interface ExpiryIssue {
  text: string;
  /** True when the driver can't receive trips until it's fixed. */
  blocking: boolean;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Expired and soon-to-expire documents, in plain sentences. Mirrors
 * driver_documents_current() in the database: licence and Marchamo have no
 * grace period; insurance has 15 days. `today` and `soon` are YYYY-MM-DD
 * (Costa Rica time).
 */
export function expiryIssues(d: DriverRecord, today: string, soon: string): ExpiryIssue[] {
  const out: ExpiryIssue[] = [];
  const year = Number(today.slice(0, 4));

  if (d.license_expiry) {
    if (d.license_expiry < today)
      out.push({ text: `Driver's licence expired ${d.license_expiry}. Upload the renewed licence to receive trips again.`, blocking: true });
    else if (d.license_expiry <= soon)
      out.push({ text: `Driver's licence expires ${d.license_expiry}. Upload the renewed one before then; there is no grace period.`, blocking: false });
  }

  if (d.ins_insurance_expiry) {
    const graceEnd = addDaysYmd(d.ins_insurance_expiry, INSURANCE_GRACE_DAYS);
    if (graceEnd < today)
      out.push({ text: `INS insurance expired ${d.ins_insurance_expiry} and the ${INSURANCE_GRACE_DAYS}-day grace period is over. Upload the renewed policy to receive trips again.`, blocking: true });
    else if (d.ins_insurance_expiry < today)
      out.push({ text: `INS insurance expired ${d.ins_insurance_expiry}. Upload the renewed policy by ${graceEnd} or trips stop.`, blocking: false });
    else if (d.ins_insurance_expiry <= soon)
      out.push({ text: `INS insurance expires ${d.ins_insurance_expiry}. Upload the renewed policy when you have it.`, blocking: false });
  }

  if (d.marchamo_year !== null) {
    if (d.marchamo_year < year)
      out.push({ text: `Marchamo ${d.marchamo_year} is out of date. Upload the ${year} Marchamo to receive trips again.`, blocking: true });
    else if (d.marchamo_year === year && today.slice(5) >= "12-01")
      out.push({ text: `Marchamo ${year + 1} is due by December 31. Upload it as soon as it's paid; there is no grace period.`, blocking: false });
  }

  if (d.dekra_inspection_expiry) {
    if (d.dekra_inspection_expiry < today) out.push({ text: `Dekra inspection expired ${d.dekra_inspection_expiry}.`, blocking: false });
    else if (d.dekra_inspection_expiry <= soon) out.push({ text: `Dekra inspection expires ${d.dekra_inspection_expiry}.`, blocking: false });
  }

  // The hoja de delincuencia should be recent when the driver applies.
  if (d.kyc_status === "pending" && d.criminal_record_date) {
    const [y, m, day] = today.split("-").map(Number);
    const threeMonthsAgo = new Date(Date.UTC(y, m - 4, day)).toISOString().slice(0, 10);
    if (d.criminal_record_date < threeMonthsAgo)
      out.push({ text: "Criminal record certificate is older than 3 months. Upload a new one.", blocking: false });
  }
  return out;
}

/** Approved and documents current: the database lets this driver bid on trips. */
export function canTakeTrips(d: DriverRecord, today: string): boolean {
  return (
    d.kyc_status === "approved" &&
    !!d.license_expiry && !!d.ins_insurance_expiry && d.marchamo_year !== null &&
    !expiryIssues(d, today, today).some((i) => i.blocking)
  );
}

export const STATUS_LABEL: Record<KycStatus, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Not approved",
  suspended: "Suspended",
};
