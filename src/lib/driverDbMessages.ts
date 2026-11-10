import type { TeamLang } from "@/lib/teamLang";

/**
 * Spanish for the plain-language messages the database functions raise to
 * drivers (offer_job, driver_set_trip_status, …; supabase/migrations). The
 * database keeps English; the driver portal shows these in Spanish by default.
 * Unknown messages are returned unchanged.
 */
const EXACT: Record<string, string> = {
  "Pick one of your approved vehicles with current documents.":
    "Elija uno de sus vehículos aprobados con documentos vigentes.",
  "Please keep phone numbers, emails and links out of the note.":
    "Por favor no incluya teléfonos, correos ni enlaces en la nota.",
  "Start the trip before completing it.": "Inicie el viaje antes de completarlo.",
  "That vehicle's new documents are being checked. Pick another vehicle, or wait for our team to approve them.":
    "Estamos revisando los documentos nuevos de ese vehículo. Elija otro vehículo o espere a que nuestro equipo los apruebe.",
  "This job is in the past.": "Este trabajo ya pasó.",
  "This job is no longer open.": "Este trabajo ya no está disponible.",
  "This trip is not assigned to you.": "Este viaje no está asignado a usted.",
  "You can start heading to the pickup from 6 hours before the pickup time.":
    "Puede salir hacia la recogida desde 6 horas antes de la hora de recogida.",
  "You can start the trip from 3 hours before the pickup time.":
    "Puede iniciar el viaje desde 3 horas antes de la hora de recogida.",
  "You marked that day as unavailable. Unblock it in your calendar to offer on this job.":
    "Usted marcó ese día como no disponible. Desbloquéelo en su calendario para ofertar en este trabajo.",
  "Your driver account is not approved for trips yet.": "Su cuenta de conductor todavía no está aprobada para viajes.",
  "Your driver account is not approved for trips.": "Su cuenta de conductor no está aprobada para viajes.",
  "Your new documents are being checked. You can send offers again once our team approves them.":
    "Estamos revisando sus documentos nuevos. Podrá enviar ofertas de nuevo cuando nuestro equipo los apruebe.",
};

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Offers must be between \$(\S+) and \$(\S+?)\.?$/, (m) => `Las ofertas deben estar entre $${m[1]} y $${m[2]}.`],
  [/^That vehicle has (\d+) seats; this group needs (\d+)\.$/, (m) => `Ese vehículo tiene ${m[1]} asientos; este grupo necesita ${m[2]}.`],
  [/^This trip can't be started \(it is (.+)\)\.$/, (m) => `Este viaje no se puede iniciar (está en estado: ${m[1]}).`],
];

export function driverDbMessage(msg: string, lang: TeamLang): string {
  if (lang === "en") return msg;
  if (EXACT[msg]) return EXACT[msg];
  for (const [re, fn] of PATTERNS) {
    const m = msg.match(re);
    if (m) return fn(m);
  }
  return msg;
}
