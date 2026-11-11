/**
 * Destination guides: /destinations/<slug> (English) and /es/destinos/<slug> (Spanish).
 * To add a destination, add one object here (rules and tokens: ./types.ts). The page,
 * the index, the sitemap, the footer and llms.txt all read this list.
 */
import type { DestinationGuide, L, OtherWay } from "./types";

/** Date the guides' facts were last checked. */
const UPDATED = "2026-11-11";

// ── Texts shared by several guides ──

const SHUTTLE: OtherWay = {
  kind: "shuttle",
  text: {
    en: "Shared shuttles are air-conditioned vans that run the main tourist routes at fixed times, usually once or twice a day, picking up and dropping off at several hotels. For one or two travellers they cost less than a private car; for three or more, compare the total with the per-vehicle price of a private transfer. Departure times change with the season, so check them with the shuttle company.",
    es: "Los shuttles compartidos son microbuses con aire acondicionado que recorren las principales rutas turísticas en horarios fijos, normalmente una o dos veces al día, y recogen y dejan viajeros en varios hoteles. Para una o dos personas cuestan menos que un vehículo privado; para tres o más, compare el total con el precio por vehículo de un traslado privado. Los horarios cambian según la temporada: confírmelos con la empresa.",
  },
};

const car = (en: string, es: string): OtherWay => ({
  kind: "car",
  text: {
    en: `${en} Rental companies add Costa Rica's mandatory liability insurance to the advertised rate, so ask for the full price. Avoid driving after dark: roads are narrow, poorly lit and shared with trucks, cyclists and people on foot.`,
    es: `${es} Las arrendadoras suman al precio anunciado el seguro obligatorio de responsabilidad civil de Costa Rica, así que pida el precio total. Evite manejar de noche: las carreteras son angostas, con poca iluminación, y las comparten camiones, ciclistas y peatones.`,
  },
});

const DRY_NOTE: L = {
  en: "December to April is also our high season, and Christmas, New Year and Easter week are peak dates: transfers cost a little more then, and the exact price for your date is shown before you book.",
  es: "De diciembre a abril es también nuestra temporada alta, y Navidad, Año Nuevo y Semana Santa son fechas pico: los traslados cuestan un poco más, y el precio exacto para su fecha aparece antes de reservar.",
};

const FAQ_PER_VEHICLE = {
  q: { en: "Is the transfer price per person?", es: "¿El precio del traslado es por persona?" },
  a: {
    en: "No. The price is for the whole vehicle, so it is the same for one traveller or a full car. The exact price for your date, vehicle and stops is shown before you book.",
    es: "No. El precio es por el vehículo completo, así que es el mismo para un viajero o para el vehículo lleno. El precio exacto para su fecha, vehículo y paradas aparece antes de reservar.",
  },
};

export const DESTINATION_GUIDES: DestinationGuide[] = [
  // ───────────────────────── La Fortuna / Arenal ─────────────────────────
  {
    slug: "la-fortuna",
    hub: "Arenal",
    region: "Arenal",
    photo: "la-fortuna-hot-river",
    updated: UPDATED,
    name: { en: "La Fortuna / Arenal", es: "La Fortuna / Arenal" },
    title: {
      en: "La Fortuna & Arenal Volcano: how to get there, when to go, where to stay",
      es: "La Fortuna y el volcán Arenal: cómo llegar, cuándo ir y dónde hospedarse",
    },
    metaDescription: {
      en: "La Fortuna and Arenal Volcano travel guide: drive times and private transfer prices from San José (SJO) and Liberia (LIR), bus, shuttle and flight options, best time to go, things to do and where to stay by area.",
      es: "Guía de La Fortuna y el volcán Arenal: tiempos de viaje y precios de traslado privado desde San José (SJO) y Liberia (LIR), bus, shuttle y vuelos, mejor época, qué hacer y dónde hospedarse por zona.",
    },
    teaser: { en: "Volcano, hot springs and waterfalls", es: "Volcán, aguas termales y cataratas" },
    answer: {
      en: "La Fortuna, the town at the foot of Arenal Volcano, is about {time:SJO>Arenal} by road from San José airport (SJO) and {time:LIR>Arenal} from Liberia airport (LIR). A private transfer costs from {price:SJO>Arenal} per vehicle from SJO and from {price:LIR>Arenal} from LIR (green-season price, up to {pax:SJO>Arenal} travellers). Public buses and shared shuttles cost less and take longer.",
      es: "La Fortuna, el pueblo al pie del volcán Arenal, está a unas {time:SJO>Arenal} por carretera del aeropuerto de San José (SJO) y a {time:LIR>Arenal} del aeropuerto de Liberia (LIR). Un traslado privado cuesta desde {price:SJO>Arenal} por vehículo desde SJO y desde {price:LIR>Arenal} desde LIR (precio de temporada verde, hasta {pax:SJO>Arenal} viajeros). El bus público y los shuttles compartidos cuestan menos y tardan más.",
    },
    intro: {
      en: "La Fortuna sits on the green northern plains, with Arenal's cone rising just west of town. It is the country's hub for hot springs, waterfalls, hanging bridges and rainforest walks, and a natural first or second stop on a Costa Rica trip.",
      es: "La Fortuna está en las verdes llanuras del norte, con el cono del Arenal justo al oeste del pueblo. Es el centro del país para aguas termales, cataratas, puentes colgantes y caminatas por el bosque lluvioso, y una primera o segunda parada natural en un viaje por Costa Rica.",
    },
    rides: [
      { origin: "SJO", destination: "Arenal" },
      { origin: "LIR", destination: "Arenal" },
      { origin: "Arenal", destination: "Monteverde" },
      { origin: "Arenal", destination: "ManuelAntonio" },
      { origin: "Tamarindo", destination: "Arenal" },
    ],
    airports: {
      en: "Both international airports work, and the drives are about the same length. From San José you cross the Central Valley's coffee hills and a winding, often misty mountain road before dropping into the plains. From Liberia the road runs past Cañas and Tilarán and around Lake Arenal, with lake and volcano views on a clear day. Choose the airport by flight price and by where the rest of your trip goes: SJO if you continue to the Central Pacific or the Caribbean, LIR if you continue to the Guanacaste beaches.",
      es: "Los dos aeropuertos internacionales sirven, y los recorridos duran casi lo mismo. Desde San José se cruzan los cafetales del Valle Central y una carretera de montaña con curvas y frecuente neblina antes de bajar a las llanuras. Desde Liberia la carretera pasa por Cañas y Tilarán y bordea el lago Arenal, con vistas del lago y del volcán en días despejados. Elija el aeropuerto por el precio del vuelo y por el resto de su viaje: SJO si continúa hacia el Pacífico Central o el Caribe, LIR si continúa hacia las playas de Guanacaste.",
    },
    otherWays: [
      {
        kind: "bus",
        text: {
          en: "Public buses run from downtown San José to La Fortuna, some direct and others with a change in Ciudad Quesada. They are the cheapest option and the slowest, and they leave from a bus terminal in the city, not from the airport, so you first need a taxi or local bus into town. Terminals and timetables change: confirm both shortly before you travel.",
          es: "Hay buses públicos del centro de San José a La Fortuna, algunos directos y otros con cambio en Ciudad Quesada. Son la opción más barata y la más lenta, y salen de una terminal en la ciudad, no del aeropuerto, así que primero necesita un taxi o un bus local hasta el centro. Las terminales y los horarios cambian: confirme ambos poco antes de viajar.",
        },
      },
      SHUTTLE,
      {
        kind: "flight",
        text: {
          en: "A small airfield near La Fortuna has had scheduled domestic flights from San José on small planes with strict luggage limits. Routes and timetables change from season to season, so check the airline's current schedule; you still need a short ride from the airfield to your hotel.",
          es: "Un pequeño aeródromo cerca de La Fortuna ha tenido vuelos nacionales regulares desde San José, en avionetas con límites estrictos de equipaje. Las rutas y los horarios cambian de una temporada a otra: revise el itinerario vigente de la aerolínea; además necesitará un traslado corto del aeródromo a su hotel.",
        },
      },
      car(
        "Driving yourself is straightforward on paved roads, but the mountain stretch is winding and often foggy or rainy in the afternoon.",
        "Manejar por su cuenta es sencillo, por carreteras pavimentadas, pero el tramo de montaña tiene muchas curvas y con frecuencia neblina o lluvia por la tarde.",
      ),
    ],
    bestTime: {
      dry: {
        en: "December to April is the drier season, with the best odds of a clear volcano. Even then the northern plains get showers, and Arenal's summit is often wrapped in cloud, especially in the afternoon: look for it early in the morning.",
        es: "De diciembre a abril es la época más seca, con más posibilidades de ver el volcán despejado. Aun así, en las llanuras del norte caen aguaceros, y la cima del Arenal suele estar cubierta de nubes, sobre todo por la tarde: búsquela temprano en la mañana.",
      },
      green: {
        en: "May to November is the green season: mornings are often clear, rain usually comes in the afternoon, the forest is at its greenest and prices are lower. Hot springs are just as good in the rain.",
        es: "De mayo a noviembre es la temporada verde: las mañanas suelen estar despejadas, la lluvia llega por lo general en la tarde, el bosque está en su punto más verde y los precios son más bajos. Las aguas termales se disfrutan igual bajo la lluvia.",
      },
      note: DRY_NOTE,
    },
    thingsToDo: [
      {
        title: { en: "Arenal Volcano National Park", es: "Parque Nacional Volcán Arenal" },
        text: {
          en: "Trails across old lava fields with views of the cone and Lake Arenal.",
          es: "Senderos sobre antiguos campos de lava, con vistas del cono y del lago Arenal.",
        },
      },
      {
        title: { en: "La Fortuna Waterfall", es: "Catarata de La Fortuna" },
        text: {
          en: "A tall waterfall in the forest, reached by a long staircase down (and back up).",
          es: "Una catarata alta en medio del bosque, a la que se baja (y se vuelve a subir) por una larga escalinata.",
        },
      },
      {
        title: { en: "Hot springs", es: "Aguas termales" },
        text: {
          en: "Rivers warmed by the volcano feed pools that range from simple to resort-style, most of them along the road west of town.",
          es: "Ríos calentados por el volcán alimentan piscinas que van de lo sencillo al estilo resort, la mayoría sobre la carretera al oeste del pueblo.",
        },
      },
      {
        title: { en: "Hanging bridges and wildlife walks", es: "Puentes colgantes y caminatas de vida silvestre" },
        text: {
          en: "Canopy bridges, sloth and bird walks with a naturalist guide, and night walks.",
          es: "Puentes entre las copas de los árboles, caminatas con guía naturalista para ver perezosos y aves, y caminatas nocturnas.",
        },
      },
      {
        title: { en: "Río Celeste", es: "Río Celeste" },
        text: {
          en: "The sky-blue river in Tenorio Volcano National Park makes a full day out, or a stop on the ride between La Fortuna and Liberia.",
          es: "El río azul celeste del Parque Nacional Volcán Tenorio es una excursión de día completo, o una parada en el traslado entre La Fortuna y Liberia.",
        },
      },
    ],
    goodToKnow: [
      {
        en: "Poás Volcano, a popular stop on the ride from San José, uses timed-entry tickets that must be booked in advance, and clouds often hide the crater later in the day.",
        es: "El volcán Poás, una parada frecuente en el traslado desde San José, usa entradas con horario asignado que se reservan con anticipación, y las nubes suelen tapar el cráter conforme avanza el día.",
      },
    ],
    areas: [
      {
        name: { en: "La Fortuna town", es: "Centro de La Fortuna" },
        text: {
          en: "Restaurants, supermarkets, banks and tour offices within walking distance. The most practical base without a car, and the least expensive.",
          es: "Restaurantes, supermercados, bancos y oficinas de tours a poca distancia a pie. La base más práctica sin vehículo, y la más económica.",
        },
      },
      {
        name: { en: "The road west of town, toward the volcano", es: "La carretera al oeste del pueblo, hacia el volcán" },
        text: {
          en: "Most hot-spring resorts and volcano-view hotels are strung along this road. Quieter and greener than town, but you need a taxi or driver to go out to eat.",
          es: "La mayoría de los resorts de aguas termales y de los hoteles con vista al volcán están a lo largo de esta carretera. Más tranquila y verde que el pueblo, pero necesitará taxi o conductor para salir a comer.",
        },
      },
      {
        name: { en: "El Castillo and the lake side", es: "El Castillo y el lado del lago" },
        text: {
          en: "A small village beyond the national park, near Lake Arenal, with wide volcano views. Remote and peaceful; the last stretch of road is rough, so it suits travellers with their own transport.",
          es: "Un pueblo pequeño más allá del parque nacional, cerca del lago Arenal, con vistas amplias del volcán. Apartado y tranquilo; el último tramo del camino es irregular, así que conviene a quienes tienen transporte propio.",
        },
      },
    ],
    faqs: [
      {
        q: { en: "How do I get from San José airport to La Fortuna?", es: "¿Cómo llego del aeropuerto de San José a La Fortuna?" },
        a: {
          en: "By road, in about {time:SJO>Arenal}. A private transfer goes door to door from {price:SJO>Arenal} per vehicle; a shared shuttle runs at fixed times; a public bus is cheapest but leaves from downtown San José, not the airport.",
          es: "Por carretera, en unas {time:SJO>Arenal}. Un traslado privado va puerta a puerta desde {price:SJO>Arenal} por vehículo; un shuttle compartido sale en horarios fijos; el bus público es lo más barato, pero sale del centro de San José, no del aeropuerto.",
        },
      },
      {
        q: { en: "Is it better to fly into San José or Liberia for La Fortuna?", es: "¿Conviene llegar por San José o por Liberia para ir a La Fortuna?" },
        a: {
          en: "The drive is about the same: {time:SJO>Arenal} from SJO and {time:LIR>Arenal} from LIR. Pick the airport with the better flight, or the one that suits the rest of your route.",
          es: "El recorrido es casi igual: {time:SJO>Arenal} desde SJO y {time:LIR>Arenal} desde LIR. Elija el aeropuerto con el mejor vuelo, o el que más convenga al resto de su ruta.",
        },
      },
      {
        q: { en: "How many days do I need in La Fortuna?", es: "¿Cuántos días se necesitan en La Fortuna?" },
        a: {
          en: "Two full days cover the volcano trails, the waterfall and an evening in the hot springs. Add a third for Río Celeste, the hanging bridges or a slower pace.",
          es: "Dos días completos alcanzan para los senderos del volcán, la catarata y una tarde en las aguas termales. Sume un tercero para Río Celeste, los puentes colgantes o un ritmo más pausado.",
        },
      },
      {
        q: { en: "Will I see Arenal Volcano?", es: "¿Se ve el volcán Arenal?" },
        a: {
          en: "Often, but not always. The summit is frequently covered by cloud, especially in the afternoon. Early mornings give the best chance, in any season.",
          es: "Muchas veces, pero no siempre. La cima suele estar cubierta de nubes, sobre todo por la tarde. Temprano en la mañana hay más posibilidades, en cualquier época.",
        },
      },
      {
        q: { en: "How do I get from La Fortuna to Monteverde?", es: "¿Cómo se va de La Fortuna a Monteverde?" },
        a: {
          en: "There is no direct road: you drive around Lake Arenal, about {time:Arenal>Monteverde} door to door. The alternative is the jeep-boat-jeep, which crosses the lake by boat and changes vehicles twice.",
          es: "No hay carretera directa: se bordea el lago Arenal, unas {time:Arenal>Monteverde} de puerta a puerta. La alternativa es el jeep-boat-jeep, que cruza el lago en lancha y cambia de vehículo dos veces.",
        },
      },
      {
        q: { en: "Can we stop on the way from San José?", es: "¿Podemos hacer paradas en el camino desde San José?" },
        a: {
          en: "Yes. On a private transfer you can add sightseeing stops such as Poás Volcano and a coffee farm; each stop shows its duration and price in the trip builder, and your luggage stays locked in the vehicle with your driver.",
          es: "Sí. En un traslado privado puede agregar paradas turísticas, como el volcán Poás y una finca de café; cada parada muestra su duración y su precio en el planificador de viajes, y su equipaje queda bajo llave en el vehículo con su conductor.",
        },
      },
      FAQ_PER_VEHICLE,
    ],
  },

  // ───────────────────────── Manuel Antonio ─────────────────────────
  {
    slug: "manuel-antonio",
    hub: "ManuelAntonio",
    region: "ManuelAntonio",
    photo: "manuel-antonio-sunset",
    updated: UPDATED,
    name: { en: "Manuel Antonio", es: "Manuel Antonio" },
    title: {
      en: "Manuel Antonio: how to get there, when to go, where to stay",
      es: "Manuel Antonio: cómo llegar, cuándo ir y dónde hospedarse",
    },
    metaDescription: {
      en: "Manuel Antonio and Quepos travel guide: drive times and private transfer prices from San José (SJO) and Liberia (LIR), bus, shuttle and flight options, national park tickets, best time to go and where to stay by area.",
      es: "Guía de Manuel Antonio y Quepos: tiempos de viaje y precios de traslado privado desde San José (SJO) y Liberia (LIR), bus, shuttle y vuelos, entradas al parque nacional, mejor época y dónde hospedarse por zona.",
    },
    teaser: { en: "Rainforest that ends on the beach", es: "Bosque lluvioso que termina en la playa" },
    answer: {
      en: "Manuel Antonio, on the Central Pacific coast next to the town of Quepos, is about {time:SJO>ManuelAntonio} by road from San José airport (SJO) and {time:LIR>ManuelAntonio} from Liberia airport (LIR). A private transfer from SJO costs from {price:SJO>ManuelAntonio} per vehicle (green-season price, up to {pax:SJO>ManuelAntonio} travellers). Direct public buses and shared shuttles also make the trip.",
      es: "Manuel Antonio, en el Pacífico Central junto a la ciudad de Quepos, está a unas {time:SJO>ManuelAntonio} por carretera del aeropuerto de San José (SJO) y a {time:LIR>ManuelAntonio} del aeropuerto de Liberia (LIR). Un traslado privado desde SJO cuesta desde {price:SJO>ManuelAntonio} por vehículo (precio de temporada verde, hasta {pax:SJO>ManuelAntonio} viajeros). También hay buses públicos directos y shuttles compartidos.",
    },
    intro: {
      en: "Manuel Antonio is a forested hill that drops to white-sand beaches and one of the country's most visited national parks, small enough to walk in a morning and full of sloths, monkeys and toucans. Quepos, at the foot of the hill, is the working town with the marina, banks and the bus terminal.",
      es: "Manuel Antonio es una colina boscosa que baja hasta playas de arena blanca y uno de los parques nacionales más visitados del país, tan pequeño que se recorre en una mañana y lleno de perezosos, monos y tucanes. Quepos, al pie de la colina, es la ciudad con la marina, los bancos y la terminal de buses.",
    },
    rides: [
      { origin: "SJO", destination: "ManuelAntonio" },
      { origin: "LIR", destination: "ManuelAntonio" },
      { origin: "Arenal", destination: "ManuelAntonio" },
      { origin: "Monteverde", destination: "ManuelAntonio" },
      { origin: "ManuelAntonio", destination: "Sierpe" },
    ],
    airports: {
      en: "San José (SJO) is the airport for Manuel Antonio: Route 27 takes you down to the Pacific and the coastal highway follows the shore past Jacó and Parrita to Quepos. Weekend and holiday traffic on Route 27 can add an hour. Liberia (LIR) is a much longer drive and only makes sense if you combine Manuel Antonio with the Guanacaste beaches.",
      es: "San José (SJO) es el aeropuerto para Manuel Antonio: la Ruta 27 baja al Pacífico y la Costanera sigue la costa, pasando por Jacó y Parrita, hasta Quepos. El tráfico de fines de semana y feriados en la Ruta 27 puede sumar una hora. Liberia (LIR) queda mucho más lejos y solo conviene si combina Manuel Antonio con las playas de Guanacaste.",
    },
    otherWays: [
      {
        kind: "bus",
        text: {
          en: "Public buses run from downtown San José to Quepos and Manuel Antonio, some of them direct. They are cheap and comfortable enough, but leave from a terminal in the city, not from the airport. A frequent local bus links Quepos with the beach and the park entrance. Confirm the terminal and the timetable shortly before you travel.",
          es: "Hay buses públicos del centro de San José a Quepos y Manuel Antonio, algunos directos. Son baratos y razonablemente cómodos, pero salen de una terminal en la ciudad, no del aeropuerto. Un bus local frecuente une Quepos con la playa y la entrada del parque. Confirme la terminal y el horario poco antes de viajar.",
        },
      },
      SHUTTLE,
      {
        kind: "flight",
        text: {
          en: "Domestic flights connect San José with the Quepos airstrip, a short ride from the hotels. Planes are small, luggage limits are strict and schedules change by season, so check the airline's current timetable.",
          es: "Hay vuelos nacionales entre San José y el aeródromo de Quepos, a pocos minutos de los hoteles. Los aviones son pequeños, los límites de equipaje son estrictos y los horarios cambian según la temporada: revise el itinerario vigente de la aerolínea.",
        },
      },
      car(
        "The drive is on good paved highways. Around Manuel Antonio itself a car is little use: the hill road is narrow, parking near the park is scarce and the local bus is frequent.",
        "El recorrido es por buenas carreteras pavimentadas. En Manuel Antonio mismo un vehículo sirve de poco: la carretera de la colina es angosta, hay poco parqueo cerca del parque y el bus local pasa con frecuencia.",
      ),
    ],
    bestTime: {
      dry: {
        en: "December to April is hot, sunny and the busiest time of year. National park tickets for the day you want can sell out, so buy them as soon as your dates are fixed.",
        es: "De diciembre a abril hace calor, hay sol y es la época con más visitantes. Las entradas al parque nacional para el día que usted quiere pueden agotarse: cómprelas apenas tenga sus fechas.",
      },
      green: {
        en: "May to November brings sunny mornings and afternoon rain, fewer visitors and lower prices. September and October are usually the wettest months on this coast.",
        es: "De mayo a noviembre hay mañanas soleadas y lluvia por la tarde, menos visitantes y precios más bajos. Septiembre y octubre suelen ser los meses más lluviosos en esta costa.",
      },
      note: DRY_NOTE,
    },
    thingsToDo: [
      {
        title: { en: "Manuel Antonio National Park", es: "Parque Nacional Manuel Antonio" },
        text: {
          en: "Short trails through the forest to sheltered beaches. A naturalist guide with a spotting scope finds the wildlife you would walk past.",
          es: "Senderos cortos por el bosque hasta playas protegidas. Un guía naturalista con telescopio encuentra la fauna que usted pasaría de largo.",
        },
      },
      {
        title: { en: "Catamaran and snorkelling", es: "Catamarán y snorkel" },
        text: {
          en: "Morning or sunset sails along the coast, often with dolphins alongside.",
          es: "Paseos en la mañana o al atardecer a lo largo de la costa, muchas veces con delfines al lado.",
        },
      },
      {
        title: { en: "Beaches", es: "Playas" },
        text: {
          en: "The long public beach outside the park for swimming, surf lessons and sunsets; calmer coves inside the park.",
          es: "La larga playa pública fuera del parque para nadar, tomar clases de surf y ver el atardecer; ensenadas más tranquilas dentro del parque.",
        },
      },
      {
        title: { en: "Mangroves and rivers", es: "Manglares y ríos" },
        text: {
          en: "Boat or kayak trips through the mangroves near Quepos, and rafting on the rivers inland.",
          es: "Paseos en lancha o kayak por los manglares cerca de Quepos, y rafting en los ríos tierra adentro.",
        },
      },
      {
        title: { en: "On the way: crocodiles and macaws", es: "En el camino: cocodrilos y lapas" },
        text: {
          en: "The Tárcoles crocodile bridge and Carara National Park's scarlet macaws are on the road from San José.",
          es: "El puente de los cocodrilos de Tárcoles y las lapas rojas del Parque Nacional Carara quedan sobre la carretera desde San José.",
        },
      },
    ],
    goodToKnow: [
      {
        en: "Manuel Antonio National Park is closed on Tuesdays. Tickets are sold online only, in advance, for a set entry time, and the number of visitors per day is limited; they are not sold at the gate. Check the national parks service (SINAC) for current rules and prices.",
        es: "El Parque Nacional Manuel Antonio cierra los martes. Las entradas se venden solo en línea, con anticipación y para una hora de ingreso, y el número de visitantes por día es limitado; no se venden en la entrada. Consulte las reglas y los precios vigentes en el Sistema Nacional de Áreas de Conservación (SINAC).",
      },
    ],
    areas: [
      {
        name: { en: "The hill between Quepos and the park", es: "La colina entre Quepos y el parque" },
        text: {
          en: "Most hotels and restaurants are along this winding road, many with ocean views and visiting monkeys. You take the local bus or a taxi down to the beach.",
          es: "La mayoría de los hoteles y restaurantes están a lo largo de esta carretera con curvas, muchos con vista al mar y monos de visita. Para bajar a la playa se toma el bus local o un taxi.",
        },
      },
      {
        name: { en: "By the beach and the park entrance", es: "Junto a la playa y la entrada del parque" },
        text: {
          en: "The bottom of the hill, where you can walk to the sand and to the park gate. Livelier and busier during the day, with fewer views.",
          es: "La parte baja de la colina, desde donde se camina a la arena y a la entrada del parque. Más animada y concurrida durante el día, con menos vistas.",
        },
      },
      {
        name: { en: "Quepos town", es: "Quepos" },
        text: {
          en: "The most affordable base, with the marina, supermarkets, banks and the bus terminal. The beach and the park are a short bus ride up and over the hill.",
          es: "La base más económica, con la marina, supermercados, bancos y la terminal de buses. La playa y el parque quedan a un trayecto corto en bus, subiendo y bajando la colina.",
        },
      },
    ],
    faqs: [
      {
        q: { en: "How do I get from San José airport to Manuel Antonio?", es: "¿Cómo llego del aeropuerto de San José a Manuel Antonio?" },
        a: {
          en: "By road, in about {time:SJO>ManuelAntonio}. A private transfer goes door to door from {price:SJO>ManuelAntonio} per vehicle; shared shuttles and public buses also run, and domestic flights go to Quepos.",
          es: "Por carretera, en unas {time:SJO>ManuelAntonio}. Un traslado privado va puerta a puerta desde {price:SJO>ManuelAntonio} por vehículo; también hay shuttles compartidos y buses públicos, y vuelos nacionales a Quepos.",
        },
      },
      {
        q: { en: "Do I need to buy national park tickets in advance?", es: "¿Hay que comprar las entradas al parque con anticipación?" },
        a: {
          en: "Yes. Tickets are sold online only, for a set day and entry time, and daily numbers are limited. The park is closed on Tuesdays.",
          es: "Sí. Las entradas se venden solo en línea, para un día y una hora de ingreso, y el cupo diario es limitado. El parque cierra los martes.",
        },
      },
      {
        q: { en: "How many days do I need in Manuel Antonio?", es: "¿Cuántos días se necesitan en Manuel Antonio?" },
        a: {
          en: "Two or three: a morning in the national park, a catamaran or mangrove trip, and time on the beach.",
          es: "Dos o tres: una mañana en el parque nacional, un paseo en catamarán o por el manglar, y tiempo de playa.",
        },
      },
      {
        q: { en: "Do I need a car in Manuel Antonio?", es: "¿Se necesita vehículo en Manuel Antonio?" },
        a: {
          en: "No. The local bus between Quepos and the park is frequent, taxis are easy to find and parking near the park is scarce.",
          es: "No. El bus local entre Quepos y el parque pasa con frecuencia, es fácil conseguir taxi y hay poco parqueo cerca del parque.",
        },
      },
      {
        q: { en: "Can we stop at the crocodile bridge on the way?", es: "¿Podemos parar en el puente de los cocodrilos en el camino?" },
        a: {
          en: "Yes. The Tárcoles bridge is right on the coastal highway from San José. On a private transfer you can add it as a stop, and your luggage stays locked in the vehicle with your driver.",
          es: "Sí. El puente de Tárcoles está sobre la Costanera viniendo de San José. En un traslado privado puede agregarlo como parada, y su equipaje queda bajo llave en el vehículo con su conductor.",
        },
      },
      {
        q: { en: "How do I get from La Fortuna to Manuel Antonio?", es: "¿Cómo se va de La Fortuna a Manuel Antonio?" },
        a: {
          en: "By road in about {time:Arenal>ManuelAntonio}: over the mountains to the Pacific and then down the coastal highway. A private transfer costs from {price:Arenal>ManuelAntonio} per vehicle.",
          es: "Por carretera en unas {time:Arenal>ManuelAntonio}: se cruzan las montañas hasta el Pacífico y luego se sigue la Costanera. Un traslado privado cuesta desde {price:Arenal>ManuelAntonio} por vehículo.",
        },
      },
      FAQ_PER_VEHICLE,
    ],
  },

  // ───────────────────────── Monteverde ─────────────────────────
  {
    slug: "monteverde",
    hub: "Monteverde",
    region: "Monteverde",
    photo: "monteverde",
    updated: UPDATED,
    name: { en: "Monteverde", es: "Monteverde" },
    title: {
      en: "Monteverde cloud forest: how to get there, when to go, where to stay",
      es: "Bosque nuboso de Monteverde: cómo llegar, cuándo ir y dónde hospedarse",
    },
    metaDescription: {
      en: "Monteverde and Santa Elena travel guide: drive times and private transfer prices from San José (SJO) and Liberia (LIR), the mountain road, bus and shuttle options, best time to go, reserves and where to stay by area.",
      es: "Guía de Monteverde y Santa Elena: tiempos de viaje y precios de traslado privado desde San José (SJO) y Liberia (LIR), la carretera de montaña, bus y shuttle, mejor época, reservas y dónde hospedarse por zona.",
    },
    teaser: { en: "Cloud forest, hanging bridges and night walks", es: "Bosque nuboso, puentes colgantes y caminatas nocturnas" },
    answer: {
      en: "Monteverde, in the mountains above the Pacific lowlands, is about {time:SJO>Monteverde} by road from San José airport (SJO) and {time:LIR>Monteverde} from Liberia airport (LIR). There is no airport: everyone arrives by road, and the last stretch is a steep, winding climb. A private transfer costs from {price:SJO>Monteverde} per vehicle from SJO and from {price:LIR>Monteverde} from LIR (green-season price, up to {pax:SJO>Monteverde} travellers).",
      es: "Monteverde, en las montañas sobre las tierras bajas del Pacífico, está a unas {time:SJO>Monteverde} por carretera del aeropuerto de San José (SJO) y a {time:LIR>Monteverde} del aeropuerto de Liberia (LIR). No tiene aeropuerto: todos llegan por carretera, y el último tramo es una subida empinada y con curvas. Un traslado privado cuesta desde {price:SJO>Monteverde} por vehículo desde SJO y desde {price:LIR>Monteverde} desde LIR (precio de temporada verde, hasta {pax:SJO>Monteverde} viajeros).",
    },
    intro: {
      en: "Monteverde is a string of small communities around the town of Santa Elena, about 1,400 m above sea level, surrounded by cloud forest reserves. It is cooler, windier and mistier than the coast: bring a light jacket and a rain layer.",
      es: "Monteverde es una serie de pequeñas comunidades alrededor del pueblo de Santa Elena, a unos 1.400 m sobre el nivel del mar, rodeadas de reservas de bosque nuboso. Es más fresco, ventoso y neblinoso que la costa: traiga una chaqueta liviana y algo para la lluvia.",
    },
    rides: [
      { origin: "SJO", destination: "Monteverde" },
      { origin: "LIR", destination: "Monteverde" },
      { origin: "Arenal", destination: "Monteverde" },
      { origin: "Monteverde", destination: "ManuelAntonio" },
      { origin: "Monteverde", destination: "Tamarindo" },
    ],
    airports: {
      en: "The two airports are about the same distance away. From either one you follow the Inter-American Highway through the hot lowlands and then climb into the mountains; the main road up through Guacimal is paved now, but tight curves, fog and wind keep speeds low. Arrive in daylight if you can.",
      es: "Los dos aeropuertos quedan casi a la misma distancia. Desde cualquiera se sigue la Interamericana por las tierras bajas y calurosas y luego se sube a la montaña; la carretera principal por Guacimal ya está pavimentada, pero las curvas cerradas, la neblina y el viento obligan a ir despacio. Si puede, llegue con luz de día.",
    },
    otherWays: [
      {
        kind: "bus",
        text: {
          en: "Direct public buses link downtown San José with Santa Elena, and there are buses from Puntarenas and other lowland towns. They are the cheapest way up and take most of a morning or afternoon. Buses leave from a terminal in the city, not from the airport; seats can sell out in high season, and terminals and timetables change, so confirm before you travel.",
          es: "Hay buses públicos directos del centro de San José a Santa Elena, y buses desde Puntarenas y otros pueblos de las tierras bajas. Son la forma más barata de subir y toman buena parte de una mañana o una tarde. Salen de una terminal en la ciudad, no del aeropuerto; en temporada alta los asientos pueden agotarse, y las terminales y los horarios cambian: confirme antes de viajar.",
        },
      },
      SHUTTLE,
      {
        kind: "flight",
        text: {
          en: "There are no flights to Monteverde. The nearest airports are the two international ones, San José and Liberia.",
          es: "No hay vuelos a Monteverde. Los aeropuertos más cercanos son los dos internacionales, San José y Liberia.",
        },
      },
      car(
        "The main road is paved, but many side roads to hotels and reserves are steep gravel, where a vehicle with good clearance helps.",
        "La carretera principal está pavimentada, pero muchos caminos secundarios a hoteles y reservas son de lastre y empinados, donde ayuda un vehículo alto.",
      ),
    ],
    bestTime: {
      dry: {
        en: "December to April is the drier season. The first months are also the windiest, with fine mist blowing over the ridge even on sunny days.",
        es: "De diciembre a abril es la época más seca. Los primeros meses son también los más ventosos, con una llovizna fina que pasa sobre la cordillera incluso en días de sol.",
      },
      green: {
        en: "May to November is greener and quieter. Mornings are often clear and rain usually arrives after midday, so plan walks and ziplines early.",
        es: "De mayo a noviembre todo está más verde y más tranquilo. Las mañanas suelen estar despejadas y la lluvia llega por lo general después del mediodía: programe las caminatas y el canopy temprano.",
      },
      note: DRY_NOTE,
    },
    thingsToDo: [
      {
        title: { en: "Cloud forest reserves", es: "Reservas de bosque nuboso" },
        text: {
          en: "Several reserves protect the forest, each with its own trails and entrance. Go early, with a naturalist guide if you want to see birds such as the quetzal.",
          es: "Varias reservas protegen el bosque, cada una con sus senderos y su entrada. Vaya temprano, y con guía naturalista si quiere ver aves como el quetzal.",
        },
      },
      {
        title: { en: "Hanging bridges and ziplines", es: "Puentes colgantes y canopy" },
        text: {
          en: "Walk through the canopy on suspension bridges, or fly over it on a zipline.",
          es: "Camine entre las copas de los árboles por puentes colgantes, o vuele sobre ellas en un canopy.",
        },
      },
      {
        title: { en: "Night walks", es: "Caminatas nocturnas" },
        text: {
          en: "Guided walks after dark to look for sloths, frogs, insects and sleeping birds.",
          es: "Caminatas guiadas al anochecer para buscar perezosos, ranas, insectos y aves dormidas.",
        },
      },
      {
        title: { en: "Coffee, chocolate and cheese", es: "Café, chocolate y queso" },
        text: {
          en: "Farm tours explain how the community lives from coffee and dairy, a good plan for a rainy afternoon.",
          es: "Los tours en fincas muestran cómo vive la comunidad del café y de la lechería, un buen plan para una tarde lluviosa.",
        },
      },
    ],
    goodToKnow: [
      {
        en: "The cloud forest reserves limit how many visitors are inside at once, and some sell timed tickets online. Rules changed in 2026, so book on each reserve's own website before you go.",
        es: "Las reservas de bosque nuboso limitan cuántos visitantes hay adentro al mismo tiempo, y algunas venden en línea entradas con horario. Las reglas cambiaron en 2026: reserve en el sitio web de cada reserva antes de ir.",
      },
    ],
    areas: [
      {
        name: { en: "Santa Elena town", es: "Santa Elena" },
        text: {
          en: "The centre: restaurants, supermarkets, banks, tour offices and the bus stop, all within a few blocks. The most practical base without a car.",
          es: "El centro: restaurantes, supermercados, bancos, oficinas de tours y la parada de buses, todo en pocas cuadras. La base más práctica sin vehículo.",
        },
      },
      {
        name: { en: "Cerro Plano", es: "Cerro Plano" },
        text: {
          en: "The stretch between Santa Elena and Monteverde, with small hotels and restaurants along the road. Quieter than town and still a short taxi ride from everything.",
          es: "El tramo entre Santa Elena y Monteverde, con hoteles pequeños y restaurantes a lo largo de la carretera. Más tranquilo que el pueblo y a un trayecto corto en taxi de todo.",
        },
      },
      {
        name: { en: "Monteverde, toward the reserve", es: "Monteverde, hacia la reserva" },
        text: {
          en: "The original community at the end of the road, closest to the cloud forest. Forest lodges and silence; you need a taxi or driver to go out in the evening.",
          es: "La comunidad original al final de la carretera, la más cercana al bosque nuboso. Lodges entre el bosque y silencio; necesitará taxi o conductor para salir de noche.",
        },
      },
    ],
    faqs: [
      {
        q: { en: "How do I get from San José airport to Monteverde?", es: "¿Cómo llego del aeropuerto de San José a Monteverde?" },
        a: {
          en: "By road, in about {time:SJO>Monteverde}. A private transfer goes door to door from {price:SJO>Monteverde} per vehicle; shared shuttles run at fixed times; the public bus leaves from downtown San José. There are no flights.",
          es: "Por carretera, en unas {time:SJO>Monteverde}. Un traslado privado va puerta a puerta desde {price:SJO>Monteverde} por vehículo; los shuttles compartidos salen en horarios fijos; el bus público sale del centro de San José. No hay vuelos.",
        },
      },
      {
        q: { en: "Is the road to Monteverde paved?", es: "¿La carretera a Monteverde está pavimentada?" },
        a: {
          en: "The main climb is paved today, but it is narrow, steep and curvy, and fog is common. Side roads to many hotels and reserves are gravel.",
          es: "La subida principal está pavimentada, pero es angosta, empinada y con curvas, y la neblina es frecuente. Los caminos secundarios a muchos hoteles y reservas son de lastre.",
        },
      },
      {
        q: { en: "Is Monteverde cold?", es: "¿Hace frío en Monteverde?" },
        a: {
          en: "Cooler than the rest of the country. Evenings are often misty and windy, around 15–18 °C, so keep a light jacket and a rain layer at hand.",
          es: "Más fresco que el resto del país. Las noches suelen ser neblinosas y ventosas, alrededor de 15–18 °C: tenga a mano una chaqueta liviana y algo para la lluvia.",
        },
      },
      {
        q: { en: "How many days do I need in Monteverde?", es: "¿Cuántos días se necesitan en Monteverde?" },
        a: {
          en: "Two full days cover a reserve, the hanging bridges or ziplines and a night walk.",
          es: "Dos días completos alcanzan para una reserva, los puentes colgantes o el canopy y una caminata nocturna.",
        },
      },
      {
        q: { en: "How do I get from La Fortuna to Monteverde?", es: "¿Cómo se va de La Fortuna a Monteverde?" },
        a: {
          en: "Around Lake Arenal by road, about {time:Arenal>Monteverde} door to door and from {price:Arenal>Monteverde} per vehicle, or by jeep-boat-jeep across the lake with two vehicle changes.",
          es: "Bordeando el lago Arenal por carretera, unas {time:Arenal>Monteverde} de puerta a puerta y desde {price:Arenal>Monteverde} por vehículo, o en jeep-boat-jeep cruzando el lago, con dos cambios de vehículo.",
        },
      },
      FAQ_PER_VEHICLE,
    ],
  },

  // ───────────────────────── Tamarindo / Guanacaste ─────────────────────────
  {
    slug: "tamarindo",
    hub: "Tamarindo",
    photo: "guanacaste-beach-sunset",
    updated: UPDATED,
    name: { en: "Tamarindo / Guanacaste", es: "Tamarindo / Guanacaste" },
    title: {
      en: "Tamarindo & the Guanacaste coast: how to get there, when to go, where to stay",
      es: "Tamarindo y la costa de Guanacaste: cómo llegar, cuándo ir y dónde hospedarse",
    },
    metaDescription: {
      en: "Tamarindo and Guanacaste travel guide: drive times and private transfer prices from Liberia (LIR) and San José (SJO), bus, shuttle and flight options, best time to go, things to do and where to stay by area.",
      es: "Guía de Tamarindo y Guanacaste: tiempos de viaje y precios de traslado privado desde Liberia (LIR) y San José (SJO), bus, shuttle y vuelos, mejor época, qué hacer y dónde hospedarse por zona.",
    },
    teaser: { en: "Surf, sunsets and the driest weather", es: "Surf, atardeceres y el clima más seco" },
    answer: {
      en: "Tamarindo, on Guanacaste's Pacific coast, is about {time:LIR>Tamarindo} by road from Liberia airport (LIR), the closest international airport, and {time:SJO>Tamarindo} from San José airport (SJO). A private transfer costs from {price:LIR>Tamarindo} per vehicle from LIR and from {price:SJO>Tamarindo} from SJO (green-season price, up to {pax:LIR>Tamarindo} travellers).",
      es: "Tamarindo, en la costa del Pacífico de Guanacaste, está a {time:LIR>Tamarindo} por carretera del aeropuerto de Liberia (LIR), el aeropuerto internacional más cercano, y a {time:SJO>Tamarindo} del aeropuerto de San José (SJO). Un traslado privado cuesta desde {price:LIR>Tamarindo} por vehículo desde LIR y desde {price:SJO>Tamarindo} desde SJO (precio de temporada verde, hasta {pax:LIR>Tamarindo} viajeros).",
    },
    intro: {
      en: "Tamarindo is Guanacaste's liveliest beach town: a long bay with gentle waves for learning to surf, restaurants on the sand and a river estuary at its north end. The quieter beaches of Langosta and Playa Grande sit on either side.",
      es: "Tamarindo es el pueblo de playa más animado de Guanacaste: una bahía larga con olas suaves para aprender a surfear, restaurantes sobre la arena y un estero en su extremo norte. Las playas más tranquilas de Langosta y Playa Grande quedan a cada lado.",
    },
    rides: [
      { origin: "LIR", destination: "Tamarindo" },
      { origin: "SJO", destination: "Tamarindo" },
      { origin: "Tamarindo", destination: "Arenal" },
      { origin: "Monteverde", destination: "Tamarindo" },
    ],
    airports: {
      en: "Fly into Liberia (LIR) if you can: the drive is short, flat and easy, through ranch land and dry forest. From San José (SJO) it is a long day across the country, down to the Pacific, north on the Inter-American Highway and over the Tempisque River bridge onto the Nicoya Peninsula. If you land in San José late, consider a night near the airport and the drive the next morning.",
      es: "Si puede, llegue por Liberia (LIR): el recorrido es corto, plano y sencillo, entre fincas ganaderas y bosque seco. Desde San José (SJO) es un día largo cruzando el país: se baja al Pacífico, se sigue al norte por la Interamericana y se cruza el puente sobre el río Tempisque hacia la península de Nicoya. Si aterriza tarde en San José, considere pasar la noche cerca del aeropuerto y viajar a la mañana siguiente.",
    },
    otherWays: [
      {
        kind: "bus",
        text: {
          en: "Public buses reach Tamarindo from the town of Liberia and, on a much longer trip, from downtown San José. From Liberia airport you normally need a taxi into town to catch one, because buses do not reliably stop at the terminal. Timetables change, so check locally.",
          es: "Hay buses públicos a Tamarindo desde la ciudad de Liberia y, en un viaje mucho más largo, desde el centro de San José. Desde el aeropuerto de Liberia normalmente hay que tomar un taxi hasta la ciudad para abordarlos, porque los buses no siempre paran en la terminal aérea. Los horarios cambian: consulte en el lugar.",
        },
      },
      SHUTTLE,
      {
        kind: "flight",
        text: {
          en: "Domestic flights have linked San José with Tamarindo's small airstrip and with Liberia. Schedules and routes change by season, so check the airline's current timetable.",
          es: "Ha habido vuelos nacionales entre San José y el pequeño aeródromo de Tamarindo, y también a Liberia. Los horarios y las rutas cambian según la temporada: revise el itinerario vigente de la aerolínea.",
        },
      },
      car(
        "A rental car is useful here if you want to explore other beaches up and down the coast; the road from Liberia is paved and simple.",
        "Aquí un vehículo alquilado es útil si quiere conocer otras playas de la costa; la carretera desde Liberia está pavimentada y es sencilla.",
      ),
    ],
    bestTime: {
      dry: {
        en: "Guanacaste is the driest part of Costa Rica. From December to April it barely rains: days are hot and sunny, and the landscape turns golden.",
        es: "Guanacaste es la zona más seca de Costa Rica. De diciembre a abril casi no llueve: los días son calurosos y soleados, y el paisaje se vuelve dorado.",
      },
      green: {
        en: "From May to November the hills turn green, mornings are usually sunny and showers come in the afternoon. September and October are the wettest months, and the quietest.",
        es: "De mayo a noviembre los cerros reverdecen, las mañanas suelen ser soleadas y los aguaceros llegan por la tarde. Septiembre y octubre son los meses más lluviosos, y los más tranquilos.",
      },
      note: DRY_NOTE,
    },
    thingsToDo: [
      {
        title: { en: "Surfing", es: "Surf" },
        text: {
          en: "Tamarindo's bay is one of the country's classic places to take a first lesson; experienced surfers head to the breaks nearby.",
          es: "La bahía de Tamarindo es uno de los lugares clásicos del país para una primera clase; los surfistas con experiencia van a las rompientes cercanas.",
        },
      },
      {
        title: { en: "Sunset sails and snorkelling", es: "Veleros al atardecer y snorkel" },
        text: {
          en: "Catamarans leave from the beach for an afternoon along the coast.",
          es: "Los catamaranes salen desde la playa para una tarde a lo largo de la costa.",
        },
      },
      {
        title: { en: "The estuary", es: "El estero" },
        text: {
          en: "Boat trips through the mangroves to see birds, crocodiles and monkeys. Do not swim across the river mouth: crocodiles live there.",
          es: "Paseos en lancha por el manglar para ver aves, cocodrilos y monos. No cruce a nado la boca del río: allí viven cocodrilos.",
        },
      },
      {
        title: { en: "Sea turtles at Playa Grande", es: "Tortugas marinas en Playa Grande" },
        text: {
          en: "Leatherback turtles nest on Playa Grande, inside Las Baulas National Marine Park, roughly from October to February. Visits are at night, only with the park's guides and in limited numbers, and sightings are not guaranteed.",
          es: "Las tortugas baula anidan en Playa Grande, dentro del Parque Nacional Marino Las Baulas, aproximadamente de octubre a febrero. Las visitas son de noche, solo con guías del parque y con cupo limitado, y no se garantiza ver tortugas.",
        },
      },
    ],
    areas: [
      {
        name: { en: "Tamarindo centre", es: "Centro de Tamarindo" },
        text: {
          en: "Everything on foot: the beach, surf schools, restaurants, shops and nightlife. The busiest and noisiest choice.",
          es: "Todo a pie: la playa, las escuelas de surf, restaurantes, tiendas y vida nocturna. La opción más concurrida y ruidosa.",
        },
      },
      {
        name: { en: "Langosta", es: "Langosta" },
        text: {
          en: "The residential point just south of town: quieter, with a rockier beach, and a short walk or drive from Tamarindo's restaurants.",
          es: "La punta residencial justo al sur del pueblo: más tranquila, con una playa más rocosa, y a poca distancia a pie o en vehículo de los restaurantes de Tamarindo.",
        },
      },
      {
        name: { en: "Playa Grande", es: "Playa Grande" },
        text: {
          en: "Across the estuary, inside the marine park: a long, undeveloped beach with a handful of small hotels. Close as the crow flies, but a longer drive around by road.",
          es: "Al otro lado del estero, dentro del parque marino: una playa larga y sin desarrollo, con unos pocos hoteles pequeños. Cerca en línea recta, pero con un recorrido más largo por carretera.",
        },
      },
      {
        name: { en: "Other Guanacaste beaches", es: "Otras playas de Guanacaste" },
        text: {
          en: "Flamingo, Potrero and Conchal to the north are calmer and more resort-like; Avellanas and Playa Negra to the south are rural surf beaches. Enter your exact hotel in the trip builder for the price to any of them.",
          es: "Flamingo, Potrero y Conchal, al norte, son más tranquilas y de estilo resort; Avellanas y Playa Negra, al sur, son playas rurales de surf. Escriba su hotel exacto en el planificador de viajes para ver el precio a cualquiera de ellas.",
        },
      },
    ],
    faqs: [
      {
        q: { en: "How do I get from Liberia airport to Tamarindo?", es: "¿Cómo llego del aeropuerto de Liberia a Tamarindo?" },
        a: {
          en: "By road, in about {time:LIR>Tamarindo}. A private transfer goes door to door from {price:LIR>Tamarindo} per vehicle; official airport taxis and shared shuttles also make the trip; public buses leave from the town of Liberia rather than the airport.",
          es: "Por carretera, en {time:LIR>Tamarindo} aproximadamente. Un traslado privado va puerta a puerta desde {price:LIR>Tamarindo} por vehículo; también hacen el viaje los taxis oficiales del aeropuerto y los shuttles compartidos; los buses públicos salen de la ciudad de Liberia y no del aeropuerto.",
        },
      },
      {
        q: { en: "Should I fly into Liberia or San José for Tamarindo?", es: "¿Conviene llegar por Liberia o por San José para ir a Tamarindo?" },
        a: {
          en: "Liberia (LIR) is far closer: about {time:LIR>Tamarindo} by road, against {time:SJO>Tamarindo} from San José (SJO).",
          es: "Liberia (LIR) queda mucho más cerca: {time:LIR>Tamarindo} por carretera, frente a {time:SJO>Tamarindo} desde San José (SJO).",
        },
      },
      {
        q: { en: "Can the driver stop for groceries on the way?", es: "¿El conductor puede parar a comprar víveres en el camino?" },
        a: {
          en: "Yes. Many travellers staying in rental homes ask for a quick supermarket stop; tell us when you book or tell your driver.",
          es: "Sí. Muchos viajeros que se hospedan en casas de alquiler piden una parada rápida en un supermercado; indíquelo al reservar o dígaselo a su conductor.",
        },
      },
      {
        q: { en: "Can you take us to Playa Grande, Langosta or Flamingo instead?", es: "¿Pueden llevarnos a Playa Grande, Langosta o Flamingo?" },
        a: {
          en: "Yes. Enter your exact hotel or rental in the trip builder and you will see the price to that address.",
          es: "Sí. Escriba su hotel o casa exactos en el planificador de viajes y verá el precio hasta esa dirección.",
        },
      },
      {
        q: { en: "When is the best time to visit Tamarindo?", es: "¿Cuál es la mejor época para visitar Tamarindo?" },
        a: {
          en: "December to April for guaranteed sun; May to August for green hills, fewer people and lower prices with afternoon showers. September and October are the rainiest months.",
          es: "De diciembre a abril para sol seguro; de mayo a agosto para cerros verdes, menos gente y precios más bajos, con aguaceros por la tarde. Septiembre y octubre son los meses más lluviosos.",
        },
      },
      {
        q: { en: "How do I get from Tamarindo to La Fortuna?", es: "¿Cómo se va de Tamarindo a La Fortuna?" },
        a: {
          en: "By road in about {time:Tamarindo>Arenal}, through Liberia and around Lake Arenal. A private transfer costs from {price:Tamarindo>Arenal} per vehicle.",
          es: "Por carretera en unas {time:Tamarindo>Arenal}, pasando por Liberia y bordeando el lago Arenal. Un traslado privado cuesta desde {price:Tamarindo>Arenal} por vehículo.",
        },
      },
      FAQ_PER_VEHICLE,
    ],
  },

  // ───────────────────────── Puerto Viejo (Caribbean) ─────────────────────────
  {
    slug: "puerto-viejo",
    hub: "PuertoViejo",
    photo: "sloth-resting",
    updated: UPDATED,
    name: { en: "Puerto Viejo (Caribbean)", es: "Puerto Viejo (Caribe)" },
    title: {
      en: "Puerto Viejo & the South Caribbean: how to get there, when to go, where to stay",
      es: "Puerto Viejo y el Caribe Sur: cómo llegar, cuándo ir y dónde hospedarse",
    },
    metaDescription: {
      en: "Puerto Viejo de Talamanca travel guide: drive times and private transfer prices from San José (SJO), Route 32, bus and shuttle options, Caribbean weather, Cahuita and Manzanillo, and where to stay beach by beach.",
      es: "Guía de Puerto Viejo de Talamanca: tiempos de viaje y precios de traslado privado desde San José (SJO), la Ruta 32, bus y shuttle, el clima del Caribe, Cahuita y Manzanillo, y dónde hospedarse playa por playa.",
    },
    teaser: { en: "Caribbean beaches, cacao and sloths", es: "Playas caribeñas, cacao y perezosos" },
    answer: {
      en: "Puerto Viejo de Talamanca, on the southern Caribbean coast, is about {time:SJO>PuertoViejo} by road from San José airport (SJO), through Braulio Carrillo National Park and the port city of Limón. A private transfer costs from {price:SJO>PuertoViejo} per vehicle (green-season price, up to {pax:SJO>PuertoViejo} travellers). Liberia airport (LIR) is about {time:LIR>PuertoViejo} away, so fly into San José.",
      es: "Puerto Viejo de Talamanca, en el Caribe Sur, está a unas {time:SJO>PuertoViejo} por carretera del aeropuerto de San José (SJO), cruzando el Parque Nacional Braulio Carrillo y la ciudad portuaria de Limón. Un traslado privado cuesta desde {price:SJO>PuertoViejo} por vehículo (precio de temporada verde, hasta {pax:SJO>PuertoViejo} viajeros). El aeropuerto de Liberia (LIR) queda a unas {time:LIR>PuertoViejo}, así que conviene llegar por San José.",
    },
    intro: {
      en: "Puerto Viejo is a small, relaxed town with Afro-Caribbean and Bribri roots, reggae and coconut-rice cooking. A single coastal road runs south from it past a string of beaches, Cocles, Playa Chiquita, Punta Uva and Manzanillo, with rainforest right behind the sand.",
      es: "Puerto Viejo es un pueblo pequeño y relajado, de raíces afrocaribeñas y bribris, con reggae y cocina de rice and beans con coco. Una sola carretera costera sale hacia el sur y pasa por una serie de playas, Cocles, Playa Chiquita, Punta Uva y Manzanillo, con el bosque lluvioso justo detrás de la arena.",
    },
    rides: [
      { origin: "SJO", destination: "PuertoViejo" },
      { origin: "LIR", destination: "PuertoViejo" },
      { origin: "PuertoViejo", destination: "Arenal" },
    ],
    airports: {
      en: "San José (SJO) is the only practical airport. Route 32 climbs through the cloud forest of Braulio Carrillo, drops to the Caribbean lowlands and runs past banana plantations to Limón; from there the coast road goes south past Cahuita. After very heavy rain, landslides can close Route 32, and drivers take the longer road through Turrialba, which adds time.",
      es: "San José (SJO) es el único aeropuerto práctico. La Ruta 32 sube por el bosque nuboso del Braulio Carrillo, baja a las llanuras del Caribe y pasa entre bananales hasta Limón; desde allí la carretera costera sigue al sur pasando por Cahuita. Después de lluvias muy fuertes, los derrumbes pueden cerrar la Ruta 32, y los conductores toman la carretera más larga por Turrialba, lo que suma tiempo.",
    },
    otherWays: [
      {
        kind: "bus",
        text: {
          en: "Direct public buses run from San José to Puerto Viejo, passing Limón and Cahuita. They are inexpensive and take most of a morning or afternoon. Buses leave from a terminal in the city, not from the airport, and the terminal has changed in recent years, so confirm where and when before you travel.",
          es: "Hay buses públicos directos de San José a Puerto Viejo, que pasan por Limón y Cahuita. Son económicos y toman buena parte de una mañana o una tarde. Salen de una terminal en la ciudad, no del aeropuerto, y la terminal ha cambiado en los últimos años: confirme dónde y cuándo antes de viajar.",
        },
      },
      SHUTTLE,
      {
        kind: "flight",
        text: {
          en: "Domestic flights have operated between San José and Limón, which still leaves about an hour by road to Puerto Viejo. The route has not run continuously, so check whether it is flying on your dates.",
          es: "Ha habido vuelos nacionales entre San José y Limón, desde donde todavía falta cerca de una hora por carretera hasta Puerto Viejo. La ruta no ha operado de forma continua: verifique si está activa en sus fechas.",
        },
      },
      car(
        "Route 32 is busy with container trucks heading to the port, and it is steep, foggy and often wet in the mountains. Once in Puerto Viejo, most people get around by bicycle.",
        "La Ruta 32 tiene mucho tránsito de camiones de contenedores hacia el puerto, y en la montaña es empinada, con neblina y a menudo mojada. Ya en Puerto Viejo, la mayoría se mueve en bicicleta.",
      ),
    ],
    bestTime: {
      dry: {
        en: "The Caribbean does not follow the Pacific's calendar: it can rain in any month, including December and January. February and March are often drier.",
        es: "El Caribe no sigue el calendario del Pacífico: puede llover en cualquier mes, incluidos diciembre y enero. Febrero y marzo suelen ser más secos.",
      },
      green: {
        en: "September and October, the rainiest months on the Pacific side, are often the sunniest and calmest here, with a flat sea for snorkelling. Whatever the month, expect showers and pack accordingly.",
        es: "Septiembre y octubre, los meses más lluviosos en el Pacífico, suelen ser aquí los más soleados y tranquilos, con el mar calmo para hacer snorkel. En cualquier mes, cuente con aguaceros y empaque pensando en ellos.",
      },
      note: {
        en: "Our transfer prices follow the same seasons everywhere in the country: a little higher from December to April and in holiday weeks. The exact price for your date is shown before you book.",
        es: "Los precios de nuestros traslados siguen las mismas temporadas en todo el país: un poco más altos de diciembre a abril y en semanas feriadas. El precio exacto para su fecha aparece antes de reservar.",
      },
    },
    thingsToDo: [
      {
        title: { en: "Cahuita National Park", es: "Parque Nacional Cahuita" },
        text: {
          en: "A flat coastal trail between the forest and a white-sand beach, north of Puerto Viejo, good for sloths, monkeys and snorkelling on the reef with a local guide.",
          es: "Un sendero costero plano entre el bosque y una playa de arena blanca, al norte de Puerto Viejo, bueno para ver perezosos y monos y para hacer snorkel en el arrecife con un guía local.",
        },
      },
      {
        title: { en: "The beaches south of town", es: "Las playas al sur del pueblo" },
        text: {
          en: "Cocles for surf, Playa Chiquita and Punta Uva for calm water and shade, all along one road that is ideal by bicycle.",
          es: "Cocles para surfear, Playa Chiquita y Punta Uva para aguas tranquilas y sombra, todas a lo largo de una carretera ideal para recorrer en bicicleta.",
        },
      },
      {
        title: { en: "Gandoca-Manzanillo Wildlife Refuge", es: "Refugio de Vida Silvestre Gandoca-Manzanillo" },
        text: {
          en: "Coastal trails through the rainforest starting at the village of Manzanillo, where the road ends.",
          es: "Senderos costeros por el bosque lluvioso que empiezan en el pueblo de Manzanillo, donde termina la carretera.",
        },
      },
      {
        title: { en: "Cacao, culture and wildlife rescue", es: "Cacao, cultura y rescate de fauna" },
        text: {
          en: "Chocolate tours on small cacao farms, visits to Bribri communities in the hills, and wildlife rescue centres that care for injured sloths and monkeys.",
          es: "Tours de chocolate en pequeñas fincas de cacao, visitas a comunidades bribris en las montañas y centros de rescate que atienden perezosos y monos heridos.",
        },
      },
    ],
    areas: [
      {
        name: { en: "Puerto Viejo town", es: "Puerto Viejo centro" },
        text: {
          en: "Restaurants, bars, shops, bike rentals and the bus stop. Lively at night; the best base without transport.",
          es: "Restaurantes, bares, tiendas, alquiler de bicicletas y la parada de buses. Animado de noche; la mejor base sin transporte.",
        },
      },
      {
        name: { en: "Playa Cocles", es: "Playa Cocles" },
        text: {
          en: "The first beach south of town, a short bike ride away: surf, beach bars and a wide choice of small hotels.",
          es: "La primera playa al sur del pueblo, a un trayecto corto en bicicleta: surf, bares de playa y muchos hoteles pequeños para elegir.",
        },
      },
      {
        name: { en: "Playa Chiquita and Punta Uva", es: "Playa Chiquita y Punta Uva" },
        text: {
          en: "Further south, the jungle closes in and the sea is calmer. Quiet lodges among the trees; you will want a bicycle or a driver to reach town.",
          es: "Más al sur, la selva se cierra y el mar es más tranquilo. Lodges silenciosos entre los árboles; le convendrá una bicicleta o un conductor para llegar al pueblo.",
        },
      },
      {
        name: { en: "Manzanillo", es: "Manzanillo" },
        text: {
          en: "A fishing village at the end of the road, beside the wildlife refuge. Very quiet, with few services.",
          es: "Un pueblo de pescadores al final de la carretera, junto al refugio de vida silvestre. Muy tranquilo, con pocos servicios.",
        },
      },
      {
        name: { en: "Cahuita", es: "Cahuita" },
        text: {
          en: "A separate, sleepier village north of Puerto Viejo, at the national park's entrance. A good choice for families and for a slower pace.",
          es: "Un pueblo aparte y más sosegado al norte de Puerto Viejo, a la entrada del parque nacional. Buena opción para familias y para un ritmo más lento.",
        },
      },
    ],
    faqs: [
      {
        q: { en: "How do I get from San José airport to Puerto Viejo?", es: "¿Cómo llego del aeropuerto de San José a Puerto Viejo?" },
        a: {
          en: "By road, in about {time:SJO>PuertoViejo}, along Route 32 to Limón and then down the coast. A private transfer goes door to door from {price:SJO>PuertoViejo} per vehicle; shared shuttles and direct public buses also run.",
          es: "Por carretera, en unas {time:SJO>PuertoViejo}, por la Ruta 32 hasta Limón y luego por la costa hacia el sur. Un traslado privado va puerta a puerta desde {price:SJO>PuertoViejo} por vehículo; también hay shuttles compartidos y buses públicos directos.",
        },
      },
      {
        q: { en: "What happens if Route 32 is closed?", es: "¿Qué pasa si la Ruta 32 está cerrada?" },
        a: {
          en: "It happens after very heavy rain. Your driver checks conditions before leaving and takes the alternative road through Turrialba if needed, which adds time. We keep you posted on WhatsApp.",
          es: "Ocurre después de lluvias muy fuertes. Su conductor revisa las condiciones antes de salir y, si hace falta, toma la carretera alterna por Turrialba, lo que suma tiempo. Le avisamos por WhatsApp.",
        },
      },
      {
        q: { en: "When is the best time to visit Puerto Viejo?", es: "¿Cuál es la mejor época para visitar Puerto Viejo?" },
        a: {
          en: "September and October are often the driest and calmest months, the opposite of the Pacific coast, and February and March are usually good too. It can rain in any month.",
          es: "Septiembre y octubre suelen ser los meses más secos y tranquilos, al contrario del Pacífico, y febrero y marzo también suelen ser buenos. Puede llover en cualquier mes.",
        },
      },
      {
        q: { en: "Can you drop us in Cocles, Punta Uva or Manzanillo?", es: "¿Pueden dejarnos en Cocles, Punta Uva o Manzanillo?" },
        a: {
          en: "Yes. They are all along the same coastal road; enter your exact hotel in the trip builder.",
          es: "Sí. Todas quedan sobre la misma carretera costera; escriba su hotel exacto en el planificador de viajes.",
        },
      },
      {
        q: { en: "Do I need a car in Puerto Viejo?", es: "¿Se necesita vehículo en Puerto Viejo?" },
        a: {
          en: "No. The coast road is flat and most visitors rent bicycles; taxis and a local bus cover the longer hops to Cahuita and Manzanillo.",
          es: "No. La carretera costera es plana y la mayoría de los visitantes alquila bicicletas; los taxis y un bus local cubren los trayectos más largos a Cahuita y Manzanillo.",
        },
      },
      {
        q: { en: "Can I continue to Bocas del Toro in Panama?", es: "¿Se puede continuar a Bocas del Toro, en Panamá?" },
        a: {
          en: "Yes, many travellers do. The border crossing at Sixaola is south of Puerto Viejo, and from the Panamanian side you continue by road and boat. Check entry requirements for Panama before you go.",
          es: "Sí, muchos viajeros lo hacen. El paso fronterizo de Sixaola queda al sur de Puerto Viejo, y del lado panameño se continúa por carretera y en lancha. Revise los requisitos de ingreso a Panamá antes de ir.",
        },
      },
      FAQ_PER_VEHICLE,
    ],
  },

  // ───────────────────────── Drake Bay & Sierpe (Osa) ─────────────────────────
  {
    slug: "drake-bay",
    hub: "DrakeBay",
    alsoHubs: ["Sierpe"],
    region: "Osa",
    photo: "drake-bay",
    updated: UPDATED,
    name: { en: "Drake Bay & Sierpe (Osa)", es: "Bahía Drake y Sierpe (Osa)" },
    title: {
      en: "Drake Bay, Sierpe & Corcovado: how to get there, when to go, where to stay",
      es: "Bahía Drake, Sierpe y Corcovado: cómo llegar, cuándo ir y dónde hospedarse",
    },
    metaDescription: {
      en: "How to get to Drake Bay on the Osa Peninsula: the drive from San José (SJO) to Sierpe, the river boat, flights and the 4x4 road, private transfer prices, Corcovado permits, best time to go and where to stay.",
      es: "Cómo llegar a Bahía Drake, en la península de Osa: el recorrido de San José (SJO) a Sierpe, la lancha por el río, vuelos y el camino para 4x4, precios de traslado privado, permisos de Corcovado, mejor época y dónde hospedarse.",
    },
    teaser: { en: "By river boat to Corcovado's doorstep", es: "En lancha hasta la puerta de Corcovado" },
    answer: {
      en: "Most travellers reach Drake Bay by boat from the river town of Sierpe. Sierpe is about {time:SJO>Sierpe} by road from San José airport (SJO), and the boat down the river and along the coast takes about {boat} more. A private transfer from SJO to the Sierpe dock costs from {price:SJO>Sierpe} per vehicle, or from {price:SJO>DrakeBay} with the boat to Drake Bay included (green-season prices).",
      es: "La mayoría de los viajeros llega a Bahía Drake en lancha desde Sierpe, un pueblo a orillas del río. Sierpe está a unas {time:SJO>Sierpe} por carretera del aeropuerto de San José (SJO), y la lancha por el río y a lo largo de la costa toma unos {boat} más. Un traslado privado de SJO al muelle de Sierpe cuesta desde {price:SJO>Sierpe} por vehículo, o desde {price:SJO>DrakeBay} con la lancha a Bahía Drake incluida (precios de temporada verde).",
    },
    intro: {
      en: "Drake Bay is a remote village on the north shore of the Osa Peninsula, the usual base for visiting Corcovado National Park and Caño Island. There are few roads and no big hotels: lodges sit in the rainforest above the sea, and boats are the local transport.",
      es: "Bahía Drake es un pueblo remoto en la costa norte de la península de Osa, la base habitual para visitar el Parque Nacional Corcovado y la Isla del Caño. Hay pocos caminos y no hay hoteles grandes: los lodges están en el bosque lluvioso, sobre el mar, y las lanchas son el transporte local.",
    },
    rides: [
      { origin: "SJO", destination: "Sierpe" },
      { origin: "SJO", destination: "DrakeBay", note: { en: "Road to Sierpe + river boat", es: "Carretera a Sierpe + lancha por el río" } },
      { origin: "ManuelAntonio", destination: "Sierpe" },
      { origin: "ManuelAntonio", destination: "DrakeBay", note: { en: "Road to Sierpe + river boat", es: "Carretera a Sierpe + lancha por el río" } },
      { origin: "LIR", destination: "Sierpe" },
    ],
    airports: {
      en: "San José (SJO) is the airport for the Osa Peninsula. The drive follows Route 27 to the Pacific and then the coastal highway south past Jacó, Quepos, Dominical and Uvita to Palmar Norte, where a short local road leads to Sierpe. Boats usually leave in the late morning and early afternoon, and the river-mouth crossing is only done in daylight, so an international arrival normally means a first night near the airport, on the coast or in Sierpe. Liberia (LIR) is a very long drive away.",
      es: "San José (SJO) es el aeropuerto para la península de Osa. El recorrido sigue la Ruta 27 hasta el Pacífico y luego la Costanera hacia el sur, pasando por Jacó, Quepos, Dominical y Uvita, hasta Palmar Norte, donde un camino local corto lleva a Sierpe. Las lanchas suelen salir al final de la mañana y a primera hora de la tarde, y la boca del río solo se cruza con luz de día, así que una llegada internacional normalmente implica una primera noche cerca del aeropuerto, en la costa o en Sierpe. Liberia (LIR) queda a un recorrido muy largo.",
    },
    otherWays: [
      {
        kind: "bus",
        text: {
          en: "Long-distance public buses run from San José to Palmar Norte, where a taxi or local bus covers the last stretch to Sierpe. It is the cheapest way and a long day, so plan it around the boat times. Confirm bus terminals and timetables shortly before you travel.",
          es: "Hay buses públicos de larga distancia de San José a Palmar Norte, donde un taxi o un bus local cubre el último tramo hasta Sierpe. Es la forma más barata y un día largo: planéelo en función de los horarios de la lancha. Confirme terminales y horarios poco antes de viajar.",
        },
      },
      {
        kind: "shuttle",
        text: {
          en: "Shared shuttles serve Sierpe from some tourist towns at fixed times, generally planned to meet the boats. Routes are fewer than on the main circuit, so check what is running on your dates.",
          es: "Algunos shuttles compartidos llegan a Sierpe desde ciertos pueblos turísticos en horarios fijos, por lo general coordinados con las lanchas. Hay menos rutas que en el circuito principal: revise cuáles operan en sus fechas.",
        },
      },
      {
        kind: "flight",
        text: {
          en: "Small planes fly from San José to the Drake Bay airstrip, the fastest way in, followed by a short ride to your lodge. Luggage limits are strict and schedules change by season, so check the airline's current timetable.",
          es: "Hay avionetas de San José al aeródromo de Bahía Drake, la forma más rápida de llegar, seguidas de un traslado corto a su lodge. Los límites de equipaje son estrictos y los horarios cambian según la temporada: revise el itinerario vigente de la aerolínea.",
        },
      },
      {
        kind: "car",
        text: {
          en: "You can drive to Sierpe on paved roads and leave the car in paid parking near the dock. Driving all the way to Drake Bay means a rough road with several river crossings: it needs a high-clearance 4x4 and can be impassable in the rainy season. Rental companies add Costa Rica's mandatory liability insurance to the advertised rate, so ask for the full price.",
          es: "Se puede manejar hasta Sierpe por carreteras pavimentadas y dejar el vehículo en un parqueo de pago cerca del muelle. Llegar manejando hasta Bahía Drake implica un camino en mal estado con varios cruces de ríos: requiere un 4x4 alto y puede quedar intransitable en la época lluviosa. Las arrendadoras suman al precio anunciado el seguro obligatorio de responsabilidad civil de Costa Rica, así que pida el precio total.",
        },
      },
    ],
    bestTime: {
      dry: {
        en: "December to April is the drier season, with calmer seas for the boat rides to Corcovado and Caño Island and drier trails. It is also when permits and lodges fill up first.",
        es: "De diciembre a abril es la época más seca, con el mar más tranquilo para los viajes en lancha a Corcovado y a la Isla del Caño y con senderos más secos. También es cuando los permisos y los lodges se llenan primero.",
      },
      green: {
        en: "Osa is one of the rainiest corners of the country. From May to November expect heavy afternoon rain; the wettest stretch, usually September and October, brings rougher seas, and some lodges close for part of it.",
        es: "Osa es uno de los rincones más lluviosos del país. De mayo a noviembre cuente con lluvias fuertes por la tarde; el periodo más lluvioso, por lo general septiembre y octubre, trae un mar más agitado, y algunos lodges cierran durante parte de él.",
      },
      note: DRY_NOTE,
    },
    thingsToDo: [
      {
        title: { en: "Corcovado National Park", es: "Parque Nacional Corcovado" },
        text: {
          en: "Day trips by boat to the San Pedrillo or Sirena ranger stations, or an overnight at Sirena, to look for tapirs, monkeys, scarlet macaws and more.",
          es: "Excursiones de un día en lancha a las estaciones de San Pedrillo o Sirena, o una noche en Sirena, para buscar dantas, monos, lapas rojas y mucho más.",
        },
      },
      {
        title: { en: "Caño Island", es: "Isla del Caño" },
        text: {
          en: "A biological reserve offshore with some of the country's clearest water for snorkelling and diving.",
          es: "Una reserva biológica mar adentro, con algunas de las aguas más claras del país para hacer snorkel y bucear.",
        },
      },
      {
        title: { en: "Sierpe mangroves", es: "Manglares de Sierpe" },
        text: {
          en: "The boat ride itself crosses the Térraba-Sierpe wetland, Costa Rica's largest mangrove forest; dedicated tours go slowly to look for crocodiles, monkeys and birds.",
          es: "El propio viaje en lancha cruza el humedal Térraba-Sierpe, el manglar más grande de Costa Rica; los tours dedicados van despacio para buscar cocodrilos, monos y aves.",
        },
      },
      {
        title: { en: "Whales and dolphins", es: "Ballenas y delfines" },
        text: {
          en: "Dolphins are seen through much of the year, and humpback whales pass in season. Ask your lodge what is being seen when you travel.",
          es: "Los delfines se ven durante buena parte del año, y las ballenas jorobadas pasan en temporada. Pregunte en su lodge qué se está viendo en sus fechas.",
        },
      },
    ],
    goodToKnow: [
      {
        en: "Corcovado National Park can only be visited with a certified guide and a SINAC permit booked in advance; you cannot buy entry at the park. Overnight places at Sirena Station are limited and sell out early, especially from December to April.",
        es: "El Parque Nacional Corcovado solo se visita con un guía certificado y un permiso del SINAC reservado con anticipación; no se compra la entrada en el parque. Los espacios para pasar la noche en la Estación Sirena son limitados y se agotan pronto, sobre todo de diciembre a abril.",
      },
      {
        en: "Arrivals in Drake Bay are usually wet landings: you step off the boat into shallow water on the beach. Wear sandals and shorts, and pack electronics and documents in something waterproof.",
        es: "Los desembarcos en Bahía Drake suelen ser en la playa: se baja de la lancha al agua poco profunda. Use sandalias y pantalón corto, y guarde los aparatos electrónicos y los documentos en algo impermeable.",
      },
    ],
    areas: [
      {
        name: { en: "Agujitas, Drake Bay village", es: "Agujitas, el pueblo de Bahía Drake" },
        text: {
          en: "The village on the bay, where the boats land: small hotels and cabins, a few restaurants and shops, and tour operators within walking distance. The practical and less expensive base.",
          es: "El pueblo sobre la bahía, donde llegan las lanchas: hoteles pequeños y cabinas, algunos restaurantes y tiendas, y operadores de tours a poca distancia a pie. La base práctica y más económica.",
        },
      },
      {
        name: { en: "The coast toward Corcovado", es: "La costa hacia Corcovado" },
        text: {
          en: "Rainforest lodges spread along the shore beyond the village, reached by boat or on foot along the coastal trail. Usually booked with meals and tours included; the most secluded stay.",
          es: "Lodges en el bosque lluvioso repartidos por la costa más allá del pueblo, a los que se llega en lancha o a pie por el sendero costero. Por lo general se reservan con comidas y tours incluidos; es la estadía más apartada.",
        },
      },
      {
        name: { en: "Sierpe", es: "Sierpe" },
        text: {
          en: "The river town where the road ends and the boats leave. A handful of simple hotels make it the place to sleep before a morning boat, or after an afternoon one.",
          es: "El pueblo a orillas del río donde termina la carretera y salen las lanchas. Unos pocos hoteles sencillos lo convierten en el lugar para dormir antes de una lancha de la mañana, o después de una de la tarde.",
        },
      },
    ],
    faqs: [
      {
        q: { en: "How do I get to Drake Bay?", es: "¿Cómo se llega a Bahía Drake?" },
        a: {
          en: "Most travellers go by road to Sierpe ({time:SJO>Sierpe} from San José airport) and then by boat, about {boat}. You can also fly from San José to the Drake Bay airstrip, or drive in on a rough 4x4 road that may be impassable in the rainy season.",
          es: "La mayoría va por carretera hasta Sierpe ({time:SJO>Sierpe} desde el aeropuerto de San José) y luego en lancha, unos {boat}. También se puede volar de San José al aeródromo de Bahía Drake, o entrar manejando por un camino difícil para 4x4 que puede quedar intransitable en la época lluviosa.",
        },
      },
      {
        q: { en: "What time do the boats leave Sierpe?", es: "¿A qué hora salen las lanchas de Sierpe?" },
        a: {
          en: "Usually in the late morning and early afternoon; the river mouth is only crossed in daylight. Most Drake Bay lodges book their guests on a boat, so ask your lodge for the exact time and tell us: we plan the pickup so you reach the dock with time to spare.",
          es: "Por lo general al final de la mañana y a primera hora de la tarde; la boca del río solo se cruza con luz de día. La mayoría de los lodges de Bahía Drake reserva la lancha para sus huéspedes: pida la hora exacta a su lodge e indíquenosla, y planeamos la recogida para que llegue al muelle con tiempo de sobra.",
        },
      },
      {
        q: { en: "Is the boat included in the transfer?", es: "¿La lancha está incluida en el traslado?" },
        a: {
          en: "It can be. A ride to the Sierpe dock ends at the dock. If you choose the vehicle option that combines the 4x4 with the Sierpe river boat, the boat to Drake Bay is included: from {price:SJO>DrakeBay} from San José airport.",
          es: "Puede estarlo. Un traslado al muelle de Sierpe termina en el muelle. Si elige la opción de vehículo que combina el 4x4 con la lancha por el río Sierpe, la lancha a Bahía Drake está incluida: desde {price:SJO>DrakeBay} desde el aeropuerto de San José.",
        },
      },
      {
        q: { en: "Do I need a permit for Corcovado?", es: "¿Se necesita permiso para Corcovado?" },
        a: {
          en: "Yes. Corcovado requires a SINAC permit and a certified guide, both booked in advance, and overnight places at Sirena Station are limited, so book your guide early. We drive you to Sierpe or Drake Bay; the guide and the permit are booked separately.",
          es: "Sí. Corcovado exige un permiso del SINAC y un guía certificado, ambos reservados con anticipación, y los espacios para pasar la noche en la Estación Sirena son limitados, así que conviene reservar el guía con tiempo. Nosotros lo llevamos a Sierpe o a Bahía Drake; el guía y el permiso se reservan aparte.",
        },
      },
      {
        q: { en: "Can I get to Drake Bay on the day I land in Costa Rica?", es: "¿Puedo llegar a Bahía Drake el mismo día que aterrizo en Costa Rica?" },
        a: {
          en: "Rarely. With a {time:SJO>Sierpe} drive and boats that leave by early afternoon, most international arrivals need a first night near the airport, on the coast or in Sierpe.",
          es: "Pocas veces. Con {time:SJO>Sierpe} de carretera y lanchas que salen a más tardar a primera hora de la tarde, la mayoría de las llegadas internacionales necesita una primera noche cerca del aeropuerto, en la costa o en Sierpe.",
        },
      },
      {
        q: { en: "How many days do I need in Drake Bay?", es: "¿Cuántos días se necesitan en Bahía Drake?" },
        a: {
          en: "Three nights is a sensible minimum: travel takes most of a day each way, which leaves two full days for Corcovado and Caño Island.",
          es: "Tres noches es un mínimo razonable: el viaje toma buena parte de un día en cada sentido, lo que deja dos días completos para Corcovado y la Isla del Caño.",
        },
      },
      FAQ_PER_VEHICLE,
    ],
  },
];
