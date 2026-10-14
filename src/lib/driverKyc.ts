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

/**
 * Documents that are expired or expire within 30 days, as plain sentences.
 * `today` and `soon` are YYYY-MM-DD (Costa Rica time).
 */
export function expiryIssues(d: DriverRecord, today: string, soon: string): string[] {
  const year = Number(today.slice(0, 4));
  const check = (label: string, date: string | null) => {
    if (!date) return null;
    if (date < today) return `${label} expired ${date}`;
    if (date <= soon) return `${label} expires ${date}`;
    return null;
  };
  const issues = [
    check("Driver's licence", d.license_expiry),
    check("INS insurance", d.ins_insurance_expiry),
    check("Dekra inspection", d.dekra_inspection_expiry),
    d.marchamo_year !== null && d.marchamo_year < year ? `Marchamo ${d.marchamo_year} not renewed` : null,
  ];
  // The hoja de delincuencia should be recent when the driver applies.
  if (d.kyc_status === "pending" && d.criminal_record_date) {
    const [y, m, day] = today.split("-").map(Number);
    const threeMonthsAgo = new Date(Date.UTC(y, m - 4, day)).toISOString().slice(0, 10);
    if (d.criminal_record_date < threeMonthsAgo) issues.push("Criminal record certificate is older than 3 months");
  }
  return issues.filter((x): x is string => Boolean(x));
}

export const STATUS_LABEL: Record<KycStatus, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Not approved",
  suspended: "Suspended",
};
