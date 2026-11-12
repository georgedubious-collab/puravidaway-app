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
  kind: "transfer" | "day_tour";
  /** Ride: "A → B"; tour: its name. */
  what: string;
}

/** One line per item, e.g. "CRPT-10492 · 2026-11-22, 9:00 AM pickup · Ride: SJO Airport → Manuel Antonio". */
export function requestItemLine(lang: PublicLang, i: RequestItem): string {
  const ride = i.kind === "transfer";
  const what = ride
    ? t(lang, `Ride: ${i.what}`, `Traslado: ${i.what}`)
    : t(lang, `Day tour: ${i.what}`, `Tour de un día: ${i.what}`);
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
        p.onlineCents > 0 ? `; ${money(p.onlineCents)} online in full, by secure link once confirmed` : ""
      }.`,
      `Pago: efectivo al conductor, ${money(p.cashCents)} (incluye un cargo por reserva en efectivo del ${p.feePercent}, de ${money(p.feeTotalCents)})${
        p.onlineCents > 0
          ? `; ${money(p.onlineCents)} en línea, pago completo, mediante un enlace de pago seguro una vez confirmado el viaje`
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
  a: {
    guestName: string;
    refs: string[];
    itemLines: string[];
    paymentLine: string;
    tripUrl: string;
    /** The request includes a ride (transfer): adds the line about the driver's name sign. */
    hasRide?: boolean;
  },
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
      a.hasRide ? signLine(lang) : "",
    ].filter(Boolean),
    button: { label: t(lang, "Open your trip page", "Abrir la página de su viaje"), url: a.tripUrl },
  };
}

// --- Ride confirmed (a driver's offer was accepted) ---------------------------

/** The driver's name sign (src/lib/sign.ts): true whatever the traveller chose to have written on it. */
function signLine(lang: PublicLang): string {
  return t(
    lang,
    "Your driver will wait for you holding a name sign. You can see and change what it says on your trip page until your driver is on the way.",
    "Su conductor lo esperará con un rótulo. En la página de su viaje puede ver y cambiar lo que dice, hasta que su conductor vaya en camino.",
  );
}

interface Confirmed {
  /** A ride (transfer): adds the line about the driver's name sign. Tours don't have one. */
  ride?: boolean;
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
      a.ride ? signLine(lang) : "",
    ].filter(Boolean),
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
  /** A ride (transfer), or a tour. */
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

/** The single reminder, 24 hours later, to travellers with the app (the email below goes out with it). */
export function reviewReminderPush(lang: PublicLang, a: Pick<Review, "driver" | "ride">): TravellerPush {
  return {
    title: t(
      lang,
      `A quick reminder: how was your ${a.ride ? "ride" : "trip"} with ${a.driver}?`,
      `Un recordatorio: ¿cómo estuvo su ${a.ride ? "traslado" : "viaje"} con ${a.driver}?`,
    ),
    body: t(
      lang,
      "Tap to rate with the stars. Words are optional. We won't remind you again.",
      "Toque para calificar con las estrellas. Escribir es opcional. No se lo recordaremos de nuevo.",
    ),
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
        }? It takes 10 seconds: the stars are enough, and a few words are welcome if you'd like to add them. Our best-rated drivers get more trips.`,
        `Solo un recordatorio amable, por si se le pasó: ¿podría calificar a ${a.driver} por su ${
          a.ride ? `traslado ${a.origin} → ${a.destination}` : "viaje"
        }? Toma 10 segundos: con las estrellas basta, y unas palabras son bienvenidas si desea agregarlas. Nuestros conductores mejor calificados reciben más viajes.`,
      ),
      t(lang, "This is the only reminder we'll send.", "Este es el único recordatorio que le enviaremos."),
    ],
    button: { label: t(lang, `Rate ${a.driver}`, `Calificar a ${a.driver}`), url: a.tripUrl },
  };
}

// --- New chat message (to the traveller) ----------------------------------------

export function chatMessageEmail(
  lang: PublicLang,
  a: {
    guestName: string | null | undefined;
    ref: string;
    from: "team" | "driver";
    snippet: string;
    chatUrl: string;
    /** Unread messages this email covers (one email per unread batch). */
    count?: number;
  },
): TravellerEmail {
  const from = a.from === "team" ? t(lang, "our team", "nuestro equipo") : t(lang, "your driver", "su conductor");
  const many = (a.count ?? 1) > 1;
  return {
    lang,
    subject: many
      ? t(lang, `${a.count} new messages about your trip ${a.ref}`, `${a.count} mensajes nuevos sobre su viaje ${a.ref}`)
      : t(lang, `New message about your trip ${a.ref}`, `Nuevo mensaje sobre su viaje ${a.ref}`),
    lines: [
      greeting(lang, a.guestName),
      many
        ? t(lang, `You have ${a.count} unread messages in your trip chat. The latest, from ${from}:`, `Tiene ${a.count} mensajes sin leer en el chat de su viaje. El último, de ${from}:`)
        : t(lang, `You have a new message from ${from}:`, `Tiene un nuevo mensaje de ${from}:`),
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

/** Push to the customer app for each new chat message. `from` is a first name or "Our team". */
export function chatMessagePush(lang: PublicLang, a: { from: string; snippet: string }): TravellerPush {
  return {
    title: t(lang, `New message from ${a.from}`, `Nuevo mensaje de ${a.from}`),
    body: a.snippet,
  };
}

// --- Day-before reminder (docs/PROJECT.md §4.7) -----------------------------------

export interface DayBefore {
  guestName: string | null | undefined;
  /** driverFirstName(lang, …). */
  driver: string;
  ref: string;
  /** A ride (transfer), or a day tour. */
  ride: boolean;
  /** Ride: the ends, already in `lang` (placeNameFor). Tour: its name in `origin`, `destination` empty. */
  origin: string;
  destination: string;
  /** formatScheduledAtFor(…, lang). */
  when: string;
  /**
   * The car exactly as the trip page shows it: "Toyota Fortuner 2022", colour, plate.
   * Null when no vehicle is assigned yet.
   */
  car: { name: string; color: string | null; plate: string | null } | null;
  /** What the name sign says (signShown); rides only. */
  sign: string | null;
  /** Pickup at the SJO or LIR airport: the meeting promise, in the site's words. */
  airport: boolean;
  /** Day tours: the hotel or address they gave (bookings.pickup_place); null when not given. */
  pickupPlace?: string | null;
  tripUrl: string;
}

/** "Toyota Fortuner 2022 · white · plate BCD123". */
function carLine(lang: PublicLang, car: NonNullable<DayBefore["car"]>): string {
  return [car.name, car.color, car.plate ? t(lang, `plate ${car.plate}`, `placa ${car.plate}`) : ""].filter(Boolean).join(" · ");
}

export function dayBeforePush(lang: PublicLang, a: Pick<DayBefore, "ride" | "when" | "driver" | "sign">): TravellerPush {
  return {
    title: t(lang, `Reminder: your ${a.ride ? "ride" : "day tour"} · ${a.when}`, `Recordatorio: su ${a.ride ? "traslado" : "tour"} · ${a.when}`),
    body: [
      t(lang, `${a.driver} will pick you up`, `${a.driver} lo recogerá`),
      a.sign ? t(lang, `sign: “${a.sign}”`, `rótulo: “${a.sign}”`) : "",
      t(lang, "tap for your trip", "toque para ver su viaje"),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function dayBeforeEmail(lang: PublicLang, a: DayBefore): TravellerEmail {
  const what = a.ride
    ? t(lang, `your ride ${a.origin} → ${a.destination}`, `su traslado ${a.origin} → ${a.destination}`)
    : t(lang, `your day tour: ${a.origin}`, `su tour de un día: ${a.origin}`);
  return {
    lang,
    subject: t(
      lang,
      `Reminder: ${a.ride ? "your ride" : "your day tour"} ${a.when} (${a.ref})`,
      `Recordatorio: ${a.ride ? "su traslado" : "su tour"} ${a.when} (${a.ref})`,
    ),
    lines: [
      greeting(lang, a.guestName),
      a.ride
        ? t(
            lang,
            `A quick reminder of ${what}. Pickup: ${a.when} (Costa Rica time), at ${a.origin}.`,
            `Un breve recordatorio de ${what}. Recogida: ${a.when} (hora de Costa Rica), en ${a.origin}.`,
          )
        : a.pickupPlace
          ? t(
              lang,
              `A quick reminder of ${what}. Pickup: ${a.pickupPlace}, on ${a.when} (Costa Rica time), the time confirmed by our team.`,
              `Un breve recordatorio de ${what}. Recogida: ${a.pickupPlace}, el ${a.when} (hora de Costa Rica), la hora que confirmó nuestro equipo.`,
            )
          : t(
              lang,
              `A quick reminder of ${what}. Pickup: ${a.when} (Costa Rica time), the time confirmed by our team. If we don't have your pickup place yet, please write it in the trip chat.`,
              `Un breve recordatorio de ${what}. Recogida: ${a.when} (hora de Costa Rica), la hora que confirmó nuestro equipo. Si aún no tenemos su lugar de recogida, escríbalo en el chat del viaje, por favor.`,
            ),
      a.car
        ? t(lang, `Your driver: ${a.driver}. Vehicle: ${carLine(lang, a.car)}.`, `Su conductor: ${a.driver}. Vehículo: ${carLine(lang, a.car)}.`)
        : t(lang, `Your driver: ${a.driver}.`, `Su conductor: ${a.driver}.`),
      a.airport
        ? t(
            lang,
            "Your driver waits at arrivals holding a sign with your name, or with the text you chose when you booked. We follow your flight, and your driver waits up to 60 minutes after it lands.",
            "Su conductor lo espera en la salida de llegadas con un rótulo con su nombre, o con el texto que usted eligió al reservar. Seguimos su vuelo, y su conductor espera hasta 60 minutos después del aterrizaje.",
          )
        : "",
      a.ride && a.sign
        ? t(
            lang,
            `The name sign will say: “${a.sign}”. You can change it on your trip page until your driver is on the way.`,
            `El rótulo dirá: “${a.sign}”. Puede cambiarlo en la página de su viaje hasta que su conductor vaya en camino.`,
          )
        : "",
      t(
        lang,
        "Your trip page shows your driver's profile and car photos, and has a chat with your driver and our team. If something changes, write in the chat or use “Call our team” on the trip page.",
        "La página de su viaje muestra el perfil de su conductor y las fotos del vehículo, y tiene un chat con su conductor y con nuestro equipo. Si algo cambia, escriba en el chat o use “Llamar a nuestro equipo” en la página de su viaje.",
      ),
    ].filter(Boolean),
    button: { label: t(lang, "Open your trip page", "Abrir la página de su viaje"), url: a.tripUrl },
  };
}

// --- "Book your return / a day tour" (promotional; docs/PROJECT.md §4.7) -----------

export interface FollowupTour {
  /** In `lang` (localizeCatalog). */
  name: string;
  /** The site's "From $X per person" price: the 4+ travellers rate in the default season, whole dollars. */
  fromPrice: string;
  url: string;
}

export function followupEmail(
  lang: PublicLang,
  a: {
    guestName: string | null | undefined;
    /** Already in `lang` (placeNameFor). Origin = where the way back goes. */
    origin: string;
    destination: string;
    returnUrl: string;
    /** regionName(…, lang) when there are tours. */
    region: string | null;
    tours: FollowupTour[];
  },
): TravellerEmail & { links: { label: string; url: string }[]; linksIntro?: string } {
  return {
    lang,
    subject: t(lang, `Your next ride from ${a.destination}`, `Su próximo traslado desde ${a.destination}`),
    lines: [
      greeting(lang, a.guestName),
      t(
        lang,
        `We hope you're enjoying ${a.destination}. When it's time to move on, your ride back to ${a.origin} is ready to book: the route is already filled in, just choose the date, time and vehicle. You see the price before you send the request.`,
        `Esperamos que esté disfrutando ${a.destination}. Cuando llegue el momento de seguir, su traslado de regreso a ${a.origin} está listo para reservar: la ruta ya está completa, solo elija la fecha, la hora y el vehículo. Usted ve el precio antes de enviar la solicitud.`,
      ),
    ],
    button: { label: t(lang, `Book the ride back to ${a.origin}`, `Reservar el regreso a ${a.origin}`), url: a.returnUrl },
    ...(a.tours.length && a.region
      ? {
          linksIntro: t(
            lang,
            `While you're in ${a.region}, these private day tours are nearby (prices per person, for 4 or more travellers, green season):`,
            `Mientras está en ${a.region}, estos tours privados de un día están cerca (precios por persona, para 4 viajeros o más, temporada verde):`,
          ),
        }
      : {}),
    links: a.tours.map((x) => ({ label: t(lang, `${x.name} · from ${x.fromPrice} per person`, `${x.name} · desde ${x.fromPrice} por persona`), url: x.url })),
  };
}

/** The small line at the bottom of the follow-up, next to the unsubscribe link. */
export function followupUnsubscribeText(lang: PublicLang): { note: string; label: string } {
  return {
    note: t(
      lang,
      "We send one suggestion like this after a ride. Your booking emails are not affected.",
      "Enviamos una sola sugerencia como esta después de un traslado. Los correos de sus reservas no cambian.",
    ),
    label: t(lang, "Unsubscribe from suggestions", "Darse de baja de las sugerencias"),
  };
}
