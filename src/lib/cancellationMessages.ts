/**
 * Emails sent when the TEAM cancels a booking from the booking page with
 * "Avisar al viajero y al conductor" ticked (Jorge, 2026-11-12: by email):
 *   - the traveller, in their booking language (trips.language; Spanish with "usted");
 *   - the assigned driver, in their language (profiles.app_lang, Spanish by default). The driver's
 *     email never holds the traveller's name, phone, email or anything about price or refunds.
 * And the team alert when a driver is removed from a booking (Spanish, to ADMIN_NOTIFY_EMAIL).
 *
 * Plain TypeScript without imports, so `npm run test:crm` runs it with Node.
 */

export interface MailText {
  subject: string;
  lines: string[];
  button?: { label: string; url: string };
  lang: "en" | "es";
}

const usd = (n: number) => `$${n.toFixed(2)}`;
const firstName = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] ?? "";

export interface TravellerCancel {
  lang: "en" | "es";
  guestName: string | null;
  ref: string;
  /** "SJO Airport → Manuel Antonio" or the tour, in `lang`. */
  what: string;
  /** The pickup, formatted in `lang`. */
  when: string;
  by: "traveller" | "team" | "driver" | "weather";
  amountReceived: number;
  refundDue: number;
  tripUrl: string | null;
}

export function travellerCancelEmail(c: TravellerCancel): MailText {
  const es = c.lang === "es";
  const n = firstName(c.guestName);
  const hi = es ? (n ? `Hola ${n},` : "Hola,") : `Hi ${n || "there"},`;
  const why =
    c.by === "traveller"
      ? es ? "como nos pidió" : "as you asked"
      : c.by === "weather"
        ? es ? "por el clima o por el estado de las carreteras o del parque" : "because of weather, road or park conditions"
        : "";
  const main = es
    ? `Su reserva ${c.ref} (${c.what}, ${c.when}, hora de Costa Rica) quedó cancelada${why ? ` ${why}` : ""}.`
    : `Your booking ${c.ref} (${c.what}, ${c.when}, Costa Rica time) has been cancelled${why ? ` ${why}` : ""}.`;
  const sorry =
    c.by === "team" || c.by === "driver"
      ? es
        ? "Lamentamos mucho tener que cancelarla."
        : "We're very sorry we had to cancel it."
      : c.by === "weather"
        ? es
          ? "Si prefiere otra fecha, respóndanos y con gusto la cambiamos."
          : "If you'd rather go on another date, just reply and we'll gladly rebook it."
        : "";
  const money =
    c.refundDue > 0
      ? es
        ? `Le reembolsaremos ${usd(c.refundDue)} por el mismo medio con que pagó, y le avisaremos cuando se haya enviado.`
        : `We'll refund ${usd(c.refundDue)} to the way you paid, and let you know once it has been sent.`
      : c.amountReceived > 0
        ? es
          ? "Según nuestra política de cancelación, esta cancelación no tiene reembolso."
          : "Under our cancellation policy, this cancellation isn't refunded."
        : "";
  return {
    lang: c.lang,
    subject: es ? `Su reserva ${c.ref} quedó cancelada` : `Your booking ${c.ref} is cancelled`,
    lines: [
      hi,
      main,
      sorry,
      money,
      es
        ? "Si tiene alguna pregunta, escríbanos en el chat de su viaje o por WhatsApp."
        : "If you have any questions, write to us in your trip chat or on WhatsApp.",
    ].filter(Boolean),
    ...(c.tripUrl ? { button: { label: es ? "Abrir la página de su viaje" : "Open your trip page", url: c.tripUrl } } : {}),
  };
}

export interface DriverCancel {
  lang: "en" | "es";
  driverName: string | null;
  ref: string;
  /** Towns only, e.g. "SJO Airport → Manuel Antonio". */
  route: string;
  /** The pickup, formatted in `lang`. */
  when: string;
  tripsUrl: string;
}

/** To the assigned driver: the trip is off. No traveller details, no price, no refund. */
export function driverCancelEmail(d: DriverCancel): MailText {
  const es = d.lang === "es";
  const n = firstName(d.driverName);
  return {
    lang: d.lang,
    subject: es ? `Viaje cancelado: ${d.ref} · ${d.when}` : `Trip cancelled: ${d.ref} · ${d.when}`,
    lines: [
      es ? (n ? `Hola ${n}:` : "Hola:") : `Hi ${n || "there"},`,
      es
        ? `El viaje ${d.ref} (${d.route}, recogida ${d.when}, hora de Costa Rica) fue cancelado. Ya no tiene que hacerlo.`
        : `The trip ${d.ref} (${d.route}, pickup ${d.when}, Costa Rica time) was cancelled. You no longer need to drive it.`,
      es
        ? "Si tiene alguna pregunta, escríbale a nuestro equipo por WhatsApp."
        : "If you have any questions, message our team on WhatsApp.",
    ],
    button: { label: es ? "Ver mis viajes" : "See my trips", url: d.tripsUrl },
  };
}

/**
 * To a driver the TEAM removed from a trip (Jorge, 2026-11-12): short and neutral, no reason, no
 * traveller details, no price. Not sent when the driver cancelled (they already know).
 */
export function driverReassignedEmail(d: DriverCancel): MailText {
  const es = d.lang === "es";
  const n = firstName(d.driverName);
  return {
    lang: d.lang,
    subject: es ? `Viaje reasignado: ${d.ref} · ${d.when}` : `Trip reassigned: ${d.ref} · ${d.when}`,
    lines: [
      es ? (n ? `Hola ${n}:` : "Hola:") : `Hi ${n || "there"},`,
      es
        ? `El viaje ${d.ref} (${d.route}, recogida ${d.when}, hora de Costa Rica) fue reasignado. Ya no tiene que hacerlo.`
        : `The trip ${d.ref} (${d.route}, pickup ${d.when}, Costa Rica time) was reassigned. You no longer need to drive it.`,
      es ? "Gracias. Si tiene alguna pregunta, escríbale a nuestro equipo por WhatsApp." : "Thank you. If you have any questions, message our team on WhatsApp.",
    ],
    button: { label: es ? "Ver mis viajes" : "See my trips", url: d.tripsUrl },
  };
}

export interface DriverRemovedAlert {
  ref: string;
  route: string;
  when: string;
  driver: string;
  reason: "driver_dropped" | "team";
  /** True when the booking went back to "open for drivers". */
  reopened: boolean;
  replacedBy: string | null;
  bookingUrl: string;
}

/** To the team (Spanish): a driver was removed from a booking. */
export function driverRemovedTeamEmail(a: DriverRemovedAlert): MailText {
  return {
    lang: "es",
    subject: `Conductor retirado: ${a.ref} · ${a.when}`,
    lines: [
      `${a.driver} ya no está asignado a la reserva ${a.ref} (${a.route}, recogida ${a.when}, hora de Costa Rica).`,
      `Motivo: ${a.reason === "driver_dropped" ? "el conductor canceló o se retiró" : "decisión del equipo"}.`,
      a.replacedBy
        ? `Nuevo conductor: ${a.replacedBy}. El viajero recibe el correo de «conductor confirmado».`
        : a.reopened
          ? "La reserva volvió a «Abierta para conductores» y los conductores reciben el aviso del trabajo. Asigne a otro conductor."
          : "La reserva no tiene conductor: asigne a otro.",
      "Al viajero NO se le avisó del cambio. Solo recibe el correo de «conductor confirmado» cuando haya un conductor nuevo.",
    ],
    button: { label: "Abrir la reserva", url: a.bookingUrl },
  };
}
