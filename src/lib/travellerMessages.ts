/**
 * Everything we SEND to a traveller, in the language of their trip request
 * (trips.language, migration 0033): each email and push notification is built
 * here, once, with the English and Spanish text side by side as
 * t(lang, "English", "Español"). English is the wording travellers have always
 * received; Spanish is neutral Latin American Spanish with "usted" and "conductor".
 *
 * Emails to the team and to drivers are not here (they stay as they are).
 * No server-only imports: `node scripts/preview-traveller-messages.mjs` prints every message.
 */
import { formatTime12h, formatYmdFor } from "./dates";
import { t, type PublicLang } from "./publicLang";

export interface TravellerEmail {
  subject: string;
  lines: string[];
  button: { label: string; url: string };
  lang: PublicLang;
}

export interface TravellerPush {
  title: string;
  body: string;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** "Hi Ana," / "Hola Ana," from the full name on the trip. */
export function greeting(lang: PublicLang, fullName: string | null | undefined): string {
  const first = (fullName ?? "").split(" ")[0];
  return t(lang, `Hi ${first || "there"},`, first ? `Hola ${first},` : "Hola,");
}

/** The driver's first name, or "Your driver" / "Su conductor" when we don't have it. */
export function driverFirstName(lang: PublicLang, fullName: string | null | undefined, capital = true): string {
  const first = (fullName ?? "").split(" ")[0];
  if (first) return first;
  return capital ? t(lang, "Your driver", "Su conductor") : t(lang, "your driver", "su conductor");
}

/** One small line for team and driver notifications; nothing for English trips. */
export function clientLanguageNote(lang: PublicLang): string {
  return lang === "es" ? "Client language: Spanish (idioma del cliente: español)." : "";
}

// --- Trip request received ---------------------------------------------------

export interface RequestItem {
  ref: string | undefined;
  /** YYYY-MM-DD and HH:MM, Costa Rica time. */
  date: string;
  time: string;
  kind: "transfer" | "day_tour" | "expedition";
  /** Ride: "A → B"; tour or expedition: its name. */
  what: string;
}

/** One line per item, e.g. "CRPT-10492 · 2026-11-22, 9:00 AM pickup · Ride: SJO Airport → Manuel Antonio". */
export function requestItemLine(lang: PublicLang, i: RequestItem): string {
  const ride = i.kind === "transfer";
  const what = ride
    ? t(lang, `Ride: ${i.what}`, `Traslado: ${i.what}`)
    : i.kind === "day_tour"
      ? t(lang, `Day tour: ${i.what}`, `Tour de un día: ${i.what}`)
      : t(lang, `Expedition: ${i.what}`, `Expedición: ${i.what}`);
  const when = t(
    lang,
    `${i.date}, ${formatTime12h(i.time)} ${ride ? "pickup" : "start (to confirm)"}`,
    `${formatYmdFor(i.date, "es")}, ${ride ? "recogida" : "inicio"} a las ${formatTime12h(i.time, "es")}${ride ? "" : " (por confirmar)"}`,
  );
  return [i.ref, when, what].filter(Boolean).join(" · ");
}

export function requestPaymentLine(
  lang: PublicLang,
  p: { cashCents: number; onlineCents: number; feeTotalCents: number; feePercent: string },
): string {
  if (p.cashCents > 0) {
    return t(
      lang,
      `Payment: cash to your driver, ${money(p.cashCents)} (includes a ${p.feePercent} cash booking fee of ${money(p.feeTotalCents)})${
        p.onlineCents > 0 ? `; ${money(p.onlineCents)} online in full for the expedition, by secure link once confirmed` : ""
      }.`,
      `Pago: efectivo al conductor, ${money(p.cashCents)} (incluye un cargo por reserva en efectivo del ${p.feePercent}, de ${money(p.feeTotalCents)})${
        p.onlineCents > 0
          ? `; ${money(p.onlineCents)} en línea, pago completo, por la expedición, mediante un enlace de pago seguro una vez confirmada`
          : ""
      }.`,
    );
  }
  return t(
    lang,
    `Payment: online in full, ${money(p.onlineCents)}. We send you a secure payment link once your trip is confirmed.`,
    `Pago: en línea, pago completo, ${money(p.onlineCents)}. Le enviamos un enlace de pago seguro una vez que su viaje esté confirmado.`,
  );
}

export function tripRequestEmail(
  lang: PublicLang,
  a: { guestName: string; refs: string[]; itemLines: string[]; paymentLine: string; tripUrl: string },
): TravellerEmail {
  const refs = a.refs.join(", ");
  return {
    lang,
    subject: t(lang, `We got your trip request (${refs})`, `Recibimos su solicitud de viaje (${refs})`),
    lines: [
      greeting(lang, a.guestName),
      t(
        lang,
        `Thanks for your request! Our team is checking availability and will confirm your pickup times. Nothing has been charged.`,
        `¡Gracias por su solicitud! Nuestro equipo está verificando la disponibilidad y le confirmará sus horas de recogida. No se le ha cobrado nada.`,
      ),
      t(
        lang,
        `Your booking reference${a.refs.length > 1 ? "s" : ""}: ${refs}.`,
        `${a.refs.length > 1 ? "Sus códigos de reserva" : "Su código de reserva"}: ${refs}.`,
      ),
      ...a.itemLines,
      a.paymentLine,
      t(
        lang,
        "Times are Costa Rica time. Your trip page has your bookings and a chat with our team. Your driver's profile and car photos appear there once confirmed.",
        "Las horas son hora de Costa Rica. En la página de su viaje están sus reservas y un chat con nuestro equipo. El perfil de su conductor y las fotos del vehículo aparecen allí una vez confirmado.",
      ),
    ],
    button: { label: t(lang, "Open your trip page", "Abrir la página de su viaje"), url: a.tripUrl },
  };
}

// --- Ride confirmed (a driver's offer was accepted) ---------------------------

interface Confirmed {
  guestName: string | null | undefined;
  /** driverFirstName(lang, …). */
  driver: string;
  ref: string;
  /** Already in `lang` (placeNameFor). */
  origin: string;
  destination: string;
  /** formatScheduledAtFor(…, lang). */
  when: string;
  tripUrl: string;
}

export function rideConfirmedPush(lang: PublicLang, a: Pick<Confirmed, "driver" | "when">): TravellerPush {
  return {
    title: t(lang, "Your ride is confirmed", "Su traslado está confirmado"),
    body: t(lang, `${a.driver} will drive you · ${a.when}`, `${a.driver} será su conductor · ${a.when}`),
  };
}

export function rideConfirmedEmail(lang: PublicLang, a: Confirmed): TravellerEmail {
  return {
    lang,
    subject: t(lang, `Your ride is confirmed (${a.ref}) · ${a.when}`, `Su traslado está confirmado (${a.ref}) · ${a.when}`),
    lines: [
      greeting(lang, a.guestName),
      t(
        lang,
        `Good news: ${a.driver} will drive you, ${a.origin} → ${a.destination}, pickup ${a.when} (Costa Rica time).`,
        `Buenas noticias: ${a.driver} será su conductor, ${a.origin} → ${a.destination}, recogida: ${a.when} (hora de Costa Rica).`,
      ),
      t(
        lang,
        "Your trip page shows your driver's profile and car photos, and has a chat with them and our team.",
        "La página de su viaje muestra el perfil de su conductor y las fotos del vehículo, y tiene un chat con su conductor y con nuestro equipo.",
      ),
    ],
    button: { label: t(lang, "Open your trip page", "Abrir la página de su viaje"), url: a.tripUrl },
  };
}

// --- Driver on the way ---------------------------------------------------------

export function onTheWayPush(lang: PublicLang, a: { driver: string; when: string }): TravellerPush {
  return {
    title: t(lang, `${a.driver} is on the way`, `${a.driver} va en camino`),
    body: t(lang, `Pickup ${a.when}`, `Recogida: ${a.when}`),
  };
}

export function onTheWayEmail(
  lang: PublicLang,
  a: { guestName: string | null | undefined; driver: string; ref: string; when: string; tripUrl: string },
): TravellerEmail {
  return {
    lang,
    subject: t(lang, `${a.driver} is on the way (${a.ref})`, `${a.driver} va en camino (${a.ref})`),
    lines: [
      greeting(lang, a.guestName),
      t(
        lang,
        `${a.driver}, your driver, is on the way to your pickup at ${a.when} (Costa Rica time).`,
        `${a.driver}, su conductor, va en camino a su recogida: ${a.when} (hora de Costa Rica).`,
      ),
      t(
        lang,
        "Your trip page has their profile and car, and a chat with them and our team.",
        "En la página de su viaje están su perfil y su vehículo, y un chat con su conductor y con nuestro equipo.",
      ),
    ],
    button: { label: t(lang, "Open your trip page", "Abrir la página de su viaje"), url: a.tripUrl },
  };
}

// --- Rating request and its single reminder ------------------------------------

interface Review {
  guestName: string | null | undefined;
  /** driverFirstName(lang, …, false). */
  driver: string;
  ref: string;
  /** A ride (transfer), or a tour / expedition. */
  ride: boolean;
  origin: string;
  destination: string;
  tripUrl: string;
}

export function reviewRequestPush(lang: PublicLang, a: Pick<Review, "driver" | "ride">): TravellerPush {
  return {
    title: t(
      lang,
      `How was your ${a.ride ? "ride" : "trip"} with ${a.driver}?`,
      `¿Cómo estuvo su ${a.ride ? "traslado" : "viaje"} con ${a.driver}?`,
    ),
    body: t(lang, "Tap to rate. It takes 10 seconds.", "Toque para calificar. Toma 10 segundos."),
  };
}

export function reviewRequestEmail(lang: PublicLang, a: Review): TravellerEmail {
  return {
    lang,
    subject: t(
      lang,
      `How was your ${a.ride ? "ride" : "trip"} with ${a.driver}? (${a.ref})`,
      `¿Cómo estuvo su ${a.ride ? "traslado" : "viaje"} con ${a.driver}? (${a.ref})`,
    ),
    lines: [
      greeting(lang, a.guestName),
      t(
        lang,
        `We hope you enjoyed your ${a.ride ? `ride ${a.origin} → ${a.destination}` : "trip"}. Could you take a moment to rate ${a.driver}? It takes 10 seconds, and a few words help even more: our best-rated drivers get more trips.`,
        `Esperamos que haya disfrutado su ${a.ride ? `traslado ${a.origin} → ${a.destination}` : "viaje"}. ¿Podría tomarse un momento para calificar a ${a.driver}? Toma 10 segundos, y unas palabras ayudan aún más: nuestros conductores mejor calificados reciben más viajes.`,
      ),
    ],
    button: { label: t(lang, `Rate ${a.driver}`, `Calificar a ${a.driver}`), url: a.tripUrl },
  };
}

export function reviewReminderEmail(lang: PublicLang, a: Review): TravellerEmail {
  return {
    lang,
    subject: t(lang, `A quick one: how was ${a.driver}? (${a.ref})`, `Una consulta rápida: ¿qué tal le fue con ${a.driver}? (${a.ref})`),
    lines: [
      greeting(lang, a.guestName),
      t(
        lang,
        `Just a gentle reminder in case it slipped by: could you rate ${a.driver} for your ${
          a.ride ? `ride ${a.origin} → ${a.destination}` : "trip"
        }? It takes 10 seconds. A few words help even more: our best-rated drivers get more trips.`,
        `Solo un recordatorio amable, por si se le pasó: ¿podría calificar a ${a.driver} por su ${
          a.ride ? `traslado ${a.origin} → ${a.destination}` : "viaje"
        }? Toma 10 segundos. Unas palabras ayudan aún más: nuestros conductores mejor calificados reciben más viajes.`,
      ),
      t(lang, "This is the only reminder we'll send.", "Este es el único recordatorio que le enviaremos."),
    ],
    button: { label: t(lang, `Rate ${a.driver}`, `Calificar a ${a.driver}`), url: a.tripUrl },
  };
}

// --- New chat message (to the traveller) ----------------------------------------

export function chatMessageEmail(
  lang: PublicLang,
  a: { guestName: string | null | undefined; ref: string; from: "team" | "driver"; snippet: string; chatUrl: string },
): TravellerEmail {
  const from = a.from === "team" ? t(lang, "our team", "nuestro equipo") : t(lang, "your driver", "su conductor");
  return {
    lang,
    subject: t(lang, `New message about your trip ${a.ref}`, `Nuevo mensaje sobre su viaje ${a.ref}`),
    lines: [
      greeting(lang, a.guestName),
      t(lang, `You have a new message from ${from}:`, `Tiene un nuevo mensaje de ${from}:`),
      `“${a.snippet}”`,
      t(
        lang,
        "Reply in the trip chat (please don't reply to this email).",
        "Responda en el chat del viaje (por favor, no responda a este correo).",
      ),
    ],
    button: { label: t(lang, "Open the chat", "Abrir el chat"), url: a.chatUrl },
  };
}
