/**
 * Spanish for the messages the server sends back to the booking storefront
 * (trip request: src/app/trip/actions.ts and src/lib/tripRequest.ts; place search
 * and routes: src/lib/googleMaps.ts, src/app/api/places) and to the private trip
 * page (rating and trip chat). The server keeps
 * answering in English (the same action serves / and /es, the apps and the trip
 * page); the Spanish storefront translates what it shows here. A message that
 * isn't listed is shown as it arrives (English).
 *
 * Keep the English keys identical to the server's wording.
 */
import type { PublicLang } from "./publicLang";

const EXACT: Record<string, string> = {
  // Trip request
  "Please add your full name.": "Por favor, escriba su nombre completo.",
  "Please check your email address.": "Por favor, revise su correo electrónico.",
  "Please add a mobile number with country code, e.g. +1 555 123 4567.":
    "Por favor, escriba un número de celular con código de país, p. ej. +1 555 123 4567.",
  "Pick how you'd like to pay.": "Elija cómo desea pagar.",
  "Your trip is empty.": "Su viaje está vacío.",
  "Online requests aren't switched on yet. Please send your trip on WhatsApp.":
    "Las solicitudes en línea aún no están activas. Por favor, envíenos su viaje por WhatsApp.",
  "One item was added on an older version of the site. Please remove it and add it again.":
    "Un elemento se agregó con una versión anterior del sitio. Por favor, quítelo y agréguelo de nuevo.",
  "One of the dates is in the past. Please change it.": "Una de las fechas ya pasó. Por favor, cámbiela.",
  "Some prices have changed since you added them. Please check the new totals and send again.":
    "Algunos precios cambiaron desde que los agregó. Por favor, revise los nuevos totales y envíe de nuevo.",
  "We've received several requests from you already. Please wait a little, or message us on WhatsApp.":
    "Ya recibimos varias solicitudes suyas. Por favor, espere un momento o escríbanos por WhatsApp.",
  "We couldn't save your request. Please try again or send it on WhatsApp.":
    "No pudimos guardar su solicitud. Por favor, inténtelo de nuevo o envíela por WhatsApp.",
  "A travel date is missing.": "Falta una fecha de viaje.",
  "Pick a pickup time.": "Elija una hora de recogida.",
  "We couldn't check the road distance for this ride. Please try again.":
    "No pudimos verificar la distancia por carretera de este traslado. Por favor, inténtelo de nuevo.",
  "Pickup and drop-off are the same place.": "La recogida y el destino son el mismo lugar.",
  "Please keep phone numbers, emails and links out of the message for your driver. You can message your driver in the trip chat once confirmed.":
    "Por favor, no incluya teléfonos, correos ni enlaces en el mensaje para su conductor. Podrá escribirle a su conductor en el chat del viaje una vez confirmado.",
  "Please keep phone numbers, emails and links off the name sign.": "Por favor, no ponga teléfonos, correos ni enlaces en el rótulo.",
  "The name on the sign can be up to 40 characters.": "El nombre en el rótulo puede tener hasta 40 caracteres.",
  "The name sign can't be changed any more: your driver is already on the way.":
    "El rótulo ya no se puede cambiar: su conductor ya va en camino.",
  "We couldn't save the name sign. Please try again.": "No pudimos guardar el rótulo. Por favor, inténtelo de nuevo.",
  "That vehicle is no longer offered. Please choose another.": "Ese vehículo ya no está disponible. Por favor, elija otro.",
  "One of the stops is no longer offered on this route.": "Una de las paradas ya no se ofrece en esta ruta.",
  "That tour is no longer offered.": "Ese tour ya no está disponible.",
  "That expedition is no longer offered.": "Esa expedición ya no está disponible.",
  "That lodging option is no longer offered.": "Esa opción de alojamiento ya no está disponible.",
  // Rating on the trip page (src/app/trip/[token]/actions.ts)
  "This link isn't valid any more.": "Este enlace ya no es válido.",
  "Pick 1 to 5 stars.": "Elija de 1 a 5 estrellas.",
  "Please keep phone numbers, emails and links out of the review.": "Por favor, no incluya teléfonos, correos ni enlaces en su comentario.",
  "We couldn't find that booking on your trip.": "No encontramos esa reserva en su viaje.",
  "You can rate your driver once the trip is completed.": "Podrá calificar a su conductor cuando el viaje haya terminado.",
  "Thank you, you've already rated this trip.": "Gracias, usted ya calificó este viaje.",
  "We couldn't save your rating. Please try again.": "No pudimos guardar su calificación. Por favor, inténtelo de nuevo.",
  // Trip chat (src/app/chat/actions.ts)
  "Chat not found.": "No se encontró el chat.",
  "Chat isn't switched on yet.": "El chat aún no está activo.",
  "Please sign in again.": "Por favor, inicie sesión de nuevo.",
  "Your driver account is paused. Please contact our team.": "Su cuenta de conductor está en pausa. Por favor, contacte a nuestro equipo.",
  "You don't have access to this chat.": "Usted no tiene acceso a este chat.",
  "Couldn't load the chat. Please reload the page.": "No se pudo cargar el chat. Por favor, recargue la página.",
  "Write a message first.": "Escriba un mensaje primero.",
  "Please keep phone numbers, emails and links out of the chat. Our team shares contact details when needed.":
    "Por favor, no incluya teléfonos, correos ni enlaces en el chat. Nuestro equipo comparte los datos de contacto cuando hace falta.",
  "Please keep phone numbers, emails and links out of the chat.": "Por favor, no incluya teléfonos, correos ni enlaces en el chat.",
  "This booking was cancelled. Contact our team if you need help.": "Esta reserva fue cancelada. Contacte a nuestro equipo si necesita ayuda.",
  "You're sending messages very fast. Please wait a moment.": "Está enviando mensajes muy rápido. Por favor, espere un momento.",
  "Couldn't send. Please try again.": "No se pudo enviar. Por favor, inténtelo de nuevo.",
  // Places and routes
  "Something went wrong. Please try again.": "Algo salió mal. Por favor, inténtelo de nuevo.",
  "Address search isn't switched on yet. Choose one of our towns from the list.":
    "La búsqueda de direcciones aún no está activa. Elija uno de nuestros destinos de la lista.",
  "We couldn't reach the map service. Please try again in a moment.":
    "No pudimos conectar con el servicio de mapas. Por favor, inténtelo de nuevo en un momento.",
  "We couldn't find that place on the map. Please pick another.":
    "No encontramos ese lugar en el mapa. Por favor, elija otro.",
  "That place isn't valid. Please search for it again.": "Ese lugar no es válido. Por favor, búsquelo de nuevo.",
  "We only drive within Costa Rica. Please pick a place in Costa Rica.":
    "Solo operamos dentro de Costa Rica. Por favor, elija un lugar en Costa Rica.",
  "We couldn't find a road between those places. Please message us on WhatsApp.":
    "No encontramos una carretera entre esos lugares. Por favor, escríbanos por WhatsApp.",
  "Getting around Drake Bay is by boat or on foot. Message us on WhatsApp and we'll help.":
    "En Bahía Drake uno se mueve en lancha o a pie. Escríbanos por WhatsApp y le ayudamos.",
  "That ride is longer than we quote online. Please message us on WhatsApp.":
    "Ese traslado es más largo de lo que cotizamos en línea. Por favor, escríbanos por WhatsApp.",
};

/** Messages with a number or a vehicle name inside. */
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Messages can be up to (\d+) characters\.$/, (m) => `Los mensajes pueden tener hasta ${m[1]} caracteres.`],
  [/^Up to (\d+) items per request, please\.$/, (m) => `Hasta ${m[1]} elementos por solicitud, por favor.`],
  [
    /^The cash booking fee is now ([\d.]+%)\. Please reload the page to see your new total, then send again\.$/,
    (m) => `El cargo por reserva en efectivo ahora es del ${m[1]}. Por favor, recargue la página para ver su nuevo total y envíe de nuevo.`,
  ],
  [/^The (.+) seats up to (\d+)\.$/, (m) => `El vehículo ${m[1]} lleva hasta ${m[2]} pasajeros.`],
  [/^The (.+) isn't available on this route\.$/, (m) => `El vehículo ${m[1]} no está disponible en esta ruta.`],
  [
    /^The (.+) is a direct ride without stops\. Remove the stops or choose another vehicle\.$/,
    (m) => `El vehículo ${m[1]} es un traslado directo sin paradas. Quite las paradas o elija otro vehículo.`,
  ],
  [
    /^The (.+) has a Spanish-speaking driver\. Choose another vehicle for an English-speaking driver\.$/,
    (m) => `El vehículo ${m[1]} tiene conductor de habla hispana. Elija otro vehículo si desea un conductor que hable inglés.`,
  ],
  [/^Offers must be between \$(\d+) and \$(\d+)\.$/, (m) => `Las ofertas deben estar entre $${m[1]} y $${m[2]}.`],
];

/** A server message in `lang` (unknown messages come back unchanged). */
export function localizeServerMessage(message: string, lang: PublicLang): string {
  if (lang !== "es") return message;
  if (EXACT[message]) return EXACT[message];
  for (const [re, build] of PATTERNS) {
    const m = message.match(re);
    if (m) return build(m);
  }
  return message;
}
