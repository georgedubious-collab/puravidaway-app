/**
 * Corridors between two destinations (no airport at either end). Rules: ./types.ts.
 * Bus, shuttle and flight notes are general on purpose: no timetables, fares or terminals.
 */
import { ROUTES_UPDATED as updated, l, q, way } from "./make";
import type { Corridor } from "./types";

const NO_DIRECT_FLIGHT = (en: string, es: string) =>
  way(
    "flight",
    `There is no practical flight between ${en}: domestic flights are organised around San José, so flying generally means connecting there. Check the airlines' current routes.`,
    `No hay un vuelo práctico entre ${es}: los vuelos nacionales se organizan alrededor de San José, así que volar por lo general implica hacer conexión allí. Revise las rutas vigentes de las aerolíneas.`,
  );

export const TOWN_CORRIDORS: Corridor[] = [
  // ───────── La Fortuna ↔ Monteverde ─────────
  {
    a: "Arenal",
    b: "Monteverde",
    updated,
    hook: l("around Lake Arenal, door to door", "bordeando el lago Arenal, de puerta a puerta"),
    road: l(
      "La Fortuna and Monteverde look close on the map, but there's no direct road between them. The ride goes around the north shore of Lake Arenal on Route 142, past the dam, Nuevo Arenal and Tilarán, with lake and volcano views along the way. Between Tilarán and Santa Elena the mountain road is partly gravel and rough in places, which is why the trip takes as long as it does.",
      "La Fortuna y Monteverde parecen cercanos en el mapa, pero no hay carretera directa entre ellos. El traslado bordea la orilla norte del lago Arenal por la Ruta 142, pasando por la represa, Nuevo Arenal y Tilarán, con vistas del lago y del volcán por el camino. Entre Tilarán y Santa Elena la carretera de montaña es en parte de lastre y está en mal estado en algunos puntos; por eso el viaje dura lo que dura.",
    ),
    ways: [
      way(
        "bus",
        "There is no direct public bus. The trip by bus needs a change in Tilarán and takes most of a day.",
        "No hay bus público directo. El viaje en bus requiere un cambio en Tilarán y toma buena parte de un día.",
      ),
      way(
        "shuttle",
        "Shared shuttles run this route at fixed times. The well-known alternative is the jeep-boat-jeep (also sold as taxi-boat-taxi): a van to the lake, a boat across it and another van up to Monteverde, with two vehicle changes.",
        "Hay shuttles compartidos en horarios fijos. La alternativa más conocida es el jeep-boat-jeep (también vendido como taxi-boat-taxi): un microbús hasta el lago, una lancha para cruzarlo y otro microbús hasta Monteverde, con dos cambios de vehículo.",
      ),
      way("flight", "There are no flights between La Fortuna and Monteverde; Monteverde has no airport.", "No hay vuelos entre La Fortuna y Monteverde; Monteverde no tiene aeropuerto."),
      way(
        "car",
        "The lake road is paved and winding; the final climb has gravel stretches where a vehicle with good clearance helps.",
        "La carretera del lago está pavimentada y tiene muchas curvas; la subida final tiene tramos de lastre donde ayuda un vehículo alto.",
      ),
    ],
    faqs: [
      q(
        "Isn't the jeep-boat-jeep faster?",
        "¿No es más rápido el jeep-boat-jeep?",
        "It can be, but you change vehicles twice and carry your bags onto a boat across the lake. A private ride is door to door, with your luggage staying in one vehicle.",
        "Puede serlo, pero se cambia de vehículo dos veces y hay que subir las maletas a una lancha para cruzar el lago. Un traslado privado es de puerta a puerta, y su equipaje va siempre en el mismo vehículo.",
      ),
      q(
        "Is the road rough?",
        "¿La carretera está en mal estado?",
        "Parts of the mountain road between Tilarán and Santa Elena are gravel. Our partner drivers do it regularly in vehicles suited to the road.",
        "Algunos tramos de la carretera de montaña entre Tilarán y Santa Elena son de lastre. Nuestros conductores asociados la recorren con frecuencia en vehículos adecuados para ese camino.",
      ),
      q(
        "Can we stop at the lake?",
        "¿Podemos parar en el lago?",
        "Yes. There are lookout points and cafés along Lake Arenal; tell your driver where you'd like to pause.",
        "Sí. Hay miradores y cafés a lo largo del lago Arenal; dígale a su conductor dónde le gustaría hacer una pausa.",
      ),
    ],
    ab: {
      lead: l(
        "Your driver picks you up at your La Fortuna hotel and takes the scenic road around Lake Arenal and up into the cloud forest, door to door with your luggage the whole way.",
        "Su conductor lo recoge en su hotel de La Fortuna y toma la carretera panorámica que bordea el lago Arenal y sube al bosque nuboso, de puerta a puerta y con su equipaje todo el trayecto.",
      ),
      faq: q(
        "Can we fit an activity in La Fortuna before leaving for Monteverde?",
        "¿Alcanza para una actividad en La Fortuna antes de salir hacia Monteverde?",
        "A morning one, yes. The ride takes about {time:Arenal>Monteverde}, so leave by early afternoon to do the mountain road in daylight.",
        "Una por la mañana, sí. El traslado toma aproximadamente {time:Arenal>Monteverde}, así que salga a más tardar a primera hora de la tarde para hacer la carretera de montaña con luz de día.",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up in Monteverde or Santa Elena, comes down the mountain to Tilarán and follows the lake shore to your hotel in La Fortuna, with Arenal Volcano ahead of you on a clear day.",
        "Su conductor lo recoge en Monteverde o Santa Elena, baja la montaña hasta Tilarán y sigue la orilla del lago hasta su hotel en La Fortuna, con el volcán Arenal al frente en un día despejado.",
      ),
      faq: q(
        "Can we end the day in the hot springs?",
        "¿Podemos terminar el día en las aguas termales?",
        "Yes. Leave Monteverde in the morning and, about {time:Monteverde>Arenal} later, you are in La Fortuna with the afternoon and evening free; most hot springs are on the road west of town.",
        "Sí. Salga de Monteverde por la mañana y, aproximadamente {time:Monteverde>Arenal} después, estará en La Fortuna con la tarde y la noche libres; la mayoría de las aguas termales queda sobre la carretera al oeste del pueblo.",
      ),
    },
  },

  // ───────── La Fortuna ↔ Manuel Antonio ─────────
  {
    a: "Arenal",
    b: "ManuelAntonio",
    updated,
    hook: l("volcano to beach, with the sloth trail as an optional stop", "del volcán a la playa, con el sendero de perezosos como parada opcional"),
    road: l(
      "Between La Fortuna and Manuel Antonio the road crosses the mountains through La Tigra and San Ramón, joins Route 1 and Route 27 down to the Pacific at Orotina and then follows the Costanera Sur along the coast past Jacó and the oil-palm plantations around Parrita to Quepos. The mountain section is winding and often rainy; the coastal half is flat and fast.",
      "Entre La Fortuna y Manuel Antonio la carretera cruza las montañas por La Tigra y San Ramón, se une a la Ruta 1 y a la Ruta 27 para bajar al Pacífico en Orotina, y luego sigue la Costanera Sur a lo largo de la costa, pasando por Jacó y las plantaciones de palma aceitera de Parrita, hasta Quepos. El tramo de montaña tiene muchas curvas y suele llover; la mitad costera es plana y rápida.",
    ),
    ways: [
      way(
        "bus",
        "There is no direct public bus. By bus the trip takes at least one change and a full day.",
        "No hay bus público directo. En bus, el viaje requiere al menos un cambio y un día completo.",
      ),
      way(
        "shuttle",
        "Shared shuttles run directly between La Fortuna and Manuel Antonio at fixed times, with stops at several hotels at each end.",
        "Hay shuttles compartidos directos entre La Fortuna y Manuel Antonio en horarios fijos, con paradas en varios hoteles en cada extremo.",
      ),
      NO_DIRECT_FLIGHT("La Fortuna and Quepos", "La Fortuna y Quepos"),
      way(
        "car",
        "All paved. The mountain half is slow, with fog and rain in the afternoon, so do it in the morning.",
        "Todo pavimentado. La mitad de montaña es lenta, con neblina y lluvia por la tarde, así que conviene hacerla por la mañana.",
      ),
    ],
    faqs: [
      q(
        "What time should we leave?",
        "¿A qué hora conviene salir?",
        "A morning start gets you to the other end in daylight. Afternoon rain is common in the mountains, especially from May to November.",
        "Saliendo por la mañana llega al otro extremo con luz de día. La lluvia por la tarde es frecuente en las montañas, sobre todo de mayo a noviembre.",
      ),
      q(
        "Which stops can we add between La Fortuna and Manuel Antonio?",
        "¿Qué paradas se pueden agregar entre La Fortuna y Manuel Antonio?",
        "The sloth and wildlife trail in La Fortuna, at the start or the end of the ride. The stop list on this page shows what the trip builder offers for this ride, with length and price.",
        "El sendero de perezosos y vida silvestre de La Fortuna, al inicio o al final del traslado. La lista de paradas de esta página muestra lo que ofrece el planificador de viajes para este traslado, con duración y precio.",
      ),
      q(
        "Can we stop for lunch on the coast?",
        "¿Podemos parar a almorzar en la costa?",
        "Yes. Tell your driver; the coastal highway has plenty of places to eat around Jacó. Your luggage stays locked in the vehicle.",
        "Sí. Dígaselo a su conductor; sobre la Costanera hay muchos lugares para comer en los alrededores de Jacó. Su equipaje queda bajo llave en el vehículo.",
      ),
    ],
    ab: {
      lead: l(
        "Go from volcano to beach in one ride. Your driver picks you up at your La Fortuna hotel and takes you over the mountains and down the Pacific coast to your hotel in Manuel Antonio.",
        "Pase del volcán a la playa en un solo traslado. Su conductor lo recoge en su hotel de La Fortuna y lo lleva por las montañas y por la costa del Pacífico hasta su hotel en Manuel Antonio.",
      ),
      faq: q(
        "Is this too long for one day with children?",
        "¿Es demasiado largo para un solo día con niños?",
        "It is a long ride, about {time:Arenal>ManuelAntonio}, but it is yours alone: you choose when to stop to eat or stretch. Child seats are free on request when you book.",
        "Es un traslado largo, de aproximadamente {time:Arenal>ManuelAntonio}, pero es solo para ustedes: usted decide cuándo parar a comer o a estirar las piernas. Las sillas para niños son gratis a solicitud al reservar.",
      ),
    },
    ba: {
      lead: l(
        "From the beach to the volcano: your driver picks you up in Manuel Antonio or Quepos, follows the coast north and climbs over the mountains to La Fortuna.",
        "De la playa al volcán: su conductor lo recoge en Manuel Antonio o Quepos, sigue la costa hacia el norte y cruza las montañas hasta La Fortuna.",
      ),
      faq: q(
        "Will we reach La Fortuna before dark?",
        "¿Llegaremos a La Fortuna antes de que oscurezca?",
        "With a morning pickup, yes: the ride is about {time:ManuelAntonio>Arenal} and it gets dark around 6 PM all year. The mountain stretch comes last in this direction, so an early start matters more.",
        "Con una recogida por la mañana, sí: el traslado toma aproximadamente {time:ManuelAntonio>Arenal} y oscurece cerca de las 6 p. m. todo el año. En este sentido el tramo de montaña queda al final, así que salir temprano importa más.",
      ),
    },
  },

  // ───────── Monteverde ↔ Manuel Antonio ─────────
  {
    a: "Monteverde",
    b: "ManuelAntonio",
    updated,
    hook: l("cloud forest to coast, with optional crocodile bridge and macaw stops", "del bosque nuboso a la costa, con paradas opcionales en el puente de los cocodrilos y para ver lapas"),
    road: l(
      "Between Monteverde and Manuel Antonio the ride starts or ends with the steep, winding mountain road through Guacimal, which links Santa Elena with the Inter-American Highway in the lowlands. From the Puntarenas area the coastal highway runs across the Tárcoles River, past Jacó and Parrita, to Quepos. You go from about 1,400 m to sea level, and from jacket weather to beach heat.",
      "Entre Monteverde y Manuel Antonio el traslado empieza o termina con la carretera de montaña, empinada y con curvas, que pasa por Guacimal y une Santa Elena con la Interamericana, en las tierras bajas. Desde la zona de Puntarenas la Costanera cruza el río Tárcoles y pasa por Jacó y Parrita hasta Quepos. Se pasa de unos 1.400 m al nivel del mar, y del clima de chaqueta al calor de playa.",
    ),
    ways: [
      way(
        "bus",
        "There is no direct public bus. The usual way by bus is a change in Puntarenas and another in Quepos for the local bus to Manuel Antonio: a full day.",
        "No hay bus público directo. Lo habitual en bus es un cambio en Puntarenas y otro en Quepos para tomar el bus local a Manuel Antonio: un día completo.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between Monteverde and Manuel Antonio at fixed times, with stops at several hotels.",
        "Hay shuttles compartidos entre Monteverde y Manuel Antonio en horarios fijos, con paradas en varios hoteles.",
      ),
      way("flight", "There are no flights: Monteverde has no airport.", "No hay vuelos: Monteverde no tiene aeropuerto."),
      way(
        "car",
        "The mountain road is paved but steep and slow; the coastal highway is easy. Many side roads in Monteverde are gravel.",
        "La carretera de montaña está pavimentada, pero es empinada y lenta; la Costanera es fácil. Muchos caminos secundarios de Monteverde son de lastre.",
      ),
    ],
    faqs: [
      q(
        "Can we see the crocodiles between Monteverde and Manuel Antonio?",
        "¿Podemos ver los cocodrilos entre Monteverde y Manuel Antonio?",
        "Yes. The Tárcoles bridge is right on the coastal highway on this ride, and the Carara macaw walk is next to it. Both are offered as stops; your luggage stays locked in the vehicle with your driver.",
        "Sí. El puente de Tárcoles queda sobre la Costanera en este traslado, y la caminata de las lapas de Carara está al lado. Las dos se ofrecen como paradas; su equipaje queda bajo llave en el vehículo con su conductor.",
      ),
      q(
        "How should we dress for this ride?",
        "¿Cómo conviene vestirse para este traslado?",
        "In layers. Monteverde is cool and often misty, and a couple of hours away the coast is hot and humid.",
        "En capas. Monteverde es fresco y a menudo neblinoso, y a un par de horas la costa es caliente y húmeda.",
      ),
      q(
        "Does the route pass through San José?",
        "¿La ruta pasa por San José?",
        "No. It stays on the Pacific side the whole way, which is why it is shorter than it looks on a map of the country.",
        "No. Va siempre por el lado del Pacífico, por eso es más corta de lo que parece en un mapa del país.",
      ),
    ],
    ab: {
      lead: l(
        "Your driver picks you up at your hotel in Monteverde or Santa Elena, takes the mountain road down and follows the Pacific coast to your hotel in Manuel Antonio.",
        "Su conductor lo recoge en su hotel de Monteverde o Santa Elena, baja la carretera de montaña y sigue la costa del Pacífico hasta su hotel en Manuel Antonio.",
      ),
      faq: q(
        "Can we be on the beach the same afternoon?",
        "¿Podemos estar en la playa esa misma tarde?",
        "Yes, with a morning pickup: the ride takes about {time:Monteverde>ManuelAntonio}, a little more with a stop at the crocodile bridge.",
        "Sí, con una recogida por la mañana: el traslado toma aproximadamente {time:Monteverde>ManuelAntonio}, un poco más con una parada en el puente de los cocodrilos.",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up in Manuel Antonio or Quepos, follows the coast north and then climbs from the hot lowlands into the cloud forest, to the door of your hotel.",
        "Su conductor lo recoge en Manuel Antonio o Quepos, sigue la costa hacia el norte y luego sube de las tierras bajas y calurosas al bosque nuboso, hasta la puerta de su hotel.",
      ),
      faq: q(
        "Will we get to Monteverde in time for a night walk?",
        "¿Llegaremos a Monteverde a tiempo para una caminata nocturna?",
        "With a morning pickup, comfortably: the ride is about {time:ManuelAntonio>Monteverde}. Book the night walk yourself or through your hotel, and keep a jacket out of the suitcase.",
        "Con una recogida por la mañana, con holgura: el traslado toma aproximadamente {time:ManuelAntonio>Monteverde}. Reserve la caminata nocturna por su cuenta o por medio de su hotel, y deje una chaqueta fuera de la maleta.",
      ),
    },
  },

  // ───────── La Fortuna ↔ Tamarindo ─────────
  {
    a: "Arenal",
    b: "Tamarindo",
    updated,
    hook: l("from the volcano to the Guanacaste beaches", "del volcán a las playas de Guanacaste"),
    road: l(
      "Between La Fortuna and Tamarindo the ride circles Lake Arenal to Tilarán, drops to the Inter-American Highway at Cañas and crosses Guanacaste's dry lowlands by way of Liberia, before Route 21 and the road through Belén and Huacas lead to the coast. The lake section is winding and green; the Guanacaste half is flat, straight and hot.",
      "Entre La Fortuna y Tamarindo el traslado rodea el lago Arenal hasta Tilarán, baja a la Interamericana en Cañas y cruza las tierras bajas y secas de Guanacaste pasando por Liberia, antes de que la Ruta 21 y la carretera que pasa por Belén y Huacas lleven a la costa. El tramo del lago es verde y con curvas; la mitad de Guanacaste es plana, recta y calurosa.",
    ),
    ways: [
      way(
        "bus",
        "There is no direct public bus. By bus it is a chain of changes, in Tilarán, Cañas and Liberia, and a very long day.",
        "No hay bus público directo. En bus es una cadena de cambios, en Tilarán, Cañas y Liberia, y un día muy largo.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between La Fortuna and Tamarindo at fixed times, with stops at several hotels.",
        "Hay shuttles compartidos entre La Fortuna y Tamarindo en horarios fijos, con paradas en varios hoteles.",
      ),
      NO_DIRECT_FLIGHT("La Fortuna and Tamarindo", "La Fortuna y Tamarindo"),
      way(
        "car",
        "Paved all the way. Map apps sometimes suggest steep gravel shortcuts near Tilarán; stay on the main road around the lake.",
        "Pavimentado todo el camino. Las aplicaciones de mapas a veces proponen atajos de lastre empinados cerca de Tilarán; siga la carretera principal que bordea el lago.",
      ),
    ],
    faqs: [
      q(
        "Is the lake part of the road hard on the stomach?",
        "¿El tramo del lago marea?",
        "It has many curves for the first or last hour and a half. Sit in front if you are prone to motion sickness and ask your driver for a pause at one of the lake lookouts.",
        "Tiene muchas curvas durante la primera o la última hora y media. Siéntese adelante si es propenso al mareo y pídale a su conductor una pausa en alguno de los miradores del lago.",
      ),
      q(
        "Where do people stop between La Fortuna and Tamarindo?",
        "¿Dónde se suele parar entre La Fortuna y Tamarindo?",
        "Along the lake for a coffee and the view, and around Cañas or Liberia for lunch. Tell your driver what you feel like; the ride is yours alone.",
        "A lo largo del lago para un café y la vista, y por Cañas o Liberia para almorzar. Dígale a su conductor qué le apetece; el traslado es solo para ustedes.",
      ),
      q(
        "Is a private ride worth it against the shuttle on this route?",
        "¿Vale la pena un traslado privado frente al shuttle en esta ruta?",
        "For three or more travellers, compare the totals: the price here is for the whole vehicle, {price:Arenal>Tamarindo} for up to {pax:Arenal>Tamarindo} people in green season. You also leave when you want and skip the other hotels.",
        "Para tres o más viajeros, compare los totales: el precio aquí es por el vehículo completo, {price:Arenal>Tamarindo} para hasta {pax:Arenal>Tamarindo} personas en temporada verde. Además, sale cuando quiere y se ahorra el paso por otros hoteles.",
      ),
    ],
    ab: {
      lead: l(
        "Your driver picks you up at your La Fortuna hotel and takes you around the lake and across Guanacaste to your hotel or rental in Tamarindo, Langosta or Playa Grande.",
        "Su conductor lo recoge en su hotel de La Fortuna y lo lleva bordeando el lago y a través de Guanacaste hasta su hotel o casa de alquiler en Tamarindo, Langosta o Playa Grande.",
      ),
      faq: q(
        "Can we catch the sunset in Tamarindo on the day we travel?",
        "¿Alcanzamos a ver el atardecer en Tamarindo el día del viaje?",
        "Yes, if you leave in the morning: the ride takes about {time:Arenal>Tamarindo} and sunset is around 5:30 to 6 PM.",
        "Sí, si sale por la mañana: el traslado toma aproximadamente {time:Arenal>Tamarindo} y el atardecer es entre las 5:30 y las 6 p. m.",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up in Tamarindo, crosses Guanacaste's plains and climbs to Lake Arenal, with the volcano growing in the windscreen for the last part of the ride.",
        "Su conductor lo recoge en Tamarindo, cruza las llanuras de Guanacaste y sube al lago Arenal, con el volcán cada vez más grande en el parabrisas durante la última parte del traslado.",
      ),
      faq: q(
        "Should we leave the beach early for this ride?",
        "¿Conviene salir temprano de la playa para este traslado?",
        "Yes. At about {time:Tamarindo>Arenal}, a morning start puts the winding lake road in daylight, when you can also enjoy the views.",
        "Sí. Con aproximadamente {time:Tamarindo>Arenal} de viaje, saliendo por la mañana se hace la carretera del lago con luz de día, cuando además se disfrutan las vistas.",
      ),
    },
  },

  // ───────── Monteverde ↔ Tamarindo ─────────
  {
    a: "Monteverde",
    b: "Tamarindo",
    updated,
    hook: l("from the cloud forest to the Guanacaste coast", "del bosque nuboso a la costa de Guanacaste"),
    road: l(
      "Between Monteverde and Tamarindo the slow part is the mountain: steep, winding roads link Santa Elena with the Inter-American Highway in the lowlands. From there the ride crosses Guanacaste's flat ranch land to the coast, either over the Tempisque River bridge and through Santa Cruz or by way of Liberia; drivers choose according to traffic and road works.",
      "Entre Monteverde y Tamarindo la parte lenta es la montaña: carreteras empinadas y con curvas unen Santa Elena con la Interamericana, en las tierras bajas. Desde allí el traslado cruza las fincas ganaderas planas de Guanacaste hasta la costa, ya sea por el puente sobre el río Tempisque y Santa Cruz o pasando por Liberia; los conductores eligen según el tráfico y los trabajos en la vía.",
    ),
    ways: [
      way(
        "bus",
        "There is no direct public bus. By bus the trip takes several changes, down on the Inter-American Highway and again in Liberia, and a full day.",
        "No hay bus público directo. En bus, el viaje requiere varios cambios, abajo en la Interamericana y de nuevo en Liberia, y un día completo.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between Monteverde and Tamarindo at fixed times, with stops at several hotels.",
        "Hay shuttles compartidos entre Monteverde y Tamarindo en horarios fijos, con paradas en varios hoteles.",
      ),
      way("flight", "There are no flights: Monteverde has no airport.", "No hay vuelos: Monteverde no tiene aeropuerto."),
      way(
        "car",
        "Easy once you are down on the highway. Some of the mountain roads out of Monteverde still have gravel stretches.",
        "Fácil una vez que se llega a la carretera principal. Algunas de las carreteras de montaña que salen de Monteverde todavía tienen tramos de lastre.",
      ),
    ],
    faqs: [
      q(
        "Does the ride between Monteverde and Tamarindo use a ferry?",
        "¿El traslado entre Monteverde y Tamarindo usa un ferry?",
        "No. It is all by road. The Gulf of Nicoya ferry is only used for rides to the southern Nicoya Peninsula, such as Santa Teresa.",
        "No. Todo es por carretera. El ferry del golfo de Nicoya solo se usa en traslados al sur de la península de Nicoya, como Santa Teresa.",
      ),
      q(
        "Are there sightseeing stops on this ride?",
        "¿Hay paradas turísticas en este traslado?",
        "None are sold online for this pair. Your driver stops for restrooms, food or a photo whenever you ask.",
        "No se vende ninguna en línea para este trayecto. Su conductor para para ir al baño, comer o tomar una foto cuando usted lo pida.",
      ),
      q(
        "How big is the change in weather?",
        "¿Qué tan grande es el cambio de clima?",
        "Big. Monteverde is cool, windy and often misty; Tamarindo is hot and, from December to April, very dry. Pack so that both a jacket and sandals are within reach.",
        "Grande. Monteverde es fresco, ventoso y a menudo neblinoso; Tamarindo es caliente y, de diciembre a abril, muy seco. Empaque de modo que tenga a mano tanto una chaqueta como unas sandalias.",
      ),
    ],
    ab: {
      lead: l(
        "Your driver picks you up at your hotel in Monteverde or Santa Elena, takes the mountain down at a careful pace and crosses Guanacaste to your hotel or rental at the beach.",
        "Su conductor lo recoge en su hotel de Monteverde o Santa Elena, baja la montaña a un ritmo prudente y cruza Guanacaste hasta su hotel o casa de alquiler en la playa.",
      ),
      faq: q(
        "Can we do a morning zipline and still travel to Tamarindo?",
        "¿Podemos hacer un canopy por la mañana y aun así viajar a Tamarindo?",
        "Yes. The ride takes about {time:Monteverde>Tamarindo}, so a pickup around midday still gets you to the beach by evening.",
        "Sí. El traslado toma aproximadamente {time:Monteverde>Tamarindo}, así que con una recogida cerca del mediodía igual llega a la playa al anochecer.",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up in Tamarindo, Langosta or Playa Grande, crosses the plains and climbs into the mountains, where the air cools with every curve.",
        "Su conductor lo recoge en Tamarindo, Langosta o Playa Grande, cruza las llanuras y sube a la montaña, donde el aire refresca con cada curva.",
      ),
      faq: q(
        "What time should we leave Tamarindo to arrive in daylight?",
        "¿A qué hora conviene salir de Tamarindo para llegar con luz de día?",
        "By late morning at the latest: the ride is about {time:Tamarindo>Monteverde}, and the climb at the end is slower in the dark and in fog.",
        "A más tardar al final de la mañana: el traslado toma aproximadamente {time:Tamarindo>Monteverde}, y la subida del final es más lenta de noche y con neblina.",
      ),
    },
  },

  // ───────── Manuel Antonio ↔ Sierpe (boat dock) ─────────
  {
    a: "ManuelAntonio",
    b: "Sierpe",
    updated,
    hook: l("down the South Pacific coast to the Drake Bay boats", "por el Pacífico Sur hasta las lanchas de Bahía Drake"),
    road: l(
      "Between Manuel Antonio and Sierpe the Costanera Sur runs along the South Pacific coast past Dominical, Uvita and Ojochal, with forested hills on one side and glimpses of the sea on the other, to Palmar Norte. A short local road covers the last stretch to the river town of Sierpe and its dock. It is paved the whole way and mostly flat.",
      "Entre Manuel Antonio y Sierpe la Costanera Sur recorre la costa del Pacífico Sur, pasando por Dominical, Uvita y Ojochal, con cerros boscosos de un lado y vistas del mar del otro, hasta Palmar Norte. Un camino local corto cubre el último tramo hasta el pueblo ribereño de Sierpe y su muelle. Todo está pavimentado y es casi plano.",
    ),
    stopsNote: l(
      "The stops listed for this ride, the Tárcoles bridge and Carara, are north of Manuel Antonio, toward Jacó: adding one means driving up the coast and back before heading south.",
      "Las paradas que aparecen para este traslado, el puente de Tárcoles y Carara, quedan al norte de Manuel Antonio, hacia Jacó: agregar una implica subir por la costa y regresar antes de seguir hacia el sur.",
    ),
    ways: [
      way(
        "bus",
        "There is no direct public bus. Buses run along the coastal highway between Quepos and Palmar Norte, and a taxi or local bus covers Palmar Norte to Sierpe; check the current connections.",
        "No hay bus público directo. Hay buses por la Costanera entre Quepos y Palmar Norte, y un taxi o un bus local cubre el tramo de Palmar Norte a Sierpe; revise las conexiones vigentes.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between Manuel Antonio and Sierpe at fixed times. Check which days they operate on your dates.",
        "Hay shuttles compartidos entre Manuel Antonio y Sierpe en horarios fijos. Revise qué días operan en sus fechas.",
      ),
      way(
        "flight",
        "There is no flight between Quepos and Sierpe. Quepos and Drake Bay each have an airstrip with domestic flights, generally by way of San José.",
        "No hay vuelo entre Quepos y Sierpe. Quepos y Bahía Drake tienen cada uno un aeródromo con vuelos nacionales, por lo general pasando por San José.",
      ),
      way(
        "car",
        "An easy paved drive. Travellers going on to Drake Bay leave the car in paid parking near the dock.",
        "Un recorrido fácil y pavimentado. Quienes siguen a Bahía Drake dejan el vehículo en un parqueo de pago cerca del muelle.",
      ),
    ],
    faqs: [
      q(
        "How early should we leave Manuel Antonio for our boat?",
        "¿Con cuánta anticipación conviene salir de Manuel Antonio para la lancha?",
        "Confirm the boat time with your lodge first. The road takes about {time:ManuelAntonio>Sierpe}; choose a pickup that gets you to the dock with time to spare.",
        "Primero confirme la hora de la lancha con su lodge. La carretera toma aproximadamente {time:ManuelAntonio>Sierpe}; elija una recogida que lo deje en el muelle con tiempo de sobra.",
      ),
      q(
        "Can we stop in Dominical or Uvita?",
        "¿Podemos parar en Dominical o Uvita?",
        "Yes, for a short break: both are right on the highway. Tell your driver, and keep an eye on your boat time.",
        "Sí, para una pausa corta: los dos quedan sobre la carretera. Dígaselo a su conductor, y no pierda de vista la hora de su lancha.",
      ),
      q(
        "Is the road to Sierpe paved?",
        "¿La carretera a Sierpe está pavimentada?",
        "Yes: the coastal highway to Palmar Norte and the local road into Sierpe are both paved, so any vehicle class works.",
        "Sí: la Costanera hasta Palmar Norte y el camino local hasta Sierpe están pavimentados, así que sirve cualquier categoría de vehículo.",
      ),
    ],
    ab: {
      lead: l(
        "Your driver picks you up at your hotel in Manuel Antonio or Quepos and takes you down the coast to the boat dock in Sierpe, timed around your boat to Drake Bay.",
        "Su conductor lo recoge en su hotel de Manuel Antonio o Quepos y lo lleva por la costa hasta el muelle de Sierpe, en coordinación con la hora de su lancha a Bahía Drake.",
      ),
      faq: q(
        "Is this the easiest way to add Drake Bay to a Manuel Antonio trip?",
        "¿Es esta la forma más sencilla de sumar Bahía Drake a un viaje a Manuel Antonio?",
        "It is the shortest road to the boats: Sierpe is about {time:ManuelAntonio>Sierpe} from Manuel Antonio, against {time:SJO>Sierpe} from San José.",
        "Es la carretera más corta hasta las lanchas: Sierpe queda a {time:ManuelAntonio>Sierpe} de Manuel Antonio, frente a {time:SJO>Sierpe} desde San José.",
      ),
    },
    ba: {
      lead: l(
        "Back from Drake Bay? Your driver waits at the Sierpe dock and takes you up the coast to your hotel in Manuel Antonio or Quepos.",
        "¿De regreso de Bahía Drake? Su conductor lo espera en el muelle de Sierpe y lo lleva por la costa hasta su hotel en Manuel Antonio o Quepos.",
      ),
      faq: q(
        "What if our boat reaches Sierpe late?",
        "¿Qué pasa si nuestra lancha llega tarde a Sierpe?",
        "Your driver waits up to 60 minutes after the pickup time you gave us. If you know the boat is running later than that, message us on WhatsApp.",
        "Su conductor espera hasta 60 minutos después de la hora de recogida que nos indicó. Si sabe que la lancha viene con más atraso, escríbanos por WhatsApp.",
      ),
    },
  },

  // ───────── Manuel Antonio ↔ Drake Bay (road + boat) ─────────
  {
    a: "ManuelAntonio",
    b: "DrakeBay",
    updated,
    hook: l("coast road and river boat in one booking", "carretera costera y lancha en una sola reserva"),
    road: l(
      "The trip between Manuel Antonio and Drake Bay is half road, half water. The Costanera Sur follows the coast past Dominical and Uvita to Palmar Norte and the Sierpe dock; from there a boat runs down the Sierpe River through the mangroves, across the river mouth and along the Osa coast to the beach at Drake Bay.",
      "El viaje entre Manuel Antonio y Bahía Drake es mitad carretera y mitad agua. La Costanera Sur sigue la costa, pasando por Dominical y Uvita, hasta Palmar Norte y el muelle de Sierpe; desde allí una lancha baja por el río Sierpe entre los manglares, cruza la boca del río y sigue la costa de Osa hasta la playa de Bahía Drake.",
    ),
    stopsNote: l(
      "The stops listed for this ride, the Tárcoles bridge and Carara, are north of Manuel Antonio, in the opposite direction from Sierpe.",
      "Las paradas que aparecen para este traslado, el puente de Tárcoles y Carara, quedan al norte de Manuel Antonio, en sentido contrario a Sierpe.",
    ),
    ways: [
      way(
        "bus",
        "By bus you travel the coastal highway to Palmar Norte, take a taxi or local bus to Sierpe and still need a place on a boat. It is cheap and takes planning.",
        "En bus se recorre la Costanera hasta Palmar Norte, se toma un taxi o un bus local a Sierpe y todavía se necesita un espacio en una lancha. Es barato y requiere planificación.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between Manuel Antonio and Sierpe at fixed times; the boat to Drake Bay is booked separately.",
        "Hay shuttles compartidos entre Manuel Antonio y Sierpe en horarios fijos; la lancha a Bahía Drake se reserva aparte.",
      ),
      way(
        "flight",
        "Quepos and Drake Bay each have an airstrip, but domestic flights are organised around San José, so flying generally means connecting there.",
        "Quepos y Bahía Drake tienen cada uno un aeródromo, pero los vuelos nacionales se organizan alrededor de San José, así que volar por lo general implica hacer conexión allí.",
      ),
      way(
        "car",
        "Most drivers leave the car in Sierpe and take the boat. The road all the way to Drake Bay is rough, has several river crossings and can be impassable in the rainy season.",
        "La mayoría deja el vehículo en Sierpe y toma la lancha. El camino hasta Bahía Drake está en mal estado, tiene varios cruces de ríos y puede quedar intransitable en la época lluviosa.",
      ),
    ],
    faqs: [
      q(
        "Should we book this ride or the one to the Sierpe dock?",
        "¿Reservamos este traslado o el que va al muelle de Sierpe?",
        "Book this one if you want the boat included. If your Drake Bay lodge already puts you on its boat, book Manuel Antonio to Sierpe, from {price:ManuelAntonio>Sierpe} per vehicle.",
        "Reserve este si quiere la lancha incluida. Si su lodge de Bahía Drake ya lo incluye en su lancha, reserve Manuel Antonio–Sierpe, desde {price:ManuelAntonio>Sierpe} por vehículo.",
      ),
      q(
        "How long is each part of the trip?",
        "¿Cuánto dura cada parte del viaje?",
        "About {time:ManuelAntonio>Sierpe} by road to Sierpe and about {boat} on the water, {time:ManuelAntonio>DrakeBay} in all.",
        "Aproximadamente {time:ManuelAntonio>Sierpe} por carretera hasta Sierpe y {boat} en el agua, {time:ManuelAntonio>DrakeBay} en total.",
      ),
      q(
        "Can we visit Corcovado the day we arrive?",
        "¿Podemos visitar Corcovado el día que llegamos?",
        "No. Park visits leave Drake Bay early in the morning, by boat, with a certified guide and a SINAC permit booked in advance. Plan them for the following days.",
        "No. Las visitas al parque salen de Bahía Drake temprano por la mañana, en lancha, con un guía certificado y un permiso del SINAC reservado con anticipación. Planéelas para los días siguientes.",
      ),
    ],
    ab: {
      lead: l(
        "One booking takes you from your hotel in Manuel Antonio to the beach at Drake Bay: by road to the Sierpe dock, then by river boat.",
        "Una sola reserva lo lleva de su hotel en Manuel Antonio a la playa de Bahía Drake: por carretera hasta el muelle de Sierpe y luego en lancha por el río.",
      ),
      faq: q(
        "Do we need to arrange anything in Sierpe ourselves?",
        "¿Tenemos que organizar algo por nuestra cuenta en Sierpe?",
        "No. The boat between Sierpe and Drake Bay is part of this booking. Tell us the name of your lodge when you book.",
        "No. La lancha entre Sierpe y Bahía Drake es parte de esta reserva. Indíquenos el nombre de su lodge al reservar.",
      ),
    },
    ba: {
      lead: l(
        "The trip starts on the beach at Drake Bay: the boat takes you up the river to Sierpe, where your driver is waiting for the coast road to Manuel Antonio.",
        "El viaje empieza en la playa de Bahía Drake: la lancha lo lleva río arriba hasta Sierpe, donde su conductor lo espera para tomar la carretera costera a Manuel Antonio.",
      ),
      faq: q(
        "Will we reach Manuel Antonio in time for dinner?",
        "¿Llegaremos a Manuel Antonio a tiempo para cenar?",
        "Yes, on a normal day: the trip is about {time:DrakeBay>ManuelAntonio} door to door, boat included, so a morning departure leaves the afternoon free.",
        "Sí, en un día normal: el viaje toma aproximadamente {time:DrakeBay>ManuelAntonio} de puerta a puerta, con la lancha incluida, así que saliendo por la mañana le queda la tarde libre.",
      ),
    },
  },

  // ───────── La Fortuna ↔ Puerto Viejo ─────────
  {
    a: "Arenal",
    b: "PuertoViejo",
    updated,
    hook: l("across the northern plains to the Caribbean, without going back through San José", "por las llanuras del norte hasta el Caribe, sin volver a pasar por San José"),
    road: l(
      "Between La Fortuna and Puerto Viejo the usual road does not go back through San José. Route 4 crosses the northern plains through the Sarapiquí area, past pineapple fields and rivers, and meets Route 32 in the Caribbean lowlands near Guápiles. From there the road passes Siquirres and the port of Limón, and Route 36 follows the coast past Cahuita. It is paved and mostly flat, with container trucks on the Route 32 stretch.",
      "Entre La Fortuna y Puerto Viejo la carretera habitual no vuelve a pasar por San José. La Ruta 4 cruza las llanuras del norte por la zona de Sarapiquí, entre piñales y ríos, y se une a la Ruta 32 en las llanuras del Caribe, cerca de Guápiles. Desde allí la carretera pasa por Siquirres y el puerto de Limón, y la Ruta 36 sigue la costa pasando por Cahuita. Está pavimentada y es casi plana, con camiones de contenedores en el tramo de la Ruta 32.",
    ),
    ways: [
      way(
        "bus",
        "There is no direct public bus. By bus the trip goes through San José, with a change of bus there, and takes a full day.",
        "No hay bus público directo. En bus, el viaje pasa por San José, con cambio de bus allí, y toma un día completo.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between La Fortuna and Puerto Viejo at fixed times; some involve a change of van on the way.",
        "Hay shuttles compartidos entre La Fortuna y Puerto Viejo en horarios fijos; algunos implican un cambio de microbús por el camino.",
      ),
      NO_DIRECT_FLIGHT("La Fortuna and the South Caribbean", "La Fortuna y el Caribe Sur"),
      way(
        "car",
        "Paved and flat for most of the way, but long, and Route 32 is busy with trucks heading to the port.",
        "Pavimentado y plano en casi todo el recorrido, pero largo, y la Ruta 32 tiene mucho tránsito de camiones hacia el puerto.",
      ),
    ],
    faqs: [
      q(
        "Do we go through San José between La Fortuna and Puerto Viejo?",
        "¿Se pasa por San José entre La Fortuna y Puerto Viejo?",
        "No. The ride crosses the northern plains and joins the Caribbean highway near Guápiles, below the mountain pass of Braulio Carrillo.",
        "No. El traslado cruza las llanuras del norte y se une a la carretera del Caribe cerca de Guápiles, más abajo del paso de montaña del Braulio Carrillo.",
      ),
      q(
        "Do the Route 32 landslide closures affect this ride?",
        "¿Los cierres por derrumbes en la Ruta 32 afectan este traslado?",
        "Much less than rides from San José: the stretch that closes after heavy rain is the mountain section, which this ride avoids. Trucks and road works in the lowlands can still slow things down.",
        "Mucho menos que a los traslados desde San José: el tramo que se cierra después de lluvias fuertes es el de montaña, que este traslado evita. Los camiones y los trabajos en la vía en las llanuras igual pueden hacer más lento el viaje.",
      ),
      q(
        "Where can we break up the ride?",
        "¿Dónde se puede dividir el traslado?",
        "Around Sarapiquí or Guápiles for lunch, and in Cahuita near the end. Tell your driver; your luggage stays locked in the vehicle.",
        "Por Sarapiquí o Guápiles para almorzar, y en Cahuita casi al final. Dígaselo a su conductor; su equipaje queda bajo llave en el vehículo.",
      ),
    ],
    ab: {
      lead: l(
        "Your driver picks you up at your La Fortuna hotel and takes you across the country to the Caribbean, to your hotel in Puerto Viejo, Cocles or Playa Chiquita.",
        "Su conductor lo recoge en su hotel de La Fortuna y lo lleva a través del país hasta el Caribe, a su hotel en Puerto Viejo, Cocles o Playa Chiquita.",
      ),
      faq: q(
        "Is it realistic to do La Fortuna to Puerto Viejo in one day?",
        "¿Es realista hacer La Fortuna–Puerto Viejo en un solo día?",
        "Yes. It takes about {time:Arenal>PuertoViejo}, so leave in the morning and you arrive in the afternoon with one or two breaks.",
        "Sí. Toma aproximadamente {time:Arenal>PuertoViejo}, así que saliendo por la mañana llega por la tarde, con una o dos pausas.",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up anywhere on the coast road from Puerto Viejo to Manzanillo and takes you up through the Caribbean lowlands and across the northern plains to La Fortuna.",
        "Su conductor lo recoge en cualquier punto de la carretera costera, de Puerto Viejo a Manzanillo, y lo lleva por las llanuras del Caribe y del norte hasta La Fortuna.",
      ),
      faq: q(
        "Can we add the sloth trail when we arrive in La Fortuna?",
        "¿Podemos agregar el sendero de perezosos al llegar a La Fortuna?",
        "It is offered as a stop on this ride, but after about {time:PuertoViejo>Arenal} on the road most travellers prefer to do it the next morning.",
        "Se ofrece como parada en este traslado, pero después de aproximadamente {time:PuertoViejo>Arenal} de carretera la mayoría de los viajeros prefiere hacerlo a la mañana siguiente.",
      ),
    },
  },

  // ───────── Manuel Antonio ↔ Tamarindo ─────────
  {
    a: "ManuelAntonio",
    b: "Tamarindo",
    updated,
    hook: l("beach to beach along the Pacific side", "de playa a playa por el lado del Pacífico"),
    road: l(
      "Manuel Antonio and Tamarindo are both on the Pacific, but the Gulf of Nicoya lies between them. The ride follows the coastal highway between Quepos and the Caldera area, the Inter-American Highway through the lowlands, Route 18 over the Tempisque River bridge onto the Nicoya Peninsula and Route 21 through Nicoya and Santa Cruz. It is paved and mostly flat all the way.",
      "Manuel Antonio y Tamarindo están los dos en el Pacífico, pero el golfo de Nicoya queda en medio. El traslado sigue la Costanera entre Quepos y la zona de Caldera, la Interamericana por las tierras bajas, la Ruta 18, que cruza el río Tempisque por el puente hacia la península de Nicoya, y la Ruta 21, que pasa por Nicoya y Santa Cruz. Todo el camino está pavimentado y es casi plano.",
    ),
    ways: [
      way(
        "bus",
        "We know of no direct public bus between the two. Going by bus means several changes and a very long day; ask locally for the current connections.",
        "No conocemos ningún bus público directo entre los dos. Ir en bus implica varios cambios y un día muy largo; consulte en el lugar las conexiones vigentes.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between Manuel Antonio and Tamarindo at fixed times, with stops at several hotels.",
        "Hay shuttles compartidos entre Manuel Antonio y Tamarindo en horarios fijos, con paradas en varios hoteles.",
      ),
      NO_DIRECT_FLIGHT("Quepos and Tamarindo", "Quepos y Tamarindo"),
      way(
        "car",
        "A simple drive on paved highways, but a long one; share the wheel or plan a proper lunch stop.",
        "Un recorrido sencillo por carreteras pavimentadas, pero largo; túrnese al volante o planee una buena parada para almorzar.",
      ),
    ],
    faqs: [
      q(
        "Does the ride between Manuel Antonio and Tamarindo take the ferry?",
        "¿El traslado entre Manuel Antonio y Tamarindo toma el ferry?",
        "No. It goes around the gulf by road and crosses the Tempisque River on a bridge. The ferry is only used for rides to the southern Nicoya Peninsula, such as Santa Teresa.",
        "No. Rodea el golfo por carretera y cruza el río Tempisque por un puente. El ferry solo se usa en traslados al sur de la península de Nicoya, como Santa Teresa.",
      ),
      q(
        "Are sightseeing stops offered on this ride?",
        "¿Se ofrecen paradas turísticas en este traslado?",
        "None are sold online for this pair. Your driver stops for restrooms, food or a photo whenever you ask.",
        "No se vende ninguna en línea para este trayecto. Su conductor para para ir al baño, comer o tomar una foto cuando usted lo pida.",
      ),
      q(
        "Is it better to break the trip with a night somewhere?",
        "¿Conviene dividir el viaje con una noche en algún lugar?",
        "You don't have to: the ride takes about {time:ManuelAntonio>Tamarindo} and is done in a day. Travellers with more time often put Monteverde between the two beaches.",
        "No es necesario: el traslado toma aproximadamente {time:ManuelAntonio>Tamarindo} y se hace en un día. Quienes tienen más tiempo suelen poner Monteverde entre las dos playas.",
      ),
    ],
    ab: {
      lead: l(
        "Your driver picks you up at your hotel in Manuel Antonio or Quepos and takes you north, around the Gulf of Nicoya, to your hotel or rental in Tamarindo.",
        "Su conductor lo recoge en su hotel de Manuel Antonio o Quepos y lo lleva hacia el norte, rodeando el golfo de Nicoya, hasta su hotel o casa de alquiler en Tamarindo.",
      ),
      faq: q(
        "What time should we leave Manuel Antonio?",
        "¿A qué hora conviene salir de Manuel Antonio?",
        "In the morning. With about {time:ManuelAntonio>Tamarindo} on the road plus lunch, an early start gets you to Tamarindo before sunset.",
        "Por la mañana. Con aproximadamente {time:ManuelAntonio>Tamarindo} de carretera más el almuerzo, saliendo temprano llega a Tamarindo antes del atardecer.",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up in Tamarindo, Langosta or Playa Grande and takes you south, around the Gulf of Nicoya and down the coastal highway, to Manuel Antonio.",
        "Su conductor lo recoge en Tamarindo, Langosta o Playa Grande y lo lleva hacia el sur, rodeando el golfo de Nicoya y bajando por la Costanera, hasta Manuel Antonio.",
      ),
      faq: q(
        "Will there be time for the national park the next morning?",
        "¿Habrá tiempo para el parque nacional a la mañana siguiente?",
        "Yes, if you travel the day before: the ride is about {time:Tamarindo>ManuelAntonio}. Buy the park tickets online in advance, and remember the park is closed on Tuesdays.",
        "Sí, si viaja el día anterior: el traslado toma aproximadamente {time:Tamarindo>ManuelAntonio}. Compre las entradas del parque en línea con anticipación, y recuerde que el parque cierra los martes.",
      ),
    },
  },
];
