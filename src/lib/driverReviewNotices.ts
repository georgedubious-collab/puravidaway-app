/**
 * What a driver is told when the team decides on their application or one of their vehicles
 * (Jorge, 2026-11-12: a driver added a vehicle and never knew whether it went through).
 * One push to the driver app + one email, in the driver's language (profiles.app_lang,
 * Spanish by default; "conductor", "usted"). Only about that driver's own account and vehicle.
 *
 * No imports, so `npm run test:admin` checks the wording. Sending is in driverReviewSend.ts.
 */

export type DriverNotice =
  | { kind: "driver_approved" }
  | { kind: "driver_rejected"; note: string | null }
  | { kind: "vehicle_approved"; vehicle: string }
  | { kind: "vehicle_rejected"; vehicle: string; note: string | null }
  | { kind: "vehicle_suspended"; vehicle: string; note: string | null }
  | { kind: "vehicle_category"; vehicle: string; category: string };

export interface NoticeText {
  /** Push title and body (short). */
  title: string;
  body: string;
  /** Email subject and paragraphs. */
  subject: string;
  lines: string[];
}

/** The team's message, if one was written, as its own line. */
function noteLine(note: string | null, lang: "es" | "en"): string[] {
  const n = (note ?? "").trim();
  if (!n) return [];
  return [lang === "en" ? `Message from our team: ${n}` : `Mensaje de nuestro equipo: ${n}`];
}

export function driverNoticeText(n: DriverNotice, lang: "es" | "en", firstName = ""): NoticeText {
  const en = lang === "en";
  const hi = en ? `Hi${firstName ? ` ${firstName}` : ""},` : `Hola${firstName ? ` ${firstName}` : ""}:`;
  const docs = en
    ? "You can see the details under Documents in the driver app."
    : "Puede ver el detalle en Documentos, en la app de conductores.";
  switch (n.kind) {
    case "driver_approved": {
      const body = en
        ? "Your driver application was approved. You can receive jobs once you have an approved vehicle."
        : "Su solicitud como conductor fue aprobada. Puede recibir trabajos cuando tenga un vehículo aprobado.";
      return { title: en ? "You're approved" : "Solicitud aprobada", body, subject: en ? "Your driver application was approved" : "Su solicitud como conductor fue aprobada", lines: [hi, body, docs] };
    }
    case "driver_rejected": {
      const body = en ? "Your driver application was not approved." : "Su solicitud como conductor no fue aprobada.";
      return {
        title: en ? "Application not approved" : "Solicitud no aprobada",
        body: [body, ...noteLine(n.note, lang)].join(" "),
        subject: en ? "Your driver application" : "Su solicitud como conductor",
        lines: [hi, body, ...noteLine(n.note, lang), docs],
      };
    }
    case "vehicle_approved": {
      const body = en
        ? `Your vehicle ${n.vehicle} was approved. You can now receive jobs with it.`
        : `Su vehículo ${n.vehicle} fue aprobado. Ya puede recibir trabajos.`;
      return { title: en ? "Vehicle approved" : "Vehículo aprobado", body, subject: en ? `Vehicle approved: ${n.vehicle}` : `Vehículo aprobado: ${n.vehicle}`, lines: [hi, body, docs] };
    }
    case "vehicle_rejected": {
      const body = en ? `Your vehicle ${n.vehicle} was not approved.` : `Su vehículo ${n.vehicle} no fue aprobado.`;
      return {
        title: en ? "Vehicle not approved" : "Vehículo no aprobado",
        body: [body, ...noteLine(n.note, lang)].join(" "),
        subject: en ? `Vehicle not approved: ${n.vehicle}` : `Vehículo no aprobado: ${n.vehicle}`,
        lines: [hi, body, ...noteLine(n.note, lang), docs],
      };
    }
    case "vehicle_suspended": {
      const body = en
        ? `Your vehicle ${n.vehicle} is on hold: it can't receive new jobs for now.`
        : `Su vehículo ${n.vehicle} quedó en pausa: por ahora no puede recibir trabajos nuevos.`;
      return {
        title: en ? "Vehicle on hold" : "Vehículo en pausa",
        body: [body, ...noteLine(n.note, lang)].join(" "),
        subject: en ? `Vehicle on hold: ${n.vehicle}` : `Vehículo en pausa: ${n.vehicle}`,
        lines: [hi, body, ...noteLine(n.note, lang), docs],
      };
    }
    case "vehicle_category": {
      const body = en
        ? `Your vehicle ${n.vehicle} is now in the ${n.category} category: you'll receive the jobs of that category.`
        : `Su vehículo ${n.vehicle} quedó en la categoría ${n.category}: recibirá los trabajos de esa categoría.`;
      return { title: en ? "Vehicle category set" : "Categoría del vehículo", body, subject: en ? `Vehicle category: ${n.vehicle}` : `Categoría del vehículo: ${n.vehicle}`, lines: [hi, body, docs] };
    }
  }
}

/** Which notice a decision deserves, or null (nothing changed, or "changes checked"). Sent once per change. */
export function driverDecisionNotice(before: string | null, decision: string, note: string | null): DriverNotice | null {
  if (decision === "approve" && before !== "approved") return { kind: "driver_approved" };
  if (decision === "reject" && before !== "rejected") return { kind: "driver_rejected", note };
  return null;
}

export function vehicleDecisionNotice(before: string | null, decision: string, vehicle: string, note: string | null): DriverNotice | null {
  if (decision === "approve" && before !== "approved") return { kind: "vehicle_approved", vehicle };
  if (decision === "reject" && before !== "rejected") return { kind: "vehicle_rejected", vehicle, note };
  if (decision === "suspend" && before !== "suspended") return { kind: "vehicle_suspended", vehicle, note };
  return null;
}

/** A vehicle's category set for the first time (it had none). */
export function firstCategoryNotice(beforeHadCategory: boolean, afterCategory: string | null, vehicle: string, label: string): DriverNotice | null {
  return !beforeHadCategory && afterCategory ? { kind: "vehicle_category", vehicle, category: label } : null;
}
