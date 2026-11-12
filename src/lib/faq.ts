/**
 * Help center (/faq, /es/preguntas-frecuentes). Every answer must match how the
 * product works today: src/lib/trust.ts, src/lib/catalog.ts, /cancellation and
 * docs/PROJECT.md. "{cashFee}" is replaced with the live cash booking fee.
 * Spanish: neutral Latin American, "usted", "conductor".
 */
import { nightSentence, type NightPremium } from "./nightPremium";
import { formatBpsPercent } from "./pricing";
import type { PublicLang } from "./publicLang";

export interface FaqItem {
  id: string;
  q: Record<PublicLang, string>;
  a: Record<PublicLang, string>;
}

export interface FaqGroup {
  id: string;
  title: Record<PublicLang, string>;
  items: FaqItem[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "booking",
    title: { en: "Booking", es: "Reservas" },
    items: [
      {
        id: "how-book",
        q: { en: "How do I book a private transfer?", es: "¿Cómo reservo un traslado privado?" },
        a: {
          en: "Enter your pickup and drop-off (an airport, hotel, address or town), the date, time and number of travellers, pick a vehicle and any stops, and send the request with your name, email and WhatsApp number. You get an email with your private trip page, and our team confirms the trip.",
          es: "Indique el punto de recogida y de destino (aeropuerto, hotel, dirección o pueblo), la fecha, la hora y el número de viajeros, elija el vehículo y las paradas, y envíe la solicitud con su nombre, correo y número de WhatsApp. Recibirá un correo con la página privada de su viaje, y nuestro equipo confirma el viaje.",
        },
      },
      {
        id: "account",
        q: { en: "Do I need an account?", es: "¿Necesito una cuenta?" },
        a: {
          en: "No. Each trip has a private trip page, linked in your confirmation email, with your bookings, status, driver and chat.",
          es: "No. Cada viaje tiene una página privada, enlazada en su correo de confirmación, con sus reservas, el estado, el conductor y el chat.",
        },
      },
      {
        id: "private",
        q: { en: "Is the ride private or shared?", es: "¿El viaje es privado o compartido?" },
        a: {
          en: "Private. Only your group rides in the vehicle, it leaves when you are ready, and it stops only where you choose. It goes door to door, from the airport or your hotel to your next hotel.",
          es: "Privado. Solo su grupo va en el vehículo, sale cuando usted está listo y se detiene solo donde usted elige. Es puerta a puerta, del aeropuerto o su hotel a su siguiente hotel.",
        },
      },
    ],
  },
  {
    id: "prices",
    title: { en: "Prices & payment", es: "Precios y pago" },
    items: [
      {
        id: "per-car",
        q: { en: "Is the price per person or per vehicle?", es: "¿El precio es por persona o por vehículo?" },
        a: {
          en: "Per vehicle. The price stays the same whether you are one traveller or a full car. We also show \"from $X per person\", which is the price shared by a full vehicle.",
          es: "Por vehículo. El precio es el mismo si viaja una persona o el vehículo va lleno. También mostramos \"desde $X por persona\", que es el precio dividido entre un vehículo lleno.",
        },
      },
      {
        id: "pay",
        q: { en: "How do I pay?", es: "¿Cómo pago?" },
        a: {
          en: "Two ways. Pay online in full: once our team confirms your trip, we send you a secure payment link. Or pay your driver in cash on the day for rides and 1-day tours, plus a {cashFee} cash booking fee shown in your trip total.",
          es: "De dos formas. Pague en línea completo: cuando nuestro equipo confirma su viaje, le enviamos un enlace de pago seguro. O pague al conductor en efectivo el día del viaje en traslados y tours de un día, más un cargo por reserva en efectivo del {cashFee} que aparece en el total.",
        },
      },
      {
        id: "extras",
        q: { en: "Are there any extra charges?", es: "¿Hay cargos adicionales?" },
        a: {
          en: "The price is confirmed before you pay: no surge and no fuel surcharge. Prices include the season (December to April and holiday weeks cost a little more), the night premium when your pickup is at night, and ferry fares on routes that take the ferry. Entrance fees at sightseeing stops are shown on each stop: free, included, or paid at the gate.",
          es: "El precio se confirma antes de pagar: sin tarifas dinámicas ni recargo por combustible. Los precios incluyen la temporada (de diciembre a abril y las semanas feriadas cuestan un poco más), el recargo nocturno cuando la recogida es de noche y el ferry en las rutas que lo usan. Las entradas en las paradas turísticas se indican en cada parada: gratis, incluida o se paga en la entrada.",
        },
      },
      {
        id: "night-pickups",
        q: { en: "Can I book a pickup at night or very early?", es: "¿Puedo reservar una recogida de noche o muy temprano?" },
        a: {
          en: "Yes. {night} The price you see when you choose your pickup time already includes it; stops, ferry fares and day tours are not affected.",
          es: "Sí. {night} El precio que ve al elegir su hora de recogida ya lo incluye; las paradas, el ferry y los tours de un día no cambian.",
        },
      },
      {
        id: "fixed-price",
        q: { en: "Is the price fixed?", es: "¿El precio es fijo?" },
        a: {
          en: "Yes. Every ride has a fixed price per vehicle, shown before you book, with the season, any night pickup and ferry fares already included. The price you see is the price you pay.",
          es: "Sí. Cada traslado tiene un precio fijo por vehículo, que usted ve antes de reservar, con la temporada, la recogida nocturna si aplica y el ferry ya incluidos. El precio que ve es el que paga.",
        },
      },
    ],
  },
  {
    id: "day",
    title: { en: "On the day", es: "El día del viaje" },
    items: [
      {
        id: "flight-delay",
        q: { en: "What if my flight is late?", es: "¿Qué pasa si mi vuelo se atrasa?" },
        a: {
          en: "On airport pickups we track your flight, so a delay doesn't leave you stranded. Your driver waits up to 60 minutes free after your flight lands.",
          es: "En las recogidas en el aeropuerto seguimos su vuelo, así que un atraso no lo deja sin transporte. Su conductor espera hasta 60 minutos gratis después de que aterriza su vuelo.",
        },
      },
      {
        id: "waiting",
        q: { en: "How long will the driver wait?", es: "¿Cuánto tiempo espera el conductor?" },
        a: {
          en: "Up to 60 minutes free, after your flight lands or after your pickup time.",
          es: "Hasta 60 minutos gratis, después de que aterriza su vuelo o después de la hora de recogida.",
        },
      },
      {
        id: "where-driver",
        q: { en: "How do I find my driver?", es: "¿Cómo encuentro a mi conductor?" },
        a: {
          en: "At the airport, your driver meets you at arrivals holding a sign with your name. You can choose what the sign says when you book, or change it on your trip page until your driver is on the way. Your trip page shows your driver's name, photo and car once confirmed. In the last 3 hours before pickup, while your driver shares their location, you can see where they are and when they should arrive, and chat with them and our team on the trip page.",
          es: "En el aeropuerto, su conductor lo recibe en la salida de llegadas con un rótulo con su nombre. Usted puede elegir qué dice el rótulo al reservar, o cambiarlo en la página de su viaje hasta que su conductor vaya en camino. La página de su viaje muestra el nombre, la foto y el vehículo de su conductor cuando está confirmado. En las últimas 3 horas antes de la recogida, mientras el conductor comparte su ubicación, puede ver dónde está y a qué hora debería llegar, y chatear con él y con nuestro equipo en la página del viaje.",
        },
      },
      {
        id: "drive-times",
        q: { en: "How long are the drives?", es: "¿Cuánto duran los trayectos?" },
        a: {
          en: "Our drive times are realistic for Costa Rica's mountain roads, not straight-line estimates. For example SJO airport to La Fortuna takes about 2 h 45 min and to Manuel Antonio about 3 hours; weekend traffic and rain can add time. Each route page shows its drive time.",
          es: "Nuestros tiempos de viaje son realistas para las carreteras de montaña de Costa Rica, no estimaciones en línea recta. Por ejemplo, del aeropuerto SJO a La Fortuna son unas 2 h 45 min y a Manuel Antonio unas 3 horas; el tráfico de fin de semana y la lluvia pueden sumar tiempo. Cada página de ruta muestra su tiempo de viaje.",
        },
      },
      {
        id: "stops",
        q: { en: "Can we stop for sightseeing on the way?", es: "¿Podemos hacer paradas turísticas en el camino?" },
        a: {
          en: "Yes. On many routes you can add stops such as the Tárcoles crocodile bridge, Carara's scarlet macaws, Poás Volcano or Río Celeste. Each stop shows its duration and price, and your luggage stays locked in the vehicle with your driver. Poás Volcano uses timed-entry tickets.",
          es: "Sí. En muchas rutas puede agregar paradas como el puente de los cocodrilos en Tárcoles, las lapas rojas de Carara, el volcán Poás o Río Celeste. Cada parada muestra su duración y precio, y su equipaje queda bajo llave en el vehículo con su conductor. El volcán Poás usa entradas con horario.",
        },
      },
    ],
  },
  {
    id: "vehicles",
    title: { en: "Drivers & vehicles", es: "Conductores y vehículos" },
    items: [
      {
        id: "vetted",
        q: { en: "Who are the drivers?", es: "¿Quiénes son los conductores?" },
        a: {
          en: "Independent local partner drivers we interview and check: criminal and driving records, licence, INS commercial insurance, and the vehicle's Dekra (RTV) inspection and Marchamo. Drivers with an ICT tourism permit show an ICT badge on their profile.",
          es: "Conductores locales independientes asociados que entrevistamos y verificamos: antecedentes penales y de manejo, licencia, seguro comercial del INS, y la revisión técnica (Dekra / RTV) y el Marchamo del vehículo. Los conductores con permiso de turismo del ICT muestran una insignia ICT en su perfil.",
        },
      },
      {
        id: "child-seats",
        q: { en: "Do you have child seats?", es: "¿Tienen sillas para niños?" },
        a: {
          en: "Yes, free on request. Tell us how many and the children's ages when you book.",
          es: "Sí, gratis a solicitud. Indíquenos cuántas y las edades de los niños al reservar.",
        },
      },
      {
        id: "luggage",
        q: { en: "How much luggage fits?", es: "¿Cuánto equipaje cabe?" },
        a: {
          en: "Each vehicle lists how many travellers and suitcases it fits, from sedans for up to 3 travellers to vans for up to 10. Surfboards or a lot of luggage: choose a bigger vehicle or tell us in the notes.",
          es: "Cada vehículo indica cuántos viajeros y maletas caben, desde sedanes para hasta 3 viajeros hasta microbuses para hasta 10. Si lleva tablas de surf o mucho equipaje, elija un vehículo más grande o indíquelo en las notas.",
        },
      },
      {
        id: "language",
        q: { en: "Do the drivers speak English?", es: "¿Los conductores hablan inglés?" },
        a: {
          en: "You can ask for an English-speaking driver when you book, and we match it. The Economy class is a cheaper option with a Spanish-speaking driver.",
          es: "Puede pedir un conductor que hable inglés al reservar, y lo asignamos. La clase Economy es una opción más económica con un conductor que habla español.",
        },
      },
      {
        id: "electric",
        q: { en: "Can I ask for an electric vehicle?", es: "¿Puedo pedir un vehículo eléctrico?" },
        a: {
          en: "Yes. When you book, tick \"Electric vehicle, if available\" in the extras. It is a free request and the price is the same. We have only a few electric vehicles, so we cannot promise one; if none is available for your route and date, you travel in a regular vehicle of the category you booked.",
          es: "Sí. Al reservar, marque \"Vehículo eléctrico, si hay disponible\" en los extras. Es una solicitud gratuita y el precio es el mismo. Tenemos pocos vehículos eléctricos, así que no podemos prometer uno; si no hay ninguno disponible para su ruta y fecha, usted viaja en un vehículo regular de la categoría que reservó.",
        },
      },
    ],
  },
  {
    id: "changes",
    title: { en: "Changes & cancellation", es: "Cambios y cancelación" },
    items: [
      {
        id: "cancel",
        q: { en: "Can I cancel for free?", es: "¿Puedo cancelar gratis?" },
        a: {
          en: "Rides and 1-day tours: free cancellation and a full refund up to 24 hours before pickup; within 24 hours or a no-show, no refund. The full policy is on our cancellation page.",
          es: "Traslados y tours de un día: cancelación gratuita y reembolso completo hasta 24 horas antes de la recogida; con menos de 24 horas o si no se presenta, no hay reembolso. La política completa está en nuestra página de cancelación.",
        },
      },
      {
        id: "change",
        q: { en: "Can I change the date or time?", es: "¿Puedo cambiar la fecha o la hora?" },
        a: {
          en: "Yes, free if you ask at least 24 hours ahead, subject to availability. Message us on WhatsApp or in your trip chat.",
          es: "Sí, gratis si lo pide con al menos 24 horas de anticipación, según disponibilidad. Escríbanos por WhatsApp o en el chat de su viaje.",
        },
      },
      {
        id: "weather",
        q: { en: "What if a road or park is closed?", es: "¿Qué pasa si una carretera o un parque está cerrado?" },
        a: {
          en: "If weather, a road closure or a park closure affects your trip, we rebook it or refund the affected service. If we or the driver cancel, you get a full refund.",
          es: "Si el clima, el cierre de una carretera o de un parque afecta su viaje, lo reprogramamos o le reembolsamos el servicio afectado. Si nosotros o el conductor cancelamos, recibe un reembolso completo.",
        },
      },
    ],
  },
  {
    id: "tours",
    title: { en: "Day tours, ferries & boats", es: "Tours de un día, ferry y botes" },
    items: [
      {
        id: "en-route",
        q: { en: "Can a day tour also take me to my next hotel?", es: "¿Un tour de un día también me puede llevar a mi siguiente hotel?" },
        a: {
          en: "Yes. Add the Smart En-Route Transfer to a 1-day tour and the day ends at your next hotel instead of where it started.",
          es: "Sí. Agregue el Smart En-Route Transfer a un tour de un día y el día termina en su siguiente hotel en lugar de donde empezó.",
        },
      },
      {
        id: "santa-teresa",
        q: { en: "How do you get to Santa Teresa or Montezuma?", es: "¿Cómo se llega a Santa Teresa o Montezuma?" },
        a: {
          en: "Rides to Southern Nicoya (Santa Teresa, Montezuma) usually cross the Gulf of Nicoya on the Paquera ferry. The ferry fares for the car and passengers are included in the price we show.",
          es: "Los traslados al sur de Nicoya (Santa Teresa, Montezuma) normalmente cruzan el Golfo de Nicoya en el ferry de Paquera. El costo del ferry para el vehículo y los pasajeros está incluido en el precio que mostramos.",
        },
      },
      {
        id: "drake",
        q: { en: "How do we get to Drake Bay and Corcovado?", es: "¿Cómo llegamos a Bahía Drake y Corcovado?" },
        a: {
          en: "Most travellers reach Drake Bay by river boat from Sierpe. We drive you to the Sierpe dock, timed around your boat; the \"4x4 Transfer + Sierpe River Boat\" option includes the boat to Drake Bay. Corcovado needs a certified guide and SINAC permits booked in advance, and overnights at Sirena Station have limited space, so book your guide early; the guide and the permit are booked separately from your ride.",
          es: "La mayoría de los viajeros llega a Bahía Drake en bote desde Sierpe. Lo llevamos al muelle de Sierpe, coordinado con la hora de su bote; la opción \"4x4 Transfer + Sierpe River Boat\" incluye el bote a Bahía Drake. Corcovado requiere un guía certificado y permisos del SINAC reservados con anticipación, y las noches en la Estación Sirena tienen cupo limitado, así que conviene reservar el guía con tiempo; el guía y el permiso se reservan aparte de su traslado.",
        },
      },
    ],
  },
  {
    id: "app",
    title: { en: "The app & your trip page", es: "La app y la página de su viaje" },
    items: [
      {
        id: "app",
        q: { en: "Is there an app?", es: "¿Hay una app?" },
        a: {
          en: "Our traveller app is on its way to the App Store and Google Play. In the app you confirm your email with a 6-digit code, no password needed. Until it is published, the website and your private trip page do everything: bookings, driver details, live position on the day, chat and rating.",
          es: "Nuestra app para viajeros llegará pronto a App Store y Google Play. En la app usted confirma su correo con un código de 6 dígitos, sin contraseña. Mientras se publica, el sitio web y la página privada de su viaje hacen todo: reservas, datos del conductor, ubicación en vivo el día del viaje, chat y calificación.",
        },
      },
      {
        id: "contact",
        q: { en: "How do I contact you?", es: "¿Cómo los contacto?" },
        a: {
          en: "WhatsApp is fastest: a real person on our team in Costa Rica answers. You can also email hello@costaricaprivatetransfers.com or use the contact form.",
          es: "WhatsApp es lo más rápido: le responde una persona de nuestro equipo en Costa Rica. También puede escribir a hello@costaricaprivatetransfers.com o usar el formulario de contacto.",
        },
      },
    ],
  },
];

/** The numbers FAQ answers quote, read from the live catalog so they never drift. */
export interface FaqValues {
  cashFeeBps: number;
  nightPremium: NightPremium;
}

/**
 * The answer with the live values filled in: {cashFee} (the cash booking fee) and {night}
 * (pickups at any hour and the night premium, with its percentage and hours).
 */
export function faqAnswer(item: FaqItem, lang: PublicLang, values: FaqValues): string {
  return item.a[lang]
    .replace(/\{cashFee\}/g, formatBpsPercent(values.cashFeeBps))
    .replace(/\{night\}/g, nightSentence(values.nightPremium, lang));
}
