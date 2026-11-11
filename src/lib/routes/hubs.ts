/**
 * One block per town or airport, shared by every route page that starts or ends there.
 * Rules and tokens: ./types.ts. Service wording repeats src/lib/trust.ts (name sign,
 * flight tracking, 60 minutes of free waiting); nothing new is promised here.
 */
import type { HubId } from "../catalog";
import type { HubBlock, RouteFaq } from "./types";

const airportPickup = (code: string, en: string, es: string): HubBlock["pickupFaq"] => () => ({
  q: { en: `Where do we meet our driver at ${en}?`, es: `¿Dónde nos espera el conductor en ${es}?` },
  a: {
    en: `Your driver waits at arrivals holding a sign with your name, or with the text you choose when you book. We follow your flight on airport pickups, and your driver waits up to 60 minutes after it lands. Add your flight number when you book your ${code} pickup.`,
    es: `Su conductor lo espera en la salida de llegadas con un rótulo con su nombre, o con el texto que usted elija al reservar. En las recogidas en aeropuerto seguimos su vuelo, y su conductor espera hasta 60 minutos después del aterrizaje. Indique su número de vuelo al reservar su recogida en ${code}.`,
  },
});

const airportArrival = (code: string): HubBlock["arrivalFaq"] => (o, d) => ({
  q: { en: `What time should we leave to catch a flight at ${code}?`, es: `¿A qué hora debemos salir para tomar un vuelo en ${code}?` },
  a: {
    en: `The drive takes about {time:${o}>${d}}, and traffic or rain can add to it. Airlines generally ask international passengers to be at the airport about three hours before departure (confirm with yours), so count back from there and leave a margin. {night}`,
    es: `El recorrido toma aproximadamente {time:${o}>${d}}, y el tráfico o la lluvia pueden sumar tiempo. Las aerolíneas por lo general piden a los pasajeros internacionales estar en el aeropuerto unas tres horas antes de la salida (confírmelo con la suya), así que cuente hacia atrás desde ahí y deje un margen. {night}`,
  },
});

const hotelPickup = (en: string, es: string): HubBlock["pickupFaq"] => () => ({
  q: { en: `Where does the driver pick us up in ${en}?`, es: `¿Dónde nos recoge el conductor en ${es}?` },
  a: {
    en: `At the door of your hotel or rental: type its name or address in the trip builder. Your driver waits up to 60 minutes after your pickup time, so there is no rush at check-out.`,
    es: `En la puerta de su hotel o alojamiento: escriba el nombre o la dirección en el planificador de viajes. Su conductor espera hasta 60 minutos después de su hora de recogida, así que no hay prisa a la salida.`,
  },
});

const faq = (qEn: string, qEs: string, aEn: string, aEs: string): RouteFaq => ({ q: { en: qEn, es: qEs }, a: { en: aEn, es: aEs } });

export const HUB_BLOCKS: Record<HubId, HubBlock> = {
  SJO: {
    slug: "sjo-airport",
    name: { en: "SJO Airport", es: "aeropuerto SJO" },
    esFrom: "del aeropuerto SJO",
    esTo: "al aeropuerto SJO",
    long: "San José airport (SJO)",
    esFromLong: "del aeropuerto de San José (SJO)",
    esToLong: "al aeropuerto de San José (SJO)",
    place: { en: "SJO Airport (Juan Santamaría) or your hotel in San José", es: "Aeropuerto SJO (Juan Santamaría) o su hotel en San José" },
    pickupFaq: airportPickup("SJO", "San José airport", "el aeropuerto de San José"),
    arrivalFaq: airportArrival("SJO"),
  },
  LIR: {
    slug: "liberia-airport",
    name: { en: "Liberia Airport (LIR)", es: "aeropuerto de Liberia (LIR)" },
    esFrom: "del aeropuerto de Liberia (LIR)",
    esTo: "al aeropuerto de Liberia (LIR)",
    long: "Liberia airport (LIR)",
    esFromLong: "del aeropuerto de Liberia (LIR)",
    esToLong: "al aeropuerto de Liberia (LIR)",
    place: { en: "Liberia Airport (Daniel Oduber, LIR)", es: "Aeropuerto de Liberia (Daniel Oduber, LIR)" },
    pickupFaq: airportPickup("LIR", "Liberia airport", "el aeropuerto de Liberia"),
    arrivalFaq: airportArrival("LIR"),
  },
  Arenal: {
    slug: "la-fortuna",
    name: { en: "La Fortuna (Arenal)", es: "La Fortuna (Arenal)" },
    esFrom: "de La Fortuna (Arenal)",
    esTo: "a La Fortuna (Arenal)",
    long: "La Fortuna and Arenal Volcano",
    esFromLong: "de La Fortuna y el volcán Arenal",
    esToLong: "a La Fortuna y el volcán Arenal",
    place: { en: "your hotel in La Fortuna or around Arenal Volcano", es: "su hotel en La Fortuna o los alrededores del volcán Arenal" },
    pickupFaq: hotelPickup("La Fortuna", "La Fortuna"),
    arrivalFaq: () =>
      faq(
        "Will we see Arenal Volcano when we arrive?",
        "¿Veremos el volcán Arenal al llegar?",
        "Arenal is often wrapped in cloud, especially in the afternoon. Your best chance is early morning, so don't worry if it's hidden when you arrive.",
        "El Arenal suele estar envuelto en nubes, sobre todo por la tarde. La mejor oportunidad es temprano por la mañana, así que no se preocupe si está tapado cuando llegue.",
      ),
  },
  ManuelAntonio: {
    slug: "manuel-antonio",
    name: { en: "Manuel Antonio", es: "Manuel Antonio" },
    esFrom: "de Manuel Antonio",
    esTo: "a Manuel Antonio",
    long: "Manuel Antonio and Quepos",
    esFromLong: "de Manuel Antonio y Quepos",
    esToLong: "a Manuel Antonio y Quepos",
    place: { en: "your hotel in Manuel Antonio or Quepos", es: "su hotel en Manuel Antonio o Quepos" },
    pickupFaq: hotelPickup("Manuel Antonio", "Manuel Antonio"),
    arrivalFaq: () =>
      faq(
        "Do we need national park tickets before we arrive in Manuel Antonio?",
        "¿Necesitamos las entradas al parque nacional antes de llegar a Manuel Antonio?",
        "Yes, if you plan to visit the park. Tickets are sold online only, for a set day and entry time, and daily numbers are limited. The park is closed on Tuesdays.",
        "Sí, si piensa visitar el parque. Las entradas se venden solo en línea, para un día y una hora de ingreso, y el cupo diario es limitado. El parque cierra los martes.",
      ),
  },
  Monteverde: {
    slug: "monteverde",
    name: { en: "Monteverde", es: "Monteverde" },
    esFrom: "de Monteverde",
    esTo: "a Monteverde",
    long: "the Monteverde and Santa Elena cloud forest",
    esFromLong: "del bosque nuboso de Monteverde y Santa Elena",
    esToLong: "al bosque nuboso de Monteverde y Santa Elena",
    place: { en: "your hotel in Monteverde or Santa Elena", es: "su hotel en Monteverde o Santa Elena" },
    pickupFaq: hotelPickup("Monteverde", "Monteverde"),
    arrivalFaq: () =>
      faq(
        "Will it be cold when we get to Monteverde?",
        "¿Hará frío cuando lleguemos a Monteverde?",
        "Cooler than the coast. Evenings are often misty, windy and around 15–18 °C, so keep a light jacket and rain layer handy rather than packed deep in a suitcase.",
        "Más fresco que en la costa. Las noches suelen ser neblinosas, ventosas y de unos 15–18 °C, así que tenga a mano una chaqueta liviana y una capa para la lluvia, en lugar de guardarlas en el fondo de la maleta.",
      ),
  },
  Sierpe: {
    slug: "sierpe",
    name: { en: "Sierpe (Drake Bay boat)", es: "Sierpe (lancha a Bahía Drake)" },
    esFrom: "de Sierpe (lancha de Bahía Drake)",
    esTo: "a Sierpe (lancha a Bahía Drake)",
    long: "the Sierpe boat dock, where the boats to Drake Bay leave",
    esFromLong: "del muelle de Sierpe, de donde salen las lanchas a Bahía Drake",
    esToLong: "al muelle de Sierpe, de donde salen las lanchas a Bahía Drake",
    place: { en: "Sierpe, or right at the boat dock", es: "Sierpe, o directamente en el muelle" },
    pickupFaq: () =>
      faq(
        "Our boat from Drake Bay arrives in Sierpe. Where do we meet the driver?",
        "Nuestra lancha de Bahía Drake llega a Sierpe. ¿Dónde nos espera el conductor?",
        "At the boat dock in Sierpe. Give us your boat's expected arrival as the pickup time; your driver waits up to 60 minutes after it, which covers a boat that runs late.",
        "En el muelle de Sierpe. Indíquenos como hora de recogida la llegada prevista de su lancha; su conductor espera hasta 60 minutos después, lo que cubre un atraso de la lancha.",
      ),
    arrivalFaq: () =>
      faq(
        "Who arranges the boat from Sierpe to Drake Bay?",
        "¿Quién organiza la lancha de Sierpe a Bahía Drake?",
        "Most Drake Bay lodges book their guests on a boat from Sierpe; confirm the time with your lodge, because boat times are not ours to set. Tell us that time and we plan the pickup so you reach the dock with time to spare. If you prefer the boat included, book the ride to Drake Bay instead.",
        "La mayoría de los lodges de Bahía Drake reserva a sus huéspedes en una lancha desde Sierpe; confirme la hora con su lodge, porque los horarios de las lanchas no dependen de nosotros. Indíquenos esa hora y planificamos la recogida para que llegue al muelle con tiempo de sobra. Si prefiere la lancha incluida, reserve el traslado hasta Bahía Drake.",
      ),
  },
  DrakeBay: {
    slug: "drake-bay",
    name: { en: "Drake Bay", es: "Bahía Drake" },
    esFrom: "de Bahía Drake",
    esTo: "a Bahía Drake",
    long: "Drake Bay on the Osa Peninsula, by road to Sierpe and river boat",
    esFromLong: "de Bahía Drake, en la península de Osa, en lancha hasta Sierpe y luego por carretera",
    esToLong: "a Bahía Drake, en la península de Osa, por carretera hasta Sierpe y luego en lancha",
    place: { en: "Drake Bay, by boat (beach landing)", es: "Bahía Drake, en lancha (desembarco en la playa)" },
    pickupFaq: () =>
      faq(
        "How does the trip out of Drake Bay start?",
        "¿Cómo empieza el viaje de salida de Bahía Drake?",
        "By boat. The first leg is the boat from Drake Bay to the Sierpe dock, about {boat}, and from there you continue by road. Boarding is from the beach, so wear sandals and keep electronics in something waterproof.",
        "En lancha. El primer tramo es la lancha de Bahía Drake al muelle de Sierpe, de aproximadamente {boat}, y desde allí se continúa por carretera. Se aborda desde la playa, así que use sandalias y guarde los aparatos electrónicos en algo impermeable.",
      ),
    arrivalFaq: () =>
      faq(
        "What is arriving in Drake Bay by boat like?",
        "¿Cómo es la llegada a Bahía Drake en lancha?",
        "Arrivals are usually wet landings: you step off the boat into shallow water on the beach. Wear sandals and shorts, and pack electronics and documents in something waterproof.",
        "Los desembarcos suelen ser en la playa: se baja de la lancha al agua poco profunda. Use sandalias y pantalón corto, y guarde los aparatos electrónicos y los documentos en algo impermeable.",
      ),
  },
  PuertoViejo: {
    slug: "puerto-viejo",
    name: { en: "Puerto Viejo", es: "Puerto Viejo" },
    esFrom: "de Puerto Viejo",
    esTo: "a Puerto Viejo",
    long: "Puerto Viejo on the Caribbean coast",
    esFromLong: "de Puerto Viejo, en la costa del Caribe",
    esToLong: "a Puerto Viejo, en la costa del Caribe",
    place: { en: "your hotel in Puerto Viejo, Cocles, Playa Chiquita or Manzanillo", es: "su hotel en Puerto Viejo, Cocles, Playa Chiquita o Manzanillo" },
    pickupFaq: hotelPickup("Puerto Viejo", "Puerto Viejo"),
    arrivalFaq: () =>
      faq(
        "Can you drop us south of Puerto Viejo?",
        "¿Pueden dejarnos al sur de Puerto Viejo?",
        "Yes. Cocles, Playa Chiquita, Punta Uva and Manzanillo are all along the same coastal road; enter your exact hotel in the trip builder.",
        "Sí. Cocles, Playa Chiquita, Punta Uva y Manzanillo quedan sobre la misma carretera costera; escriba su hotel exacto en el planificador de viajes.",
      ),
  },
  Tamarindo: {
    slug: "tamarindo",
    name: { en: "Tamarindo", es: "Tamarindo" },
    esFrom: "de Tamarindo",
    esTo: "a Tamarindo",
    long: "Tamarindo in Guanacaste",
    esFromLong: "de Tamarindo, en Guanacaste",
    esToLong: "a Tamarindo, en Guanacaste",
    place: { en: "your hotel in Tamarindo, Langosta or Playa Grande", es: "su hotel en Tamarindo, Langosta o Playa Grande" },
    pickupFaq: hotelPickup("Tamarindo", "Tamarindo"),
    arrivalFaq: () =>
      faq(
        "Can you drop us at Playa Grande or Langosta instead of Tamarindo?",
        "¿Pueden dejarnos en Playa Grande o Langosta en lugar de Tamarindo?",
        "Yes. Enter your exact hotel or rental in the trip builder; nearby beaches are a short drive further.",
        "Sí. Escriba su hotel o alojamiento exacto en el planificador de viajes; las playas cercanas quedan a poca distancia.",
      ),
  },
};
