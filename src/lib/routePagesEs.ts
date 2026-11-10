/**
 * Spanish text of the route landing pages. The Spanish pages live at
 * /es/traslados/<same slug as the English page>, so entries are keyed by that slug.
 * A page added to ROUTE_PAGES without an entry here shows in English until it is translated.
 * Copy: neutral Latin American Spanish, "usted", and "conductor" for driver.
 */
import type { PublicLang } from "./publicLang";
import type { RoutePage } from "./routePages";

/** Spanish text of a route page, keyed by its (English) slug. */
export interface RoutePageEs {
  title: string;
  metaDescription: string;
  intro: string;
  areaLabel: string;
  driveTitle: string;
  drive: string;
  /** Same questions, same order as the English page. */
  faqs: { q: string; a: string }[];
  /** Labels of the related rides, same order as the English `related`. */
  related: string[];
}

const DRIVE_TITLE = "Cómo es el recorrido";

const FAQ_PER_PERSON = {
  q: "¿El precio es por persona?",
  a: "No. El precio es por el vehículo completo, así que es el mismo si viaja un solo viajero o cuatro.",
};

const FAQ_LUGGAGE = {
  q: "¿Qué pasa con nuestro equipaje en las paradas?",
  a: "Se queda bajo llave en el vehículo y su conductor permanece con él mientras ustedes visitan la parada.",
};

export const ROUTE_PAGES_ES: Record<string, RoutePageEs> = {
  "sjo-airport-to-manuel-antonio": {
    title: "Traslado privado del aeropuerto SJO a Manuel Antonio",
    metaDescription:
      "Traslado privado puerta a puerta del aeropuerto de San José (SJO) a Manuel Antonio y Quepos. Precio fijo por vehículo, paradas opcionales (puente de los cocodrilos y lapas), conductores locales asociados.",
    intro:
      "Su conductor lo recibe en la salida de llegadas y lo lleva directo a la puerta de su hotel. Convierta el recorrido en parte del viaje con una parada en el puente de los cocodrilos de Tárcoles o una caminata para ver lapas en Carara.",
    areaLabel: "Manuel Antonio o Quepos",
    driveTitle: DRIVE_TITLE,
    drive:
      "Desde el aeropuerto se toma la Ruta 27 hacia el oeste y se baja al Pacífico en Orotina; luego se sigue la Costanera Sur a lo largo de la costa, pasando por Jacó y las plantaciones de palma aceitera de los alrededores de Parrita, hasta llegar a Quepos. El último tramo sube por la carretera de la colina hasta los hoteles de Manuel Antonio. El tráfico de fines de semana y feriados en la Ruta 27 puede sumar una hora, así que conviene tenerlo en cuenta al planificar la recogida.",
    faqs: [
      {
        q: "¿Traslado privado o shuttle compartido?",
        a: "Los shuttles compartidos tienen horarios fijos y paran en otros hoteles. Un traslado privado sale cuando usted está listo, lleva solo a su grupo y se detiene únicamente donde usted quiere.",
      },
      {
        q: "¿El precio es por persona?",
        a: "No. El precio es por el vehículo completo, así que es el mismo si viaja un solo viajero o cuatro. La cifra \"por persona\" muestra lo que paga cada viajero cuando el vehículo va lleno.",
      },
      FAQ_LUGGAGE,
      {
        q: "¿Cómo se paga?",
        a: "De dos maneras. Pague en línea el total: una vez que nuestro equipo confirma su traslado, le enviamos un enlace de pago seguro. O pague a su conductor en efectivo el día del viaje, más un cargo por reserva en efectivo de {cashFee} que aparece en el total de su viaje. Las expediciones de varios días se pagan en línea en su totalidad, porque los permisos de los parques, las lanchas y los lodges se reservan con anticipación.",
      },
    ],
    related: [
      "SJO → La Fortuna / Arenal",
      "SJO → Monteverde",
      "SJO → Puerto Viejo",
      "SJO → Sierpe (lancha a Bahía Drake)",
      "Manuel Antonio → La Fortuna",
    ],
  },
  "sjo-airport-to-la-fortuna-arenal": {
    title: "Traslado privado del aeropuerto SJO a La Fortuna (Arenal)",
    metaDescription:
      "Traslado privado puerta a puerta del aeropuerto de San José (SJO) a La Fortuna y el volcán Arenal. Precio fijo por vehículo, parada opcional en el volcán Poás y café, conductores locales asociados.",
    intro:
      "Su conductor lo recibe en la salida de llegadas y lo lleva por las montañas del Valle Central hasta su hotel en La Fortuna. Aproveche el día con una parada en el cráter del volcán Poás y en una finca de café de altura por el camino.",
    areaLabel: "La Fortuna o los alrededores del volcán Arenal",
    driveTitle: DRIVE_TITLE,
    drive:
      "Desde el aeropuerto se va hacia el oeste por la Ruta 1, pasando por pueblos cafetaleros como Grecia y Naranjo; luego se gira hacia el norte y se cruzan las montañas, ya sea por Ciudad Quesada o por San Ramón y La Tigra. La carretera baja a las verdes llanuras de San Carlos y, en un día despejado, el cono del volcán Arenal aparece al frente al llegar a La Fortuna. El tramo de montaña tiene muchas curvas y a menudo neblina, y la lluvia por la tarde es frecuente, por lo que los conductores mantienen un ritmo constante y prudente.",
    faqs: [
      {
        q: "¿Podemos visitar el volcán Poás por el camino?",
        a: "Sí. El Poás es un desvío hacia las montañas que están sobre el aeropuerto. La entrada es con boleto de horario fijo reservado con anticipación, y las nubes suelen tapar el cráter más tarde en el día, así que lo mejor es ir por la mañana.",
      },
      FAQ_PER_PERSON,
      {
        q: "¿Veremos el volcán?",
        a: "El Arenal suele estar envuelto en nubes, sobre todo por la tarde. La mejor oportunidad es temprano por la mañana, así que no se preocupe si está tapado cuando llegue.",
      },
      FAQ_LUGGAGE,
    ],
    related: [
      "La Fortuna → Monteverde",
      "La Fortuna → Manuel Antonio",
      "SJO → Monteverde",
      "SJO → Manuel Antonio",
      "Liberia (LIR) → La Fortuna",
    ],
  },
  "sjo-airport-to-monteverde": {
    title: "Traslado privado del aeropuerto SJO a Monteverde",
    metaDescription:
      "Traslado privado puerta a puerta del aeropuerto de San José (SJO) al bosque nuboso de Monteverde y Santa Elena. Precio fijo por vehículo, conductores locales asociados que conocen la carretera de montaña.",
    intro:
      "Su conductor lo recibe en la salida de llegadas y lo lleva desde el Valle Central hasta las tierras bajas del Pacífico y de nuevo hacia arriba, al bosque nuboso, hasta la puerta de su hotel en Monteverde o Santa Elena.",
    areaLabel: "Monteverde o Santa Elena",
    driveTitle: DRIVE_TITLE,
    drive:
      "Desde el aeropuerto se toma la Ruta 27 hacia el oeste, rumbo al Pacífico, y luego la Interamericana (Ruta 1) hacia el norte, por tierras bajas y secas de fincas ganaderas. Después del desvío comienza el último tramo: una subida empinada y con muchas curvas por la Ruta 606, pasando por Guacimal, hasta Santa Elena, a unos 1.400 m sobre el nivel del mar. Hoy está asfaltada, pero las curvas cerradas, la neblina y los fuertes vientos de la época seca obligan a ir despacio; por eso el viaje completo dura más de tres horas.",
    faqs: [
      {
        q: "¿La carretera a Monteverde sigue sin asfaltar?",
        a: "La subida principal por la Ruta 606 hoy está asfaltada, pero es angosta, empinada y con muchas curvas. Nuestros conductores asociados la recorren con frecuencia y la manejan a un ritmo seguro.",
      },
      {
        q: "¿Hará frío en Monteverde?",
        a: "Más fresco que en la costa. Las noches suelen ser neblinosas, ventosas y de unos 15–18 °C, así que tenga a mano una chaqueta liviana y una capa para la lluvia, en lugar de guardarlas en el fondo de la maleta.",
      },
      FAQ_PER_PERSON,
      {
        q: "¿Podemos parar a descansar por el camino?",
        a: "Sí. Dígale a su conductor cuándo quiere una parada para ir al baño, tomar un café o comer algo; hay buenos lugares a lo largo de la carretera antes de la subida.",
      },
    ],
    related: [
      "La Fortuna → Monteverde",
      "SJO → La Fortuna / Arenal",
      "Monteverde → Manuel Antonio",
      "Monteverde → Tamarindo",
      "Liberia (LIR) → Monteverde",
    ],
  },
  "liberia-airport-to-tamarindo": {
    title: "Traslado privado del aeropuerto de Liberia (LIR) a Tamarindo",
    metaDescription:
      "Traslado privado puerta a puerta del aeropuerto de Liberia (LIR) a Tamarindo y las playas cercanas de Guanacaste. Precio fijo por vehículo, conductores locales asociados.",
    intro:
      "Liberia es el aeropuerto internacional más cercano a Tamarindo. Su conductor lo recibe en la salida de llegadas y lo lleva directo a su hotel o casa de alquiler, sin las paradas de un shuttle en otros hoteles por el camino.",
    areaLabel: "Tamarindo, Langosta o Playa Grande",
    driveTitle: DRIVE_TITLE,
    drive:
      "Desde el aeropuerto se toma la Ruta 21 hacia el suroeste, por las llanuras de fincas ganaderas y bosque seco de Guanacaste, rumbo a Belén; luego se sigue la carretera que pasa por Huacas y Villarreal y baja a Tamarindo. Es un recorrido fácil y casi todo recto, de aproximadamente una hora y cuarto. Por la tarde, cuente con tráfico más lento al cruzar los pueblos pequeños y en el propio Tamarindo.",
    faqs: [
      {
        q: "¿Conviene volar a Liberia o a San José para ir a Tamarindo?",
        a: "Liberia (LIR) queda mucho más cerca: aproximadamente una hora y cuarto por carretera, frente a unas cinco horas desde San José (SJO).",
      },
      {
        q: "¿Pueden dejarnos en Playa Grande o en Langosta?",
        a: "Sí. Indique su hotel o casa de alquiler exactos en el planificador de viajes; las playas cercanas quedan a un corto trayecto más.",
      },
      FAQ_PER_PERSON,
      {
        q: "¿Podemos parar a comprar víveres por el camino?",
        a: "Sí. Muchos viajeros que se alojan en casas de alquiler piden una parada rápida en el supermercado; solo dígaselo a su conductor.",
      },
    ],
    related: [
      "SJO → Tamarindo",
      "Liberia (LIR) → La Fortuna",
      "Liberia (LIR) → Monteverde",
      "Tamarindo → La Fortuna",
    ],
  },
  "sjo-airport-to-tamarindo": {
    title: "Traslado privado del aeropuerto SJO a Tamarindo",
    metaDescription:
      "Traslado privado puerta a puerta del aeropuerto de San José (SJO) hasta Tamarindo, en Guanacaste. Precio fijo por vehículo, paradas de descanso cuando usted quiera, conductores locales asociados.",
    intro:
      "¿Aterrizó en San José pero se aloja en Tamarindo? Su conductor lo recibe en la salida de llegadas y lo lleva hasta la costa de Guanacaste, con paradas cada vez que necesite un descanso.",
    areaLabel: "Tamarindo, Langosta o Playa Grande",
    driveTitle: DRIVE_TITLE,
    drive:
      "Desde el aeropuerto se toma la Ruta 27 hacia el oeste hasta el Pacífico y luego la Interamericana (Ruta 1) hacia el norte, por las tierras bajas. Se gira hacia la Ruta 18 y se cruza el río Tempisque por el Puente de la Amistad para entrar en la península de Nicoya; después se continúa hacia el norte por la Ruta 21, pasando por Santa Cruz, hasta Tamarindo. Es una jornada larga, de unas cinco horas; el tráfico de salida de San José los viernes y feriados puede sumar más tiempo.",
    faqs: [
      {
        q: "¿Es mejor volar a Liberia?",
        a: "Si puede, sí: Liberia (LIR) está a aproximadamente una hora y cuarto de Tamarindo. Desde San José, un traslado privado es la forma más sencilla de cruzar el país con todo su equipaje.",
      },
      {
        q: "¿Podemos dividir el recorrido con paradas?",
        a: "Sí. Dígale a su conductor cuándo quiere una parada para ir al baño, comer o tomar un café. La mayoría de los grupos para una vez, más o menos a mitad de camino.",
      },
      FAQ_PER_PERSON,
      {
        q: "Aterrizamos tarde. ¿Es un problema?",
        a: "Indíquenos su hora de llegada al reservar. Cuando el vuelo aterriza tarde, muchos viajeros pasan la primera noche cerca del aeropuerto y hacen el recorrido a la mañana siguiente, con luz de día.",
      },
    ],
    related: [
      "Liberia (LIR) → Tamarindo",
      "SJO → La Fortuna / Arenal",
      "SJO → Monteverde",
      "Tamarindo → La Fortuna",
    ],
  },
  "sjo-airport-to-puerto-viejo": {
    title: "Traslado privado del aeropuerto SJO a Puerto Viejo",
    metaDescription:
      "Traslado privado puerta a puerta del aeropuerto de San José (SJO) a Puerto Viejo, en la costa del Caribe, por el bosque lluvioso del Braulio Carrillo. Precio fijo por vehículo, conductores locales asociados.",
    intro:
      "Su conductor lo recibe en la salida de llegadas y lo lleva a través del bosque lluvioso del Parque Nacional Braulio Carrillo y hacia abajo, hasta el Caribe, a la puerta de su hotel en Puerto Viejo, Cocles o Playa Chiquita.",
    areaLabel: "Puerto Viejo, Cocles, Playa Chiquita o Manzanillo",
    driveTitle: DRIVE_TITLE,
    drive:
      "Desde el aeropuerto se toma la Ruta 32 hacia el noreste, que atraviesa el Parque Nacional Braulio Carrillo: una carretera empinada y con muchas curvas entre bosque lluvioso y neblina. Se baja a las tierras bajas del Caribe, pasando por Guápiles y las plantaciones de banano de los alrededores de Siquirres, hasta Limón; luego se sigue la Ruta 36 hacia el sur a lo largo de la costa, pasando por Cahuita, hasta Puerto Viejo. Las lluvias fuertes pueden cerrar la Ruta 32 por derrumbes; cuando eso ocurre, los conductores toman la carretera más larga por Turrialba, lo que suma tiempo.",
    faqs: [
      {
        q: "¿Qué pasa si la Ruta 32 está cerrada?",
        a: "Ocurre después de lluvias muy fuertes. Su conductor revisa las condiciones antes de salir y, si hace falta, toma la carretera alterna por Turrialba. Lo mantenemos informado por WhatsApp.",
      },
      {
        q: "¿Pueden dejarnos al sur de Puerto Viejo?",
        a: "Sí. Cocles, Playa Chiquita, Punta Uva y Manzanillo están todos sobre la misma carretera costera; indique su hotel exacto en el planificador de viajes.",
      },
      FAQ_PER_PERSON,
      {
        q: "¿Podemos parar en Cahuita?",
        a: "Sí. Cahuita queda justo en el camino, así que es fácil hacer una parada corta para almorzar o conocer el pueblo. Solo dígaselo a su conductor.",
      },
    ],
    related: [
      "SJO → La Fortuna / Arenal",
      "SJO → Manuel Antonio",
      "Puerto Viejo → La Fortuna",
      "SJO → Monteverde",
    ],
  },
  "la-fortuna-to-monteverde": {
    title: "Traslado privado de La Fortuna (Arenal) a Monteverde",
    metaDescription:
      "Traslado privado puerta a puerta de La Fortuna y Arenal a Monteverde, bordeando el lago Arenal. Precio fijo por vehículo, conductores locales asociados que conocen las carreteras de montaña.",
    intro:
      "Su conductor lo recoge en su hotel de La Fortuna y toma la carretera panorámica que bordea el lago Arenal y sube al bosque nuboso, puerta a puerta y con su equipaje durante todo el trayecto.",
    areaLabel: "Monteverde o Santa Elena",
    driveTitle: DRIVE_TITLE,
    drive:
      "Los dos pueblos parecen cercanos en el mapa, pero no hay una carretera directa. Se bordea la orilla norte del lago Arenal por la Ruta 142, pasando por la represa, Nuevo Arenal y Tilarán, con vistas del lago y del volcán por el camino. El último tramo sube de Tilarán a Santa Elena por una carretera de montaña que en parte es de lastre y está en mal estado en algunos puntos; por eso el viaje dura unas tres horas y media.",
    faqs: [
      {
        q: "¿No es más rápido el jeep-boat-jeep?",
        a: "Puede serlo, pero se cambia de vehículo dos veces y hay que subir las maletas a una lancha para cruzar el lago. Un traslado privado es puerta a puerta, y su equipaje va siempre en el mismo vehículo.",
      },
      {
        q: "¿La carretera está en mal estado?",
        a: "Algunas partes de la subida final a Santa Elena son de lastre. Nuestros conductores asociados la recorren con frecuencia en vehículos adecuados para esa carretera.",
      },
      FAQ_PER_PERSON,
      {
        q: "¿Podemos parar en el lago?",
        a: "Sí. Hay miradores y cafés a lo largo del lago Arenal; dígale a su conductor dónde le gustaría detenerse.",
      },
    ],
    related: [
      "SJO → Monteverde",
      "La Fortuna → Manuel Antonio",
      "SJO → La Fortuna / Arenal",
      "Monteverde → Manuel Antonio",
      "Monteverde → Tamarindo",
    ],
  },
  "la-fortuna-to-manuel-antonio": {
    title: "Traslado privado de La Fortuna (Arenal) a Manuel Antonio",
    metaDescription:
      "Traslado privado puerta a puerta de La Fortuna y Arenal a Manuel Antonio y Quepos. Precio fijo por vehículo, paradas opcionales (puente de los cocodrilos y lapas), conductores locales asociados.",
    intro:
      "Del volcán a la playa en un solo viaje. Su conductor lo recoge en su hotel de La Fortuna y lo lleva al Pacífico, con paradas opcionales por el camino en el puente de los cocodrilos de Tárcoles o para una caminata para ver lapas en Carara.",
    areaLabel: "Manuel Antonio o Quepos",
    driveTitle: DRIVE_TITLE,
    drive:
      "Desde La Fortuna se sube hacia el sur por las montañas, pasando por La Tigra, hasta San Ramón; luego se toman la Ruta 1 y la Ruta 27 para bajar al Pacífico en Orotina. Desde allí, la Costanera Sur sigue la costa, pasando por Tárcoles, Jacó y las plantaciones de palma aceitera de los alrededores de Parrita, hasta Quepos, y después la carretera de la colina sube a los hoteles de Manuel Antonio. Calcule unas cinco horas más las paradas; el tramo de montaña tiene muchas curvas y a menudo llueve.",
    faqs: [
      {
        q: "¿Qué paradas se pueden hacer en esta ruta?",
        a: "El puente de los cocodrilos de Tárcoles y la caminata para ver lapas rojas en Carara están ambos sobre la carretera costera, antes de Jacó, así que agregan muy poco tiempo de manejo.",
      },
      FAQ_PER_PERSON,
      FAQ_LUGGAGE,
      {
        q: "¿A qué hora conviene salir?",
        a: "Si sale por la mañana, llega a la costa con luz de día y con tiempo para una parada. La lluvia por la tarde es frecuente en las montañas, sobre todo de mayo a noviembre.",
      },
    ],
    related: [
      "SJO → Manuel Antonio",
      "SJO → La Fortuna / Arenal",
      "La Fortuna → Monteverde",
      "SJO → Sierpe (lancha a Bahía Drake)",
      "Manuel Antonio → Sierpe (lancha a Bahía Drake)",
    ],
  },
  "sjo-airport-to-sierpe-drake-bay": {
    title: "Traslado privado del aeropuerto SJO a Sierpe (lancha a Bahía Drake)",
    metaDescription:
      "Traslado privado del aeropuerto de San José (SJO) al muelle de Sierpe para tomar la lancha a Bahía Drake y Corcovado. Precio fijo por vehículo, conductores locales asociados.",
    intro:
      "La mayoría de los viajeros llega a Bahía Drake en lancha desde Sierpe. Su conductor lo lleva desde el aeropuerto por la costa del Pacífico hasta el muelle de Sierpe, con el horario ajustado al de su lancha.",
    areaLabel: "Sierpe, o directamente en el muelle",
    driveTitle: DRIVE_TITLE,
    drive:
      "Desde el aeropuerto se toma la Ruta 27 hacia el oeste hasta el Pacífico y luego la Costanera Sur hacia el sur a lo largo de la costa, pasando por Jacó, Quepos, Dominical y Uvita, hasta Palmar Norte, donde una carretera local corta lleva al pueblo ribereño de Sierpe. Después, la lancha serpentea por el río Sierpe entre manglares, cruza la desembocadura del río y sigue la costa hasta Bahía Drake: más o menos una hora en el agua. Solo el recorrido por carretera dura unas cinco horas, así que conviene salir temprano.",
    faqs: [
      {
        q: "¿Quién organiza la lancha a Bahía Drake?",
        a: "La mayoría de los lodges de Bahía Drake reserva a sus huéspedes en una lancha desde Sierpe. Díganos cuál es su lodge y la hora de su lancha, y planificamos la recogida para que llegue al muelle con tiempo de sobra.",
      },
      {
        q: "¿A qué hora salen las lanchas?",
        a: "Por lo general, al final de la mañana y a primera hora de la tarde, y el cruce de la desembocadura del río solo se hace con luz de día. Si llega en un vuelo internacional, a menudo hay que pasar primero una noche cerca del aeropuerto o en Sierpe.",
      },
      {
        q: "¿Necesitamos permisos para Corcovado?",
        a: "Sí. El Parque Nacional Corcovado exige permisos del SINAC y un guía certificado, reservados con anticipación, y los espacios para pasar la noche en la Estación Sirena son limitados. Resérvelos antes de su viaje.",
      },
      {
        q: "¿Podemos parar por el camino?",
        a: "Sí, si hay tiempo antes de su lancha. El puente de los cocodrilos de Tárcoles y la caminata para ver lapas en Carara quedan sobre la carretera costera.",
      },
    ],
    related: [
      "SJO → Manuel Antonio",
      "Manuel Antonio → Sierpe (lancha a Bahía Drake)",
      "La Fortuna → Manuel Antonio",
      "SJO → Puerto Viejo",
    ],
  },
};

/** The page in `lang`: Spanish text when we have it, otherwise the English page (e.g. a page added later). */
export function localizeRoutePage(page: RoutePage, lang: PublicLang): RoutePage {
  if (lang !== "es") return page;
  const es = ROUTE_PAGES_ES[page.slug];
  if (!es) return page;
  return {
    ...page,
    title: es.title,
    metaDescription: es.metaDescription,
    intro: es.intro,
    areaLabel: es.areaLabel,
    driveTitle: es.driveTitle,
    drive: es.drive,
    faqs: es.faqs,
    related: page.related.map((r, i) => ({ ...r, label: es.related[i] ?? r.label })),
  };
}
