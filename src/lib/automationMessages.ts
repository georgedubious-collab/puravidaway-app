/**
 * The driver's day-before reminder and the team's low-rating alert (docs/PROJECT.md §4.7).
 * Traveller messages are in ./travellerMessages.ts. No server-only imports, so
 * scripts/test-automations.mjs builds and checks every message.
 *
 * Privacy (docs/PROJECT.md §4.5): the driver's reminder is built ONLY from what the driver
 * already sees in the app through my_trips(): towns and pickup text, time, passengers, bags,
 * the name-sign text, the flight / hotel notes, the driver notes and the extras. It has no
 * field for the traveller's name, phone, email or the price, so it cannot contain them.
 */
import { driverTripFacts, type StoredCoords } from "./automationRules";
import { formatScheduledAt } from "./dates";
import { prefsSummary, type RidePrefs } from "./preferences";
import { t, type PublicLang } from "./publicLang";
import { signShown } from "./sign";

/** Ferry / boat / cash flags, the same ones the driver app shows (driverTripFacts). */
export interface DriverFlags {
  airport: boolean;
  ferry: boolean;
  boat: boolean;
  /** The traveller pays the driver in cash. The amount is in the app, never in a message. */
  cash: boolean;
}

export interface DriverReminder {
  /** The driver's first name. */
  driverFirst: string;
  ref: string;
  ride: boolean;
  /** Ride: pickup and drop-off as the driver app shows them. Tour: its name in `pickup`. */
  pickup: string;
  dropoff: string;
  /** Day tours: where to pick them up (null when not given). */
  tourPickup: string | null;
  /** formatScheduledAt(…, lang). */
  when: string;
  passengers: number | null;
  /** Large suitcases and carry-ons (null = not given). */
  bags: { large: number | null; carryOn: number | null };
  /** pickup_sign(): what the sign must say. */
  sign: string | null;
  /** bookings.flight_or_hotel_notes as my_trips() returns it (contact details already hidden). */
  flightOrHotel: string | null;
  /** bookings.driver_notes as my_trips() returns it. */
  driverNotes: string | null;
  prefs: Partial<RidePrefs> | null;
  flags: DriverFlags;
  tripUrl: string;
}

/** The booking columns the driver's reminder is made from: the ones my_trips() shows the driver, plus what the flags need. */
export interface DriverReminderBooking {
  id: string;
  booking_ref: string;
  service_type: string;
  origin: string | null;
  destination: string | null;
  origin_coords: StoredCoords | null;
  destination_coords: StoredCoords | null;
  scheduled_at: string | null;
  passenger_count: number | null;
  luggage_count: number | null;
  carry_on_count: number | null;
  flight_or_hotel_notes: string | null;
  driver_notes: string | null;
  preferences: Partial<RidePrefs> | null;
  vehicle_class: string | null;
  payment_mode: string | null;
  total_price: number | string | null;
  cash_fee: number | string | null;
  amount_paid: number | string | null;
  sign_text: string | null;
  sign_hide_name: boolean | null;
  /** Day tours: the hotel or address (my_trips().pickup_place). */
  pickup_place?: string | null;
}

/**
 * The driver's reminder from a booking row. The traveller's full name is used ONLY to work out
 * the sign (first name + last initial, like pickup_sign() in the database); the money columns
 * only to know whether there is cash to collect. Neither reaches the message.
 */
export function driverReminderFor(
  lang: PublicLang,
  b: DriverReminderBooking,
  a: { guestName: string | null | undefined; driverFullName: string | null | undefined; tourName: string | null; siteUrl: string },
): DriverReminder {
  const ride = b.service_type === "transfer";
  const owed = Number(b.total_price ?? 0) + Number(b.cash_fee ?? 0) - Number(b.amount_paid ?? 0);
  return {
    driverFirst: (a.driverFullName ?? "").split(" ")[0],
    ref: b.booking_ref,
    ride,
    pickup: ride ? (b.origin ?? "—") : (a.tourName ?? "Tour"),
    dropoff: ride ? (b.destination ?? "—") : "",
    tourPickup: ride ? null : (b.pickup_place ?? null),
    when: formatScheduledAt(b.scheduled_at, lang),
    passengers: b.passenger_count,
    bags: { large: b.luggage_count, carryOn: b.carry_on_count },
    sign: ride ? signShown(b, a.guestName) : null,
    flightOrHotel: b.flight_or_hotel_notes,
    driverNotes: b.driver_notes,
    prefs: b.preferences,
    flags: driverTripFacts({ ...b, owed }),
    tripUrl: `${a.siteUrl}/driver/trips/${b.id}`,
  };
}

function bagsText(lang: PublicLang, b: DriverReminder["bags"]): string {
  if (b.large == null && b.carryOn == null) return "";
  if (b.carryOn == null) return t(lang, `${b.large} bags`, `${b.large} maletas`);
  const l = b.large ?? 0;
  return t(lang, `${l} large + ${b.carryOn} carry-on`, `${l} ${l === 1 ? "grande" : "grandes"} + ${b.carryOn} de mano`);
}

function flagLines(lang: PublicLang, f: DriverFlags): string[] {
  return [
    f.ferry ? t(lang, "This route takes the ferry (Paquera / Playa Naranjo).", "Esta ruta usa el ferry (Paquera / Playa Naranjo).") : "",
    f.boat ? t(lang, "Drake Bay boat: drive to the Sierpe boat dock.", "Bote a Bahía Drake: maneje hasta el muelle de Sierpe.") : "",
    f.cash ? t(lang, "Collect cash: the traveller pays you in cash (the amount is in the app).", "Cobrar en efectivo: el cliente le paga en efectivo (el monto está en la app).") : "",
  ].filter(Boolean);
}

export function driverReminderPush(lang: PublicLang, a: DriverReminder): { title: string; body: string } {
  return {
    title: t(lang, `Reminder: trip ${a.ref} · ${a.when}`, `Recordatorio: viaje ${a.ref} · ${a.when}`),
    body: [
      a.ride ? `${a.pickup} → ${a.dropoff}` : a.tourPickup ? `${a.pickup} · ${t(lang, "pickup", "recogida")}: ${a.tourPickup}` : a.pickup,
      a.passengers ? t(lang, `${a.passengers} pax`, `${a.passengers} pasajeros`) : "",
      a.ride && a.sign ? t(lang, `sign: “${a.sign}”`, `rótulo: “${a.sign}”`) : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function driverReminderEmail(lang: PublicLang, a: DriverReminder): { subject: string; lines: string[]; button: { label: string; url: string }; lang: PublicLang } {
  const extras = prefsSummary(a.prefs, lang);
  const bags = bagsText(lang, a.bags);
  return {
    lang,
    subject: t(lang, `Reminder: trip ${a.ref} · ${a.when}`, `Recordatorio: viaje ${a.ref} · ${a.when}`),
    lines: [
      a.driverFirst ? t(lang, `Hi ${a.driverFirst},`, `Hola ${a.driverFirst},`) : t(lang, "Hi,", "Hola,"),
      t(lang, `A reminder of your trip ${a.ref}: pickup ${a.when} (Costa Rica time).`, `Le recordamos su viaje ${a.ref}: recogida ${a.when} (hora de Costa Rica).`),
      a.ride ? t(lang, `Pickup: ${a.pickup}`, `Recogida: ${a.pickup}`) : t(lang, `Day tour: ${a.pickup}`, `Tour de un día: ${a.pickup}`),
      a.ride && a.dropoff ? t(lang, `Drop-off: ${a.dropoff}`, `Destino: ${a.dropoff}`) : "",
      !a.ride
        ? a.tourPickup
          ? t(lang, `Pickup: ${a.tourPickup}`, `Recogida: ${a.tourPickup}`)
          : t(lang, "Pickup: our team confirms the place in the trip chat.", "Recogida: nuestro equipo confirma el lugar en el chat del viaje.")
        : "",
      [a.passengers ? t(lang, `Travellers: ${a.passengers}`, `Pasajeros: ${a.passengers}`) : "", bags ? t(lang, `Bags: ${bags}`, `Maletas: ${bags}`) : ""]
        .filter(Boolean)
        .join(" · "),
      a.ride && a.sign ? t(lang, `Name sign: “${a.sign}”`, `Rótulo: “${a.sign}”`) : "",
      a.flags.airport
        ? t(lang, "Airport pickup: wait at arrivals holding the sign. We follow the flight.", "Recogida en el aeropuerto: espere en la salida de llegadas con el rótulo. Damos seguimiento al vuelo.")
        : "",
      a.flightOrHotel ? t(lang, `Flight / hotel: ${a.flightOrHotel}`, `Vuelo / hotel: ${a.flightOrHotel}`) : "",
      a.driverNotes ? t(lang, `Notes for you: ${a.driverNotes}`, `Notas para usted: ${a.driverNotes}`) : "",
      extras.length ? t(lang, `Requests: ${extras.join(" · ")}`, `Pedidos: ${extras.join(" · ")}`) : "",
      ...flagLines(lang, a.flags),
      t(
        lang,
        "Open the trip for the exact pickup place and the chat. If anything is unclear, write in the trip chat or call our team.",
        "Abra el viaje para ver el lugar exacto de recogida y el chat. Si algo no está claro, escriba en el chat del viaje o llame a nuestro equipo.",
      ),
    ].filter(Boolean),
    button: { label: t(lang, "Open the trip", "Abrir el viaje"), url: a.tripUrl },
  };
}

// --- Low rating: email to our team (Spanish by default, like the admin pages) -------------

/**
 * The team reads Spanish unless the admin who receives it uses English (profiles.app_lang =
 * 'en'). Words as on the admin pages: "Reserva", "Cliente", "Conductor", "Ruta".
 */
export function lowRatingTeamEmail(lang: PublicLang, a: {
  ref: string;
  /** "SJO Airport / San José → Manuel Antonio", or the tour's name (`tour` true). */
  route: string;
  tour?: boolean;
  /** formatScheduledAt(…). */
  when: string;
  driverName: string;
  stars: number;
  comment: string | null;
  adminUrl: string;
}): { subject: string; lines: string[]; button: { label: string; url: string } } {
  const s = Math.max(1, Math.min(5, Math.round(a.stars)));
  const stars = `${"★".repeat(s)}${"☆".repeat(5 - s)} (${s}/5)`;
  return {
    subject: t(lang, `Low rating: ${s}★ for ${a.driverName} (${a.ref})`, `Calificación baja: ${s}★ para ${a.driverName} (${a.ref})`),
    lines: [
      t(lang, `A traveller rated their driver ${s} out of 5.`, `Un cliente calificó a su conductor con ${s} de 5.`),
      t(lang, `Booking: ${a.ref}`, `Reserva: ${a.ref}`),
      a.tour ? t(lang, `Day tour: ${a.route}`, `Tour de un día: ${a.route}`) : t(lang, `Route: ${a.route}`, `Ruta: ${a.route}`),
      t(lang, `Date: ${a.when} (Costa Rica time)`, `Fecha: ${a.when} (hora de Costa Rica)`),
      t(lang, `Driver: ${a.driverName}`, `Conductor: ${a.driverName}`),
      t(lang, `Stars: ${stars}`, `Estrellas: ${stars}`),
      a.comment ? t(lang, `Comment: “${a.comment}”`, `Comentario: “${a.comment}”`) : t(lang, "No comment was written.", "No escribió ningún comentario."),
      t(
        lang,
        "The driver is not told about this alert. It is sent once per rating; the rating already counts in the driver's average.",
        "Al conductor no se le avisa de esta alerta. Se envía una sola vez por calificación; la calificación ya cuenta en el promedio del conductor.",
      ),
    ],
    button: { label: t(lang, "Open the booking", "Abrir la reserva"), url: a.adminUrl },
  };
}
