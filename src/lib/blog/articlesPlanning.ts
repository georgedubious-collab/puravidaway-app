/**
 * Travel guides for planning a trip (docs/SEO.md §5, items 6 and 8).
 * Rules and tokens: ./types.ts. Every drive time comes from the catalog (ROUTE_MINUTES).
 */
import { FIRST_ISSUE, faq, includedBlock, l, list, note, p } from "./shared";
import type { Article } from "./types";

// ───────────────────────── 6. SJO or LIR ─────────────────────────
const WHICH_AIRPORT: Article = {
  slug: "sjo-or-liberia-which-airport",
  published: FIRST_ISSUE,
  updated: FIRST_ISSUE,
  title: l("SJO or LIR: which Costa Rica airport should you fly into?", "SJO o LIR: ¿a qué aeropuerto de Costa Rica le conviene llegar?"),
  short: l("SJO or LIR: which airport?", "SJO o LIR: ¿qué aeropuerto?"),
  metaDescription: l(
    "San José (SJO) or Liberia (LIR)? The realistic drive time from each airport to Tamarindo, La Fortuna, Monteverde, Manuel Antonio, Puerto Viejo and Osa, flying into one and out of the other, and arriving late.",
    "¿San José (SJO) o Liberia (LIR)? El tiempo de viaje realista desde cada aeropuerto a Tamarindo, La Fortuna, Monteverde, Manuel Antonio, Puerto Viejo y Osa, cómo llegar por uno y salir por el otro, y qué hacer si aterriza tarde.",
  ),
  teaser: l("Choose by where you are going, not by the map", "Elija según a dónde va, no según el mapa"),
  answer: l(
    "Updated {asof}: fly into Liberia (LIR) for the Guanacaste beaches: Tamarindo is about {time:LIR>Tamarindo} from LIR against {time:SJO>Tamarindo} from San José. Fly into San José (SJO) for Manuel Antonio, the Caribbean coast and the Osa Peninsula. For La Fortuna and Monteverde the drive is about the same from both ({time:SJO>Arenal} or {time:LIR>Arenal} to La Fortuna), so choose the better flight.",
    "Actualizado en {asof}: llegue por Liberia (LIR) para las playas de Guanacaste: Tamarindo está a {time:LIR>Tamarindo} de LIR, frente a {time:SJO>Tamarindo} desde San José. Llegue por San José (SJO) para Manuel Antonio, el Caribe y la península de Osa. Para La Fortuna y Monteverde el recorrido es casi igual desde los dos ({time:SJO>Arenal} o {time:LIR>Arenal} a La Fortuna), así que elija el mejor vuelo.",
  ),
  sections: [
    {
      id: "by-destination",
      title: l("The answer, destination by destination", "La respuesta, destino por destino"),
      blocks: [
        p(
          "Costa Rica has two main international airports: Juan Santamaría (SJO), near San José, and Daniel Oduber Quirós (LIR), in Liberia, in the north-west. They are about {time:SJO>LIR} apart by road, so landing at the \"wrong\" one can cost you most of a day. The table shows door-to-door private-car times from each airport to the places most travellers go first.",
          "Costa Rica tiene dos aeropuertos internacionales principales: el Juan Santamaría (SJO), cerca de San José, y el Daniel Oduber Quirós (LIR), en Liberia, en el noroeste. Los separan unas {time:SJO>LIR} por carretera, así que aterrizar en el \"equivocado\" puede costarle buena parte de un día. La tabla muestra los tiempos de puerta a puerta en vehículo privado desde cada aeropuerto hasta los lugares a los que la mayoría de los viajeros va primero.",
        ),
        {
          kind: "table",
          caption: l("Drive time from SJO and LIR to the main destinations", "Tiempo de viaje desde SJO y LIR a los principales destinos"),
          head: [l("Destination", "Destino"), l("From SJO", "Desde SJO"), l("From LIR", "Desde LIR"), l("Better airport", "Aeropuerto que conviene")],
          rows: [
            [l("[Tamarindo and the Guanacaste beaches](/destinations/tamarindo)", "[Tamarindo y las playas de Guanacaste](/destinations/tamarindo)"), l("{time:SJO>Tamarindo}", "{time:SJO>Tamarindo}"), l("{time:LIR>Tamarindo}", "{time:LIR>Tamarindo}"), l("LIR", "LIR")],
            [l("[La Fortuna / Arenal](/destinations/la-fortuna)", "[La Fortuna / Arenal](/destinations/la-fortuna)"), l("{time:SJO>Arenal}", "{time:SJO>Arenal}"), l("{time:LIR>Arenal}", "{time:LIR>Arenal}"), l("Either: choose by flight", "Cualquiera: elija por el vuelo")],
            [l("[Monteverde](/destinations/monteverde)", "[Monteverde](/destinations/monteverde)"), l("{time:SJO>Monteverde}", "{time:SJO>Monteverde}"), l("{time:LIR>Monteverde}", "{time:LIR>Monteverde}"), l("Either: choose by flight", "Cualquiera: elija por el vuelo")],
            [l("[Manuel Antonio](/destinations/manuel-antonio)", "[Manuel Antonio](/destinations/manuel-antonio)"), l("{time:SJO>ManuelAntonio}", "{time:SJO>ManuelAntonio}"), l("{time:LIR>ManuelAntonio}", "{time:LIR>ManuelAntonio}"), l("SJO", "SJO")],
            [l("[Puerto Viejo (Caribbean)](/destinations/puerto-viejo)", "[Puerto Viejo (Caribe)](/destinations/puerto-viejo)"), l("{time:SJO>PuertoViejo}", "{time:SJO>PuertoViejo}"), l("{time:LIR>PuertoViejo}", "{time:LIR>PuertoViejo}"), l("SJO", "SJO")],
            [l("[Sierpe, the boat dock for Drake Bay](/destinations/drake-bay)", "[Sierpe, el muelle de las lanchas a Bahía Drake](/destinations/drake-bay)"), l("{time:SJO>Sierpe}", "{time:SJO>Sierpe}"), l("{time:LIR>Sierpe}", "{time:LIR>Sierpe}"), l("SJO", "SJO")],
          ],
        },
        p(
          "Times are door to door by private car and realistic for Costa Rica's mountain roads; traffic and rain can add to them. Drake Bay is reached by boat from Sierpe, which adds about {boat} after the drive.",
          "Los tiempos son de puerta a puerta en vehículo privado y realistas para las carreteras de montaña de Costa Rica; el tráfico y la lluvia pueden sumar. A Bahía Drake se llega en lancha desde Sierpe, lo que suma unos {boat} después del recorrido por carretera.",
        ),
      ],
    },
    {
      id: "the-airports",
      title: l("The two airports in brief", "Los dos aeropuertos en breve"),
      blocks: [
        p(
          "**San José (SJO), Juan Santamaría.** Costa Rica's main airport, and despite its name not in the capital: it is in Alajuela, roughly 17 to 20 km northwest of downtown San José, right beside the highways to the Pacific, the northern volcanoes and the Caribbean. Domestic flights on small planes leave from a separate small terminal next to the international one. Our [San José airport guide](/airports/sjo) covers arrivals, taxis, buses and practical tips.",
          "**San José (SJO), Juan Santamaría.** El principal aeropuerto de Costa Rica y, a pesar de su nombre, no está en la capital: está en Alajuela, a unos 17 a 20 km al noroeste del centro de San José, junto a las carreteras hacia el Pacífico, los volcanes del norte y el Caribe. Los vuelos nacionales en avioneta salen de una terminal pequeña aparte, junto a la internacional. Nuestra [guía del aeropuerto de San José](/airports/sjo) explica la llegada, los taxis, los buses y consejos prácticos.",
        ),
        p(
          "**Liberia (LIR), Daniel Oduber Quirós.** Also known as Guanacaste Airport: a small, single-terminal airport a short drive west of the city of Liberia, and the closest international airport to Tamarindo, Flamingo, the Papagayo Gulf and the rest of the Guanacaste coast. The terminal is easy to get out of, but lines are longest when several flights land close together, most often on weekends from December to April. See the [Liberia airport guide](/airports/lir).",
          "**Liberia (LIR), Daniel Oduber Quirós.** También conocido como Aeropuerto de Guanacaste: un aeropuerto pequeño, de una sola terminal, a poca distancia al oeste de la ciudad de Liberia, y el aeropuerto internacional más cercano a Tamarindo, Flamingo, el golfo de Papagayo y el resto de la costa de Guanacaste. Es fácil salir de la terminal, pero las filas son más largas cuando aterrizan varios vuelos seguidos, sobre todo los fines de semana de diciembre a abril. Vea la [guía del aeropuerto de Liberia](/airports/lir).",
        ),
        p(
          "Which airport has the better flight for you depends on where you fly from, the season and the airline, and routes change every year. Compare both before you book: a cheaper ticket to the far airport can cost more once you add the extra ride.",
          "Cuál aeropuerto tiene el mejor vuelo para usted depende de dónde sale, de la temporada y de la aerolínea, y las rutas cambian cada año. Compare los dos antes de comprar: un boleto más barato al aeropuerto lejano puede salir más caro cuando suma el traslado adicional.",
        ),
      ],
    },
    {
      id: "open-jaw",
      title: l("Fly into one and out of the other", "Llegar por uno y salir por el otro"),
      blocks: [
        p(
          "If your trip crosses the country, you don't have to choose: many airlines sell a multi-city ticket that lands at one airport and leaves from the other. A classic route starts on the Guanacaste beaches and ends on the Central Pacific, so you never drive back the way you came:",
          "Si su viaje cruza el país, no tiene que elegir: muchas aerolíneas venden un boleto de varias ciudades que llega a un aeropuerto y sale del otro. Una ruta clásica empieza en las playas de Guanacaste y termina en el Pacífico Central, para no devolverse nunca por el mismo camino:",
        ),
        {
          kind: "rides",
          caption: l("Example route from Liberia to San José: each leg's drive time and price", "Ejemplo de ruta de Liberia a San José: tiempo y precio de cada tramo"),
          rows: [
            { origin: "LIR", destination: "Tamarindo" },
            { origin: "Tamarindo", destination: "Arenal" },
            { origin: "Arenal", destination: "Monteverde" },
            { origin: "Monteverde", destination: "ManuelAntonio" },
            { origin: "ManuelAntonio", destination: "SJO" },
          ],
        },
        p(
          "Each leg is a separate private ride you can book in the [trip builder](/?tab=transfers), with stops on the way where they fit. Check whether a multi-city ticket costs more than a simple return before you decide.",
          "Cada tramo es un traslado privado aparte que puede reservar en el [planificador de viajes](/?tab=transfers), con paradas en el camino donde calzan. Revise si el boleto de varias ciudades cuesta más que uno de ida y vuelta antes de decidir.",
        ),
      ],
    },
    {
      id: "late-arrivals",
      title: l("Landing late", "Si aterriza tarde"),
      blocks: [
        p(
          "Night falls around 6 pm all year, and mountain roads are slower and foggier in the dark. If you land in the evening and your first stop is three hours or more away, many travellers sleep near the airport and leave in the morning; that is more often true at SJO, where most destinations are over a mountain range. From LIR the drive to the Guanacaste beaches is short and flat, which makes late arrivals easier.",
          "Anochece hacia las 6 p. m. todo el año, y las carreteras de montaña son más lentas y con más neblina en la oscuridad. Si aterriza al final de la tarde y su primer destino queda a tres horas o más, muchos viajeros duermen cerca del aeropuerto y salen por la mañana; eso pasa más en SJO, donde casi todos los destinos quedan al otro lado de una cordillera. Desde LIR el recorrido a las playas de Guanacaste es corto y plano, lo que facilita las llegadas tarde.",
        ),
        note("{night} The price you see when you choose your pickup time already includes it.", "{night} El precio que ve al elegir su hora de recogida ya lo incluye."),
      ],
    },
    {
      id: "leaving",
      title: l("Leaving the airport", "Salir del aeropuerto"),
      blocks: [
        list(
          [
            "Taxis: official airport taxis wait outside arrivals at both airports (orange at SJO). Ask the fare before a long trip.",
            "Taxis: los taxis oficiales del aeropuerto esperan a la salida de llegadas en los dos aeropuertos (anaranjados en SJO). Pregunte la tarifa antes de un viaje largo.",
          ],
          [
            "Ride-hailing apps work in the Central Valley, but terminal pickup rules at SJO have changed more than once, and at LIR there are few drivers: a backup, not a plan.",
            "Las aplicaciones de transporte funcionan en el Valle Central, pero las reglas para recoger en la terminal de SJO han cambiado más de una vez, y en LIR hay pocos conductores: un respaldo, no un plan.",
          ],
          [
            "Buses: long-distance buses do not leave from either terminal; they leave from San José's city terminals and from the town of Liberia.",
            "Buses: los buses de larga distancia no salen de ninguna de las dos terminales; salen de las terminales de San José y de la ciudad de Liberia.",
          ],
          [
            "Shared shuttles run at fixed times and must be booked ahead; if you land after the last departure, you wait until the next day.",
            "Los shuttles compartidos salen en horarios fijos y se reservan con anticipación; si aterriza después de la última salida, espera al día siguiente.",
          ],
        ),
        includedBlock(true),
      ],
    },
  ],
  faqs: [
    faq(
      "Which airport is closer to Tamarindo?",
      "¿Qué aeropuerto queda más cerca de Tamarindo?",
      "Liberia (LIR): about {time:LIR>Tamarindo} by road, against {time:SJO>Tamarindo} from San José (SJO).",
      "Liberia (LIR): unas {time:LIR>Tamarindo} por carretera, frente a {time:SJO>Tamarindo} desde San José (SJO).",
    ),
    faq(
      "Which airport is better for La Fortuna and Arenal?",
      "¿Qué aeropuerto conviene para La Fortuna y el Arenal?",
      "Either. The drive is about {time:SJO>Arenal} from SJO and {time:LIR>Arenal} from LIR, so pick the airport with the better flight or the one that suits the rest of your route.",
      "Cualquiera. El recorrido es de unas {time:SJO>Arenal} desde SJO y {time:LIR>Arenal} desde LIR, así que elija el aeropuerto con el mejor vuelo o el que más convenga al resto de su ruta.",
    ),
    faq(
      "Which airport is better for Manuel Antonio?",
      "¿Qué aeropuerto conviene para Manuel Antonio?",
      "San José (SJO): about {time:SJO>ManuelAntonio} on highways, against {time:LIR>ManuelAntonio} from Liberia.",
      "San José (SJO): unas {time:SJO>ManuelAntonio} por autopista, frente a {time:LIR>ManuelAntonio} desde Liberia.",
    ),
    faq(
      "How far apart are the two airports?",
      "¿Qué tan lejos están los dos aeropuertos entre sí?",
      "About {time:SJO>LIR} by road. That is why a multi-city ticket, landing at one and leaving from the other, often makes sense for trips that cross the country.",
      "Unas {time:SJO>LIR} por carretera. Por eso un boleto de varias ciudades, que llega a uno y sale del otro, suele tener sentido en viajes que cruzan el país.",
    ),
    faq(
      "Is SJO airport in San José?",
      "¿El aeropuerto SJO está en San José?",
      "No. Juan Santamaría International Airport is in Alajuela, roughly 17 to 20 km northwest of downtown San José.",
      "No. El Aeropuerto Internacional Juan Santamaría está en Alajuela, a unos 17 a 20 km al noroeste del centro de San José.",
    ),
    faq(
      "Which airport is better for Drake Bay and Corcovado?",
      "¿Qué aeropuerto conviene para Bahía Drake y Corcovado?",
      "San José (SJO). The road to the Sierpe boat dock takes about {time:SJO>Sierpe} from SJO, against {time:LIR>Sierpe} from Liberia, and the boat to Drake Bay adds about {boat}. Visits to Corcovado National Park need permits booked in advance and a registered guide.",
      "San José (SJO). El recorrido hasta el muelle de Sierpe toma unas {time:SJO>Sierpe} desde SJO, frente a {time:LIR>Sierpe} desde Liberia, y la lancha a Bahía Drake suma unos {boat}. Las visitas al Parque Nacional Corcovado requieren permisos reservados con anticipación y un guía registrado.",
    ),
    faq(
      "We land late at night. Can a driver still pick us up?",
      "Aterrizamos tarde en la noche. ¿Nos puede recoger un conductor igual?",
      "Yes. {night} We follow your flight, and your driver waits up to 60 minutes after it actually lands.",
      "Sí. {night} Damos seguimiento a su vuelo, y su conductor espera hasta 60 minutos después del aterrizaje real.",
    ),
  ],
  book: { origin: "LIR", destination: "Tamarindo" },
  about: { hubPairs: [], hubs: ["SJO", "LIR"] },
  related: ["/airports", "/airports/sjo", "/airports/lir", "/destinations", "/transfers"],
};

// ───────────────────────── 8. Drive times ─────────────────────────
const DRIVE_TIMES: Article = {
  slug: "costa-rica-drive-times",
  published: FIRST_ISSUE,
  updated: FIRST_ISSUE,
  photo: "route-27-highway",
  title: l("Costa Rica drive times: a table between all the main destinations", "Tiempos de viaje en Costa Rica: tabla entre los principales destinos"),
  short: l("Costa Rica drive-times table", "Tabla de tiempos de viaje en Costa Rica"),
  metaDescription: l(
    "Realistic door-to-door drive times between San José and Liberia airports, La Fortuna, Monteverde, Manuel Antonio, Tamarindo, Puerto Viejo, Sierpe and Drake Bay, why distance misleads, and what slows Costa Rica's roads down.",
    "Tiempos de viaje realistas de puerta a puerta entre los aeropuertos de San José y Liberia, La Fortuna, Monteverde, Manuel Antonio, Tamarindo, Puerto Viejo, Sierpe y Bahía Drake, por qué la distancia engaña y qué vuelve lentas las carreteras de Costa Rica.",
  ),
  teaser: l("Every main ride in one table, mountain roads included", "Todos los recorridos principales en una tabla, con las carreteras de montaña"),
  answer: l(
    "Updated {asof}: from San José airport (SJO), La Fortuna is about {time:SJO>Arenal} by road, Manuel Antonio {time:SJO>ManuelAntonio}, Monteverde {time:SJO>Monteverde}, Puerto Viejo {time:SJO>PuertoViejo} and Tamarindo {time:SJO>Tamarindo}; Tamarindo is {time:LIR>Tamarindo} from Liberia airport (LIR). These are door-to-door private-car times for real mountain roads, not straight-line estimates. The full table is below.",
    "Actualizado en {asof}: desde el aeropuerto de San José (SJO), La Fortuna está a unas {time:SJO>Arenal} por carretera, Manuel Antonio a {time:SJO>ManuelAntonio}, Monteverde a {time:SJO>Monteverde}, Puerto Viejo a {time:SJO>PuertoViejo} y Tamarindo a {time:SJO>Tamarindo}; Tamarindo está a {time:LIR>Tamarindo} del aeropuerto de Liberia (LIR). Son tiempos de puerta a puerta en vehículo privado, para carreteras de montaña reales, no estimaciones en línea recta. La tabla completa está abajo.",
  ),
  sections: [
    {
      id: "table",
      title: l("The drive-times table", "La tabla de tiempos de viaje"),
      blocks: [
        p(
          "Read across from where you start to where you are going. These are the same times our trip builder and drivers plan with: door to door, by private car, at a safe pace on Costa Rica's roads.",
          "Busque la fila de donde sale y la columna de a donde va. Son los mismos tiempos con los que planifican nuestro planificador de viajes y nuestros conductores: de puerta a puerta, en vehículo privado, a un ritmo seguro por las carreteras de Costa Rica.",
        ),
        { kind: "matrix", hubs: ["SJO", "LIR", "Arenal", "Monteverde", "ManuelAntonio", "Tamarindo", "PuertoViejo", "Sierpe", "DrakeBay"] },
        p(
          "Drake Bay times include the river boat from Sierpe, about {boat}; the road ends at the Sierpe dock. Traffic, heavy rain and road works can add to any of these times.",
          "Los tiempos a Bahía Drake incluyen la lancha por el río desde Sierpe, de unos {boat}; la carretera termina en el muelle de Sierpe. El tráfico, las lluvias fuertes y los trabajos en la vía pueden sumar tiempo a cualquiera de estos recorridos.",
        ),
      ],
    },
    {
      id: "distance",
      title: l("Why kilometres don't tell you the time", "Por qué los kilómetros no dicen el tiempo"),
      blocks: [
        p(
          "Costa Rica is small, but its roads cross mountain ranges, single-lane bridges and towns, so the same distance can take very different times. Three examples from the table:",
          "Costa Rica es pequeña, pero sus carreteras cruzan cordilleras, puentes de un carril y pueblos, así que la misma distancia puede tomar tiempos muy distintos. Tres ejemplos de la tabla:",
        ),
        list(
          [
            "Liberia airport to Tamarindo: {km:LIR>Tamarindo} km of flat road, about {time:LIR>Tamarindo}.",
            "Aeropuerto de Liberia a Tamarindo: {km:LIR>Tamarindo} km de carretera plana, unas {time:LIR>Tamarindo}.",
          ],
          [
            "San José airport to Monteverde: {km:SJO>Monteverde} km, but about {time:SJO>Monteverde}, because the last stretch is a steep, winding climb.",
            "Aeropuerto de San José a Monteverde: {km:SJO>Monteverde} km, pero unas {time:SJO>Monteverde}, porque el último tramo es una subida empinada y con curvas.",
          ],
          [
            "La Fortuna to Monteverde: only {km:Arenal>Monteverde} km, yet about {time:Arenal>Monteverde}, because there is no direct road: you drive around Lake Arenal.",
            "La Fortuna a Monteverde: apenas {km:Arenal>Monteverde} km, y sin embargo unas {time:Arenal>Monteverde}, porque no hay carretera directa: se bordea el lago Arenal.",
          ],
        ),
        p(
          "Navigation apps give the driving time at the moment you look. Ours are door to door, from hotel to hotel, and allow for a careful pace on mountain roads, so they can be a little longer.",
          "Las aplicaciones de navegación dan el tiempo de manejo en el momento en que se consultan. Los nuestros son de puerta a puerta, de hotel a hotel, y consideran un ritmo prudente en las carreteras de montaña, así que pueden ser un poco más largos.",
        ),
      ],
    },
    {
      id: "slowdowns",
      title: l("What slows the roads down", "Qué vuelve lentas las carreteras"),
      blocks: [
        list(
          [
            "Mountain stretches: the climbs to Monteverde and over the hills to La Fortuna are winding and often misty.",
            "Los tramos de montaña: las subidas a Monteverde y por los cerros hacia La Fortuna tienen muchas curvas y a menudo neblina.",
          ],
          [
            "Weekend traffic: Route 27 between San José and the Pacific fills up on Friday afternoons, Sunday evenings and holidays, which can add an hour.",
            "El tráfico de fin de semana: la Ruta 27 entre San José y el Pacífico se llena los viernes por la tarde, los domingos al final del día y en feriados, lo que puede sumar una hora.",
          ],
          [
            "Route 32 to the Caribbean: steep, foggy and busy with container trucks; after very heavy rain, landslides can close it, and drivers take the longer road through Turrialba.",
            "La Ruta 32 hacia el Caribe: empinada, con neblina y mucho tránsito de camiones de contenedores; después de lluvias muy fuertes, los derrumbes pueden cerrarla, y los conductores toman la carretera más larga por Turrialba.",
          ],
          [
            "Afternoon rain: from May to November rain usually arrives after midday, so morning departures tend to be smoother.",
            "La lluvia de la tarde: de mayo a noviembre la lluvia llega por lo general después del mediodía, así que las salidas por la mañana suelen ser más tranquilas.",
          ],
          [
            "Darkness: night falls around 6 pm all year, and narrow, poorly lit roads are slower at night.",
            "La oscuridad: anochece hacia las 6 p. m. todo el año, y las carreteras angostas y con poca iluminación son más lentas de noche.",
          ],
        ),
      ],
    },
    {
      id: "classic-legs",
      title: l("The classic legs, with prices", "Los tramos clásicos, con precios"),
      blocks: [
        p(
          "Most first trips string together some of these rides. Each links to its route page, with prices by vehicle, the road and the stops on offer.",
          "La mayoría de los primeros viajes combinan algunos de estos traslados. Cada uno lleva a su página de ruta, con precios por vehículo, la carretera y las paradas disponibles.",
        ),
        {
          kind: "rides",
          caption: l("Classic Costa Rica rides: drive times and private transfer prices", "Traslados clásicos en Costa Rica: tiempos y precios de traslado privado"),
          rows: [
            { origin: "SJO", destination: "Arenal" },
            { origin: "Arenal", destination: "Monteverde" },
            { origin: "Monteverde", destination: "ManuelAntonio" },
            { origin: "Arenal", destination: "ManuelAntonio" },
            { origin: "Arenal", destination: "Tamarindo" },
            { origin: "LIR", destination: "Tamarindo" },
            { origin: "ManuelAntonio", destination: "Sierpe" },
            { origin: "SJO", destination: "PuertoViejo" },
          ],
        },
      ],
    },
    {
      id: "region-by-region",
      title: l("Region by region: what each drive is like", "Región por región: cómo es cada recorrido"),
      blocks: [
        p(
          "**Central Valley to the Pacific.** The easiest long drives in the country. Route 27 runs from the San José area to the coast, and the coastal highway continues south to Manuel Antonio, about {time:SJO>ManuelAntonio} from the airport, and on toward Sierpe, about {time:ManuelAntonio>Sierpe} further. See [how to get from San José to Manuel Antonio](/guides/san-jose-to-manuel-antonio).",
          "**Del Valle Central al Pacífico.** Los recorridos largos más sencillos del país. La Ruta 27 va de los alrededores de San José a la costa, y la Costanera sigue al sur hasta Manuel Antonio, a unas {time:SJO>ManuelAntonio} del aeropuerto, y más allá hacia Sierpe, a unas {time:ManuelAntonio>Sierpe} más. Vea [cómo ir de San José a Manuel Antonio](/guides/san-jose-to-manuel-antonio).",
        ),
        p(
          "**The northern volcanoes and the cloud forest.** La Fortuna is over the mountains north of the Central Valley, about {time:SJO>Arenal} from San José airport and {time:LIR>Arenal} from Liberia. Monteverde sits at the top of a steep climb, about {time:SJO>Monteverde} from San José. Between the two you drive around Lake Arenal, about {time:Arenal>Monteverde}. See [San José to La Fortuna](/guides/san-jose-to-la-fortuna) and [San José to Monteverde](/guides/san-jose-to-monteverde).",
          "**Los volcanes del norte y el bosque nuboso.** La Fortuna está al otro lado de las montañas al norte del Valle Central, a unas {time:SJO>Arenal} del aeropuerto de San José y {time:LIR>Arenal} del de Liberia. Monteverde queda al final de una subida empinada, a unas {time:SJO>Monteverde} de San José. Entre los dos se bordea el lago Arenal, unas {time:Arenal>Monteverde}. Vea [de San José a La Fortuna](/guides/san-jose-to-la-fortuna) y [de San José a Monteverde](/guides/san-jose-to-monteverde).",
        ),
        p(
          "**Guanacaste.** Flat, dry and quick from Liberia airport: Tamarindo is about {time:LIR>Tamarindo} away. From San José the same beaches are a long day across the country, about {time:SJO>Tamarindo}. See [Liberia airport to Tamarindo](/guides/liberia-airport-to-tamarindo).",
          "**Guanacaste.** Plano, seco y rápido desde el aeropuerto de Liberia: Tamarindo queda a unas {time:LIR>Tamarindo}. Desde San José, las mismas playas son un día largo cruzando el país, unas {time:SJO>Tamarindo}. Vea [del aeropuerto de Liberia a Tamarindo](/guides/liberia-airport-to-tamarindo).",
        ),
        p(
          "**The Caribbean.** Puerto Viejo is about {time:SJO>PuertoViejo} from San José airport on Route 32, through Braulio Carrillo National Park and the port city of Limón. From Liberia it is about {time:LIR>PuertoViejo}, so fly into San José for the Caribbean. More in the [Puerto Viejo destination guide](/destinations/puerto-viejo).",
          "**El Caribe.** Puerto Viejo está a unas {time:SJO>PuertoViejo} del aeropuerto de San José por la Ruta 32, cruzando el Parque Nacional Braulio Carrillo y la ciudad portuaria de Limón. Desde Liberia son unas {time:LIR>PuertoViejo}, así que para el Caribe conviene llegar por San José. Más en la [guía de destino de Puerto Viejo](/destinations/puerto-viejo).",
        ),
        p(
          "**The Osa Peninsula.** Most travellers reach Drake Bay by boat: the drive ends at the river town of Sierpe, about {time:SJO>Sierpe} from San José airport, and a river boat does the rest (a rough 4x4 road and small planes are the other ways in). Corcovado National Park needs permits booked in advance and a registered guide. More in the [Drake Bay and Sierpe guide](/destinations/drake-bay).",
          "**La península de Osa.** La mayoría de los viajeros llega a Bahía Drake en lancha: el recorrido por carretera termina en Sierpe, un pueblo a orillas del río, a unas {time:SJO>Sierpe} del aeropuerto de San José, y una lancha hace el resto (un camino difícil para 4x4 y las avionetas son las otras formas de llegar). El Parque Nacional Corcovado requiere permisos reservados con anticipación y un guía registrado. Más en la [guía de Bahía Drake y Sierpe](/destinations/drake-bay).",
        ),
      ],
    },
    {
      id: "planning",
      title: l("Planning tips", "Consejos para planificar"),
      blocks: [
        list(
          [
            "Give long rides their own day, and start in the morning. A ride of four or five hours fills most of a day once you add check-out, a meal and a stop.",
            "Dele a los traslados largos su propio día, y salga por la mañana. Un recorrido de cuatro o cinco horas ocupa casi todo el día cuando suma la salida del hotel, una comida y una parada.",
          ],
          [
            "Don't plan a long ride on the day of an international flight. Airlines generally ask international passengers to be at the airport about three hours before departure; count back from there and leave a margin.",
            "No planifique un traslado largo el día de un vuelo internacional. Las aerolíneas por lo general piden a los pasajeros internacionales estar en el aeropuerto unas tres horas antes de la salida; cuente hacia atrás desde ahí y deje un margen.",
          ],
          [
            "Make the drive part of the trip: on a private transfer you can add stops that fit the road, such as Poás Volcano (timed-entry tickets booked in advance), the Tárcoles crocodile bridge or Río Celeste. The trip builder shows which stops each ride offers.",
            "Haga del recorrido parte del viaje: en un traslado privado puede agregar paradas que calzan con la carretera, como el volcán Poás (entradas con horario reservadas con anticipación), el puente de los cocodrilos de Tárcoles o Río Celeste. El planificador de viajes muestra qué paradas ofrece cada traslado.",
          ],
          [
            "Very long crossings, such as the Guanacaste beaches to the Caribbean, are often better split in two with a night on the way.",
            "Los cruces muy largos, como de las playas de Guanacaste al Caribe, muchas veces conviene dividirlos en dos con una noche en el camino.",
          ],
        ),
        p(
          "Choosing an airport? Our [SJO or LIR guide](/guides/sjo-or-liberia-which-airport) compares them destination by destination, and the [destination guides](/destinations) cover each place in detail.",
          "¿Está eligiendo aeropuerto? Nuestra [guía SJO o LIR](/guides/sjo-or-liberia-which-airport) los compara destino por destino, y las [guías de destinos](/destinations) explican cada lugar en detalle.",
        ),
      ],
    },
  ],
  faqs: [
    faq(
      "How long is the drive from San José to La Fortuna?",
      "¿Cuánto dura el viaje de San José a La Fortuna?",
      "About {time:SJO>Arenal} door to door from San José airport, over the mountains north of the Central Valley.",
      "Unas {time:SJO>Arenal} de puerta a puerta desde el aeropuerto de San José, cruzando las montañas al norte del Valle Central.",
    ),
    faq(
      "How long is the drive from La Fortuna to Monteverde?",
      "¿Cuánto dura el viaje de La Fortuna a Monteverde?",
      "About {time:Arenal>Monteverde} around Lake Arenal, although the two are only {km:Arenal>Monteverde} km apart. The alternative is the jeep-boat-jeep, which crosses the lake by boat and changes vehicles twice.",
      "Unas {time:Arenal>Monteverde} bordeando el lago Arenal, aunque los separan apenas {km:Arenal>Monteverde} km. La alternativa es el jeep-boat-jeep, que cruza el lago en lancha y cambia de vehículo dos veces.",
    ),
    faq(
      "How long does it take to get to Drake Bay?",
      "¿Cuánto se tarda en llegar a Bahía Drake?",
      "From San José airport, about {time:SJO>Sierpe} by road to the Sierpe dock and about {boat} by river boat, so about {time:SJO>DrakeBay} in all. Confirm the boat time with your lodge.",
      "Desde el aeropuerto de San José, unas {time:SJO>Sierpe} por carretera hasta el muelle de Sierpe y unos {boat} en lancha por el río, en total unas {time:SJO>DrakeBay}. Confirme la hora de la lancha con su lodge.",
    ),
    faq(
      "Are these times longer in the rainy season?",
      "¿Estos tiempos son más largos en la época lluviosa?",
      "They can be. Afternoon rain slows mountain roads, and very heavy rain can close Route 32 to the Caribbean for landslides. Morning departures are usually the smoothest.",
      "Pueden serlo. La lluvia de la tarde vuelve más lentas las carreteras de montaña, y las lluvias muy fuertes pueden cerrar la Ruta 32 hacia el Caribe por derrumbes. Las salidas por la mañana suelen ser las más tranquilas.",
    ),
    faq(
      "Is it safe to drive at night in Costa Rica?",
      "¿Es seguro manejar de noche en Costa Rica?",
      "Many roads are narrow, poorly lit and shared with trucks, cyclists and people on foot, so long drives are best done in daylight. If you need a ride at night, a local driver who knows the road is the easier option. {night}",
      "Muchas carreteras son angostas, con poca iluminación, y las comparten camiones, ciclistas y peatones, así que los recorridos largos conviene hacerlos con luz de día. Si necesita un traslado de noche, un conductor local que conoce la carretera es la opción más sencilla. {night}",
    ),
    faq(
      "What is the longest common ride in Costa Rica?",
      "¿Cuál es el traslado común más largo de Costa Rica?",
      "Crossing from the Guanacaste beaches to the Caribbean or to the Osa Peninsula: Tamarindo to Puerto Viejo is about {time:Tamarindo>PuertoViejo}. Most travellers split rides like that with a night on the way.",
      "Cruzar de las playas de Guanacaste al Caribe o a la península de Osa: de Tamarindo a Puerto Viejo son unas {time:Tamarindo>PuertoViejo}. La mayoría divide traslados así con una noche en el camino.",
    ),
  ],
  book: { origin: "SJO", destination: "Arenal" },
  about: { hubPairs: [], hubs: ["Arenal", "ManuelAntonio", "Monteverde", "Tamarindo", "PuertoViejo", "Sierpe", "DrakeBay"] },
  related: ["/transfers", "/destinations", "/airports", "/guides/sjo-or-liberia-which-airport"],
};

export const ARTICLES_PLANNING: Article[] = [WHICH_AIRPORT, DRIVE_TIMES];
