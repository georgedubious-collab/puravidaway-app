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
  /** Spanish wording for the driver portal and team pages (default language there). */
  labelEs: string;
  hintEs?: string;
  required: boolean;
}

/** A document's name in the page language. */
export function docLabel(doc: DocSpec, lang: "en" | "es" = "en"): string {
  return lang === "es" ? doc.labelEs : doc.label;
}

export function docHint(doc: DocSpec, lang: "en" | "es" = "en"): string | undefined {
  return lang === "es" ? doc.hintEs : doc.hint;
}

/** Documents about the person. */
export const DRIVER_DOCS: DocSpec[] = [
  {
    key: "driver_photo", label: "Your photo",
    hint: "A clear, friendly photo of your face, no sunglasses. Travellers see it once you're confirmed for their trip.",
    labelEs: "Su foto",
    hintEs: "Una foto clara y amable de su cara, sin lentes de sol. Los clientes la ven cuando usted queda confirmado para su viaje.",
    required: true,
  },
  { key: "id_front", label: "Cédula or passport: front", labelEs: "Cédula o pasaporte: frente", required: true },
  {
    key: "id_back", label: "Cédula: back", hint: "For a passport, upload the photo page again.",
    labelEs: "Cédula: reverso", hintEs: "Si es pasaporte, suba de nuevo la página de la foto.", required: true,
  },
  {
    key: "license", label: "Driver's licence", hint: "Front and back in one photo or PDF.",
    labelEs: "Licencia de conducir", hintEs: "Frente y reverso en una sola foto o PDF.", required: true,
  },
  {
    key: "criminal_record", label: "Criminal record certificate (hoja de delincuencia)", hint: "Issued no more than 30 days ago.",
    labelEs: "Hoja de delincuencia", hintEs: "Emitida hace 30 días o menos.", required: true,
  },
  {
    key: "ict_permit", label: "ICT tourist-transport permit", hint: "Optional. Drivers who have it get an ICT badge.",
    labelEs: "Permiso ICT de transporte de turismo", hintEs: "Opcional. Los conductores que lo tienen reciben una insignia ICT.", required: false,
  },
];

/** Documents about each vehicle (photos are a separate list). */
export const VEHICLE_DOCS: DocSpec[] = [
  {
    key: "insurance", label: "INS insurance policy", hint: "Showing this vehicle and the valid dates.",
    labelEs: "Póliza de seguro del INS", hintEs: "Donde se vean este vehículo y las fechas de vigencia.", required: true,
  },
  {
    key: "dekra", label: "Dekra / RTV inspection", hint: "Current certificate.",
    labelEs: "Revisión Dekra / RTV", hintEs: "Certificado vigente.", required: true,
  },
  { key: "marchamo", label: "Marchamo (current year)", labelEs: "Marchamo (año en curso)", required: true },
  { key: "vehicle_registration", label: "Registration (tarjeta de circulación)", labelEs: "Tarjeta de circulación", required: true },
];

/** Photo count rules live with the other photo rules (no imports there, so tests run it directly). */
export { MAX_VEHICLE_PHOTOS, MIN_VEHICLE_PHOTOS } from "./vehiclePhotos";

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
  bio: string | null;
  english_level: "fluent" | "basic" | null;
  /** Town / area the driver is based in (hub id or "SouthNicoya"), migration 0018. */
  home_hub?: string | null;
  /** Travellers' ratings, weighted (a review with a comment counts double), migration 0019. */
  rating_avg?: number | string | null;
  rating_count?: number | null;
  kyc_status: KycStatus;
  kyc_note: string | null;
  needs_review: boolean;
  /** A replaced key document is waiting for the team's check: no new offers (migration 0031). */
  review_hold?: boolean;
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
  /** Category our team gave the vehicle (migration 0038); null = not tagged yet, receives every job. */
  vehicle_class?: string | null;
  /** Marked electric by our team (migration 0042). Not a category, same price; travellers see a badge. */
  is_electric?: boolean | null;
  ins_policy_number: string | null;
  ins_insurance_expiry: string | null;
  dekra_inspection_expiry: string | null;
  marchamo_year: number | null;
  has_wifi: boolean;
  child_seats: number;
  stroller_space: boolean;
  pet_friendly: boolean;
  documents: Record<string, string>;
  photos: string[];
  status: KycStatus;
  note: string | null;
  needs_review: boolean;
  /** A replaced vehicle document, date or plate is waiting for the team's check (migration 0031). */
  review_hold?: boolean;
  reviewed_at: string | null;
}

/** Shown to a driver whose replaced documents are waiting for the team's check. */
export const HOLD_MESSAGE =
  "Your new documents are being checked. You can send offers again once our team approves them; trips you already have are not affected.";
export const HOLD_MESSAGE_ES =
  "Estamos revisando sus documentos nuevos. Podrá enviar ofertas de nuevo cuando nuestro equipo los apruebe; los viajes que ya tiene no se ven afectados.";

/**
 * Dated documents that must be RE-UPLOADED when renewed: after the first
 * review, the date changes only together with the new file (the database
 * enforces this too).
 */
export type RenewField = "license_expiry" | "ins_insurance_expiry" | "dekra_inspection_expiry" | "marchamo_year";
export const RENEWABLE: Record<string, { field: RenewField; ask: string; askEs: string; kind: "date" | "year" }> = {
  license: { field: "license_expiry", ask: "New expiry date", askEs: "Nueva fecha de vencimiento", kind: "date" },
  insurance: { field: "ins_insurance_expiry", ask: "Policy valid until", askEs: "Póliza vigente hasta", kind: "date" },
  dekra: { field: "dekra_inspection_expiry", ask: "Valid until", askEs: "Vigente hasta", kind: "date" },
  marchamo: { field: "marchamo_year", ask: "Year it covers", askEs: "Año que cubre", kind: "year" },
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

export function missingDriverDetails(d: DriverRecord, lang: "en" | "es" = "en"): string[] {
  const t = (es: string, en: string) => (lang === "es" ? es : en);
  const out: string[] = [];
  if (!d.cedula_number) out.push(t("Número de cédula / pasaporte", "Cédula / passport number"));
  if (!d.license_number) out.push(t("Número de licencia", "Licence number"));
  if (!d.license_expiry) out.push(t("Vencimiento de la licencia", "Licence expiry"));
  if (!d.criminal_record_date) out.push(t("Fecha de la hoja de delincuencia", "Criminal record certificate date"));
  if (!d.english_level) out.push(t("Su nivel de inglés", "Your English level"));
  if (!d.bio || d.bio.trim().length < 40)
    out.push(t("Una breve presentación para los clientes (al menos 40 caracteres)", "A short bio for travellers (at least 40 characters)"));
  return out;
}

/** Licence validity, and for applicants the age of the criminal record certificate. */
export function driverIssues(d: DriverRecord, today: string, soon: string, lang: "en" | "es" = "en"): Issue[] {
  const es = lang === "es";
  const out: Issue[] = [];
  if (d.license_expiry) {
    if (d.license_expiry < today)
      out.push({
        text: es
          ? `La licencia de conducir venció el ${d.license_expiry}. Suba la licencia renovada para volver a recibir viajes.`
          : `Driver's licence expired ${d.license_expiry}. Upload the renewed licence to receive trips again.`,
        blocking: true,
      });
    else if (d.license_expiry <= soon)
      out.push({
        text: es
          ? `La licencia de conducir vence el ${d.license_expiry}. Suba la renovada antes de esa fecha; no hay periodo de gracia.`
          : `Driver's licence expires ${d.license_expiry}. Upload the renewed one before then; there is no grace period.`,
        blocking: false,
      });
  }
  if (d.kyc_status === "pending" && d.criminal_record_date && criminalRecordTooOld(d.criminal_record_date, today)) {
    out.push({
      text: es
        ? `La hoja de delincuencia es del ${d.criminal_record_date}. Debe tener como máximo ${CRIMINAL_RECORD_MAX_AGE_DAYS} días al momento de la aprobación; suba una nueva.`
        : `Criminal record certificate is from ${d.criminal_record_date}. It must be issued no more than ${CRIMINAL_RECORD_MAX_AGE_DAYS} days before approval; upload a new one.`,
      blocking: true,
    });
  }
  return out;
}

export function criminalRecordTooOld(issued: string, today: string): boolean {
  return issued < addDaysYmd(today, -CRIMINAL_RECORD_MAX_AGE_DAYS);
}

/* ---------------------------- vehicles ---------------------------------- */

export function missingVehicleItems(v: VehicleRecord, lang: "en" | "es" = "en"): string[] {
  const t = (es: string, en: string) => (lang === "es" ? es : en);
  const out: string[] = [];
  if (!v.plate) out.push(t("Número de placa", "Plate number"));
  if (!v.make_model) out.push(t("Marca y modelo", "Make and model"));
  if (!v.year) out.push(t("Año", "Year"));
  if (!v.passenger_capacity) out.push(t("Asientos para pasajeros", "Passenger seats"));
  if (!v.ins_insurance_expiry) out.push(t("Fecha de vigencia del seguro", "Insurance valid-until date"));
  if (!v.dekra_inspection_expiry) out.push(t("Fecha de vigencia de Dekra", "Dekra valid-until date"));
  if (!v.marchamo_year) out.push(t("Año del Marchamo", "Marchamo year"));
  for (const doc of VEHICLE_DOCS) if (doc.required && !v.documents?.[doc.key]) out.push(docLabel(doc, lang));
  const photos = v.photos?.length ?? 0;
  if (photos < MIN_VEHICLE_PHOTOS)
    out.push(
      t(
        `Fotos (al menos ${MIN_VEHICLE_PHOTOS}, una donde se vea la placa)`,
        `Photos (at least ${MIN_VEHICLE_PHOTOS}, one showing the licence plate)`,
      ),
    );
  return out;
}

/** Mirrors vehicle_documents_current() in the database. */
export function vehicleIssues(v: VehicleRecord, today: string, soon: string, lang: "en" | "es" = "en"): Issue[] {
  const es = lang === "es";
  const out: Issue[] = [];
  const year = Number(today.slice(0, 4));
  const name = v.plate || v.make_model || (es ? "Vehículo" : "Vehicle");

  if (v.ins_insurance_expiry) {
    const graceEnd = addDaysYmd(v.ins_insurance_expiry, INSURANCE_GRACE_DAYS);
    if (graceEnd < today)
      out.push({
        text: es
          ? `${name}: el seguro del INS venció el ${v.ins_insurance_expiry} y el periodo de gracia de ${INSURANCE_GRACE_DAYS} días terminó. Suba la póliza renovada.`
          : `${name}: INS insurance expired ${v.ins_insurance_expiry} and the ${INSURANCE_GRACE_DAYS}-day grace period is over. Upload the renewed policy.`,
        blocking: true,
      });
    else if (v.ins_insurance_expiry < today)
      out.push({
        text: es
          ? `${name}: el seguro del INS venció el ${v.ins_insurance_expiry}. Suba la póliza renovada a más tardar el ${graceEnd} o este vehículo dejará de recibir viajes.`
          : `${name}: INS insurance expired ${v.ins_insurance_expiry}. Upload the renewed policy by ${graceEnd} or this vehicle stops getting trips.`,
        blocking: false,
      });
    else if (v.ins_insurance_expiry <= soon)
      out.push({
        text: es
          ? `${name}: el seguro del INS vence el ${v.ins_insurance_expiry}. Suba la póliza renovada cuando la tenga.`
          : `${name}: INS insurance expires ${v.ins_insurance_expiry}. Upload the renewed policy when you have it.`,
        blocking: false,
      });
  }
  if (v.dekra_inspection_expiry) {
    if (v.dekra_inspection_expiry < today)
      out.push({
        text: es
          ? `${name}: la Dekra venció el ${v.dekra_inspection_expiry}. Suba el certificado nuevo.`
          : `${name}: Dekra expired ${v.dekra_inspection_expiry}. Upload the new certificate.`,
        blocking: true,
      });
    else if (v.dekra_inspection_expiry <= soon)
      out.push({
        text: es
          ? `${name}: la Dekra vence el ${v.dekra_inspection_expiry}. Suba el certificado nuevo antes de esa fecha; no hay periodo de gracia.`
          : `${name}: Dekra expires ${v.dekra_inspection_expiry}. Upload the new certificate before then; there is no grace period.`,
        blocking: false,
      });
  }
  if (v.marchamo_year !== null) {
    if (v.marchamo_year < year)
      out.push({
        text: es
          ? `${name}: el Marchamo ${v.marchamo_year} está vencido. Suba el Marchamo ${year}.`
          : `${name}: Marchamo ${v.marchamo_year} is out of date. Upload the ${year} Marchamo.`,
        blocking: true,
      });
    else if (v.marchamo_year === year && today.slice(5) >= "12-01")
      out.push({
        text: es
          ? `${name}: el Marchamo ${year + 1} se debe pagar a más tardar el 31 de diciembre. Súbalo en cuanto esté pagado.`
          : `${name}: Marchamo ${year + 1} is due by December 31. Upload it as soon as it's paid.`,
        blocking: false,
      });
  }
  return out;
}

/** Can this vehicle be offered on new jobs? Road-legal and not waiting for a document check. */
export function vehicleRoadLegal(v: VehicleRecord, today: string): boolean {
  return (
    !v.review_hold &&
    !!v.ins_insurance_expiry && !!v.dekra_inspection_expiry && v.marchamo_year !== null &&
    !vehicleIssues(v, today, today).some((i) => i.blocking)
  );
}

/** Can this driver take NEW jobs: approved, not on a document hold, licence current, ≥1 approved road-legal vehicle. */
export function canTakeTrips(d: DriverRecord, vehicles: VehicleRecord[], today: string): boolean {
  return (
    !d.review_hold &&
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

export const STATUS_LABEL_ES: Record<KycStatus, string> = {
  pending: "Esperando revisión",
  approved: "Aprobado",
  rejected: "No aprobado",
  suspended: "Suspendido",
};

export function kycStatusLabel(s: KycStatus, lang: "en" | "es" = "en"): string {
  return (lang === "es" ? STATUS_LABEL_ES : STATUS_LABEL)[s] ?? s;
}
