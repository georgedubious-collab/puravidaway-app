/**
 * Corridors that start at an airport (San José SJO or Liberia LIR). Rules: ./types.ts.
 * Bus, shuttle and flight notes are general on purpose: no timetables, fares or terminals.
 */
import { ROUTES_UPDATED as updated, l, q, way } from "./make";
import type { Corridor } from "./types";

const MEET = "Your driver meets you at arrivals with a sign with your name";
const MEET_ES = "Su conductor lo recibe en la salida de llegadas con un rótulo con su nombre";

export const AIRPORT_CORRIDORS: Corridor[] = [
  // ───────── SJO ↔ Manuel Antonio ─────────
  {
    a: "SJO",
    b: "ManuelAntonio",
    updated,
    hook: l("optional crocodile bridge and macaw stops", "paradas opcionales en el puente de los cocodrilos y para ver lapas"),
    road: l(
      "Between San José and Manuel Antonio the road is highway all the way: Route 27 links the Central Valley with the Pacific at Orotina, and the Costanera Sur follows the coast past Jacó and the oil-palm plantations around Parrita to Quepos. The last stretch is the hill road between Quepos and Manuel Antonio's hotels. Weekend and holiday traffic on Route 27 can add an hour.",
      "Entre San José y Manuel Antonio todo el recorrido es por carretera principal: la Ruta 27 une el Valle Central con el Pacífico en Orotina, y la Costanera Sur sigue la costa, pasando por Jacó y las plantaciones de palma aceitera de los alrededores de Parrita, hasta Quepos. El último tramo es la carretera de la colina entre Quepos y los hoteles de Manuel Antonio. El tráfico de fines de semana y feriados en la Ruta 27 puede sumar una hora.",
    ),
    ways: [
      way(
        "bus",
        "Public buses run between downtown San José and Quepos / Manuel Antonio, some of them direct. They are cheap and comfortable enough, but use a terminal in the city, not the airport.",
        "Hay buses públicos entre el centro de San José y Quepos / Manuel Antonio, algunos directos. Son baratos y razonablemente cómodos, pero usan una terminal en la ciudad, no el aeropuerto.",
      ),
      way(
        "shuttle",
        "Shared shuttles run this route at fixed times and call at several hotels. For one or two travellers they cost less than a private car; for three or more, compare the total with the per-vehicle price.",
        "Los shuttles compartidos hacen esta ruta en horarios fijos y pasan por varios hoteles. Para una o dos personas cuestan menos que un vehículo privado; para tres o más, compare el total con el precio por vehículo.",
      ),
      way(
        "flight",
        "Domestic flights connect San José with the Quepos airstrip, a short ride from the hotels. Planes are small and luggage limits are strict.",
        "Hay vuelos nacionales entre San José y el aeródromo de Quepos, a pocos minutos de los hoteles. Los aviones son pequeños y los límites de equipaje son estrictos.",
      ),
      way(
        "car",
        "The drive is on good paved highways. Around Manuel Antonio itself a car is little use: the hill road is narrow, parking near the park is scarce and the local bus is frequent.",
        "El recorrido es por buenas carreteras pavimentadas. En Manuel Antonio mismo un vehículo sirve de poco: la carretera de la colina es angosta, hay poco parqueo cerca del parque y el bus local pasa con frecuencia.",
      ),
    ],
    faqs: [
      q(
        "Private transfer or shared shuttle between San José and Manuel Antonio?",
        "¿Traslado privado o shuttle compartido entre San José y Manuel Antonio?",
        "Shared shuttles run fixed times and stop at other hotels. A private ride leaves when you are ready, carries only your group and stops only where you want.",
        "Los shuttles compartidos tienen horarios fijos y paran en otros hoteles. Un traslado privado sale cuando usted está listo, lleva solo a su grupo y se detiene únicamente donde usted quiere.",
      ),
      q(
        "Which stops fit on this road?",
        "¿Qué paradas calzan en esta carretera?",
        "The Tárcoles crocodile bridge and the Carara scarlet macaw walk are both right on the coastal highway near Jacó, so they add very little driving. Your luggage stays locked in the vehicle and your driver waits with it.",
        "El puente de los cocodrilos de Tárcoles y la caminata de las lapas rojas en Carara están sobre la Costanera, cerca de Jacó, así que casi no suman recorrido. Su equipaje queda bajo llave en el vehículo y su conductor permanece con él.",
      ),
      q(
        "How do we pay?",
        "¿Cómo se paga?",
        "Two ways. Pay online in full: once our team confirms your ride, we send you a secure payment link. Or pay your driver in cash on the day, plus a {cashFee} cash booking fee shown in your trip total.",
        "De dos maneras. Pague en línea el total: una vez que nuestro equipo confirma su traslado, le enviamos un enlace de pago seguro. O pague a su conductor en efectivo el día del viaje, más un cargo por reserva en efectivo de {cashFee} que aparece en el total de su viaje.",
      ),
    ],
    ab: {
      lead: l(
        `${MEET} and takes you straight to your hotel door. Turn the drive into part of the trip with a stop at the Tárcoles crocodile bridge or a macaw walk in Carara.`,
        `${MEET_ES} y lo lleva directo a la puerta de su hotel. Convierta el recorrido en parte del viaje con una parada en el puente de los cocodrilos de Tárcoles o una caminata para ver lapas en Carara.`,
      ),
      faq: q(
        "We land in the afternoon. Can we still reach Manuel Antonio the same day?",
        "Aterrizamos por la tarde. ¿Podemos llegar a Manuel Antonio el mismo día?",
        "Yes. The drive is about {time:SJO>ManuelAntonio} on highways all the way, so an afternoon landing simply means arriving in the evening. {night}",
        "Sí. El recorrido toma aproximadamente {time:SJO>ManuelAntonio}, todo por carretera principal, así que un aterrizaje por la tarde solo significa llegar al anochecer. {night}",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up at your hotel on the hill or in Quepos and takes you back up to the Central Valley, to the airport terminal or to your hotel in San José.",
        "Su conductor lo recoge en su hotel de la colina o en Quepos y lo lleva de regreso al Valle Central, hasta la terminal del aeropuerto o hasta su hotel en San José.",
      ),
      faq: q(
        "Can we spend the morning in the national park and leave after lunch?",
        "¿Podemos pasar la mañana en el parque nacional y salir después de almuerzo?",
        "Yes, if your flight is late that night or the next day: the ride takes about {time:ManuelAntonio>SJO} and traffic near San José is slow in the late afternoon. For an international flight the same afternoon, leave in the morning instead.",
        "Sí, si su vuelo sale tarde esa noche o al día siguiente: el traslado toma aproximadamente {time:ManuelAntonio>SJO} y el tráfico cerca de San José es lento al final de la tarde. Para un vuelo internacional esa misma tarde, salga mejor por la mañana.",
      ),
    },
  },

  // ───────── SJO ↔ La Fortuna / Arenal ─────────
  {
    a: "SJO",
    b: "Arenal",
    legacySlug: "sjo-airport-to-la-fortuna-arenal",
    updated,
    hook: l("optional Poás Volcano and coffee stop", "parada opcional en el volcán Poás y café"),
    road: l(
      "The road between San José and La Fortuna crosses the mountains north of the Central Valley. Route 1 passes coffee towns like Grecia and Naranjo, and from there drivers go over the hills either through Ciudad Quesada or via San Ramón and La Tigra, down to the green San Carlos plains at the foot of Arenal Volcano. The mountain stretch is winding and often misty, and afternoon rain is common, so drivers keep a steady, careful pace.",
      "La carretera entre San José y La Fortuna cruza las montañas al norte del Valle Central. La Ruta 1 pasa por pueblos cafetaleros como Grecia y Naranjo, y desde allí los conductores cruzan la montaña por Ciudad Quesada o por San Ramón y La Tigra, hasta las verdes llanuras de San Carlos, al pie del volcán Arenal. El tramo de montaña tiene muchas curvas y a menudo neblina, y la lluvia por la tarde es frecuente, por lo que los conductores mantienen un ritmo constante y prudente.",
    ),
    ways: [
      way(
        "bus",
        "Public buses link downtown San José and La Fortuna, some direct and others with a change in Ciudad Quesada. They are the cheapest option and the slowest, and they use a bus terminal in the city, not the airport.",
        "Hay buses públicos entre el centro de San José y La Fortuna, algunos directos y otros con cambio en Ciudad Quesada. Son la opción más barata y la más lenta, y usan una terminal en la ciudad, no el aeropuerto.",
      ),
      way(
        "shuttle",
        "Shared shuttles run this route at fixed times, usually once or twice a day, picking up and dropping off at several hotels. For three or more travellers, compare the total with the per-vehicle price of a private transfer.",
        "Los shuttles compartidos hacen esta ruta en horarios fijos, normalmente una o dos veces al día, y recogen y dejan viajeros en varios hoteles. Para tres o más personas, compare el total con el precio por vehículo de un traslado privado.",
      ),
      way(
        "flight",
        "A small airfield near La Fortuna has had scheduled domestic flights from San José, on small planes with strict luggage limits. You still need a short ride between the airfield and your hotel.",
        "Un pequeño aeródromo cerca de La Fortuna ha tenido vuelos nacionales regulares desde San José, en avionetas con límites estrictos de equipaje. Además se necesita un traslado corto entre el aeródromo y su hotel.",
      ),
      way(
        "car",
        "Driving yourself is straightforward on paved roads, but the mountain stretch is winding and often foggy or rainy in the afternoon.",
        "Manejar por su cuenta es sencillo, por carreteras pavimentadas, pero el tramo de montaña tiene muchas curvas y con frecuencia neblina o lluvia por la tarde.",
      ),
    ],
    faqs: [
      q(
        "Can we visit Poás Volcano on the way?",
        "¿Podemos visitar el volcán Poás por el camino?",
        "Yes. Poás is a detour into the mountains above the airport. Entry is by timed ticket booked in advance, and clouds often hide the crater later in the day, so mornings are best.",
        "Sí. El Poás es un desvío hacia las montañas que están sobre el aeropuerto. La entrada es con boleto de horario fijo reservado con anticipación, y las nubes suelen tapar el cráter más tarde en el día, así que lo mejor es ir por la mañana.",
      ),
      q(
        "Which way over the mountains does the driver take?",
        "¿Por dónde cruza la montaña el conductor?",
        "There are two usual roads, through Ciudad Quesada or via San Ramón and La Tigra. Your driver chooses on the day, according to traffic, fog and road works.",
        "Hay dos carreteras habituales: por Ciudad Quesada o por San Ramón y La Tigra. Su conductor elige ese día, según el tráfico, la neblina y los trabajos en la vía.",
      ),
      q(
        "Can we add the sloth trail in La Fortuna to this ride?",
        "¿Podemos agregar el sendero de perezosos de La Fortuna a este traslado?",
        "Yes. It is in La Fortuna itself, so it can be added to any ride that starts or ends there; the stop list on this page shows its length and price.",
        "Sí. Está en La Fortuna misma, así que se puede agregar a cualquier traslado que empiece o termine allí; la lista de paradas de esta página muestra su duración y su precio.",
      ),
    ],
    ab: {
      lead: l(
        `${MEET} and takes you over the Central Valley mountains to your hotel in La Fortuna. Make a day of it with a stop at Poás Volcano's crater and a highland coffee farm on the way.`,
        `${MEET_ES} y lo lleva por las montañas del Valle Central hasta su hotel en La Fortuna. Aproveche el día con una parada en el cráter del volcán Poás y en una finca de café de altura por el camino.`,
      ),
      faq: q(
        "Is it worth driving to La Fortuna right after a long flight?",
        "¿Vale la pena ir a La Fortuna justo después de un vuelo largo?",
        "For most travellers, yes: at about {time:SJO>Arenal} it is one of the shorter rides from San José airport, and you wake up next to the volcano. If you land very late, remember the mountain road is slower in the dark and fog.",
        "Para la mayoría de los viajeros, sí: con aproximadamente {time:SJO>Arenal}, es uno de los traslados más cortos desde el aeropuerto de San José, y amanece junto al volcán. Si aterriza muy tarde, recuerde que la carretera de montaña es más lenta de noche y con neblina.",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up at your hotel in La Fortuna or on the volcano road and takes you over the mountains to the airport terminal or your San José hotel. A morning start usually means clearer weather on the mountain stretch.",
        "Su conductor lo recoge en su hotel de La Fortuna o de la carretera al volcán y lo lleva por la montaña hasta la terminal del aeropuerto o su hotel en San José. Salir por la mañana suele significar mejor tiempo en el tramo de montaña.",
      ),
      faq: q(
        "Can we stop at Poás on the way back to San José?",
        "¿Podemos parar en el Poás de regreso a San José?",
        "Yes, the stop is offered in both directions. Book the timed tickets for an hour that matches your pickup, and keep in mind that the crater is clearest early in the day.",
        "Sí, la parada se ofrece en los dos sentidos. Reserve las entradas con horario para una hora que calce con su recogida, y tenga en cuenta que el cráter está más despejado temprano.",
      ),
    },
  },

  // ───────── SJO ↔ Monteverde ─────────
  {
    a: "SJO",
    b: "Monteverde",
    updated,
    hook: l("drivers who know the mountain road", "conductores que conocen la carretera de montaña"),
    road: l(
      "Between San José and Monteverde you use Route 27 to the Pacific side and the Inter-American Highway (Route 1) through dry lowland cattle country. The last stretch is the steep, winding Route 606 through Guacimal, between the lowlands and Santa Elena at about 1,400 m above sea level. It's paved now, but tight curves, fog and strong dry-season winds keep speeds low.",
      "Entre San José y Monteverde se usa la Ruta 27 hacia el lado del Pacífico y la Interamericana (Ruta 1) por tierras bajas y secas de fincas ganaderas. El último tramo es la Ruta 606, empinada y con muchas curvas, que pasa por Guacimal y une las tierras bajas con Santa Elena, a unos 1.400 m sobre el nivel del mar. Hoy está asfaltada, pero las curvas cerradas, la neblina y los fuertes vientos de la época seca obligan a ir despacio.",
    ),
    stopsNote: l(
      "The two stops offered on this ride, the Tárcoles bridge and Carara, are on the coastal highway south of the direct road, so they mean a detour toward Jacó and back.",
      "Las dos paradas que se ofrecen en este traslado, el puente de Tárcoles y Carara, están sobre la Costanera, al sur de la carretera directa, así que implican un desvío hacia Jacó y de vuelta.",
    ),
    ways: [
      way(
        "bus",
        "Direct public buses link downtown San José with Santa Elena. They are the cheapest way and take most of a morning or afternoon; they use a terminal in the city, not the airport, and seats can sell out in high season.",
        "Hay buses públicos directos entre el centro de San José y Santa Elena. Son la forma más barata y toman buena parte de una mañana o una tarde; usan una terminal en la ciudad, no el aeropuerto, y en temporada alta los asientos pueden agotarse.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between San José and Monteverde at fixed times, with pickups at several hotels along the way.",
        "Hay shuttles compartidos entre San José y Monteverde en horarios fijos, con recogidas en varios hoteles por el camino.",
      ),
      way(
        "flight",
        "There are no flights to Monteverde. Everyone arrives by road.",
        "No hay vuelos a Monteverde. Todos llegan por carretera.",
      ),
      way(
        "car",
        "The main road is paved, but many side roads to hotels and reserves are steep gravel, where a vehicle with good clearance helps.",
        "La carretera principal está pavimentada, pero muchos caminos secundarios a hoteles y reservas son de lastre y empinados, donde ayuda un vehículo alto.",
      ),
    ],
    faqs: [
      q(
        "Is the road to Monteverde still unpaved?",
        "¿La carretera a Monteverde sigue sin asfaltar?",
        "The main climb on Route 606 is paved today, but it is narrow, steep and curvy. Our partner drivers do it regularly and drive it at a safe pace.",
        "La subida principal por la Ruta 606 hoy está asfaltada, pero es angosta, empinada y con muchas curvas. Nuestros conductores asociados la recorren con frecuencia y la manejan a un ritmo seguro.",
      ),
      q(
        "Can we stop for a break between San José and Monteverde?",
        "¿Podemos parar a descansar entre San José y Monteverde?",
        "Yes. Tell your driver when you want a restroom, coffee or snack stop; there are good places along the highway before the climb.",
        "Sí. Dígale a su conductor cuándo quiere una parada para ir al baño, tomar un café o comer algo; hay buenos lugares a lo largo de la carretera antes de la subida.",
      ),
      q(
        "Does the mountain road make people carsick?",
        "¿La carretera de montaña marea?",
        "It can: the last stretch is a long series of curves. Sit in front if you are prone to it, look at the road ahead and ask your driver for a short pause whenever you need one.",
        "Puede pasar: el último tramo es una larga serie de curvas. Siéntese adelante si es propenso, mire la carretera al frente y pídale a su conductor una pausa corta cuando la necesite.",
      ),
    ],
    ab: {
      lead: l(
        `${MEET} and takes you from the Central Valley down to the Pacific lowlands and back up into the cloud forest, right to your hotel in Monteverde or Santa Elena.`,
        `${MEET_ES} y lo lleva desde el Valle Central hasta las tierras bajas del Pacífico y de nuevo hacia arriba, al bosque nuboso, hasta la puerta de su hotel en Monteverde o Santa Elena.`,
      ),
      faq: q(
        "Our flight lands in the evening. Should we still go up to Monteverde?",
        "Nuestro vuelo aterriza al anochecer. ¿Conviene subir igual a Monteverde?",
        "You can, but the climb is slower in the dark and fog is common, so many travellers prefer to arrive in daylight or spend the first night near the airport. {night}",
        "Se puede, pero la subida es más lenta de noche y la neblina es frecuente, por lo que muchos viajeros prefieren llegar con luz de día o pasar la primera noche cerca del aeropuerto. {night}",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up at your hotel in Monteverde or Santa Elena, takes the mountain road down at a careful pace and continues on the highways to the airport or your San José hotel.",
        "Su conductor lo recoge en su hotel de Monteverde o Santa Elena, baja la carretera de montaña a un ritmo prudente y continúa por las carreteras principales hasta el aeropuerto o su hotel en San José.",
      ),
      faq: q(
        "Is the way down from Monteverde faster than the way up?",
        "¿La bajada de Monteverde es más rápida que la subida?",
        "Not really. The same curves set the pace in both directions, so plan on about {time:Monteverde>SJO} door to door and add a margin if you have a flight.",
        "En realidad no. Las mismas curvas marcan el ritmo en los dos sentidos, así que calcule aproximadamente {time:Monteverde>SJO} de puerta a puerta y sume un margen si tiene un vuelo.",
      ),
    },
  },

  // ───────── LIR ↔ Tamarindo ─────────
  {
    a: "LIR",
    b: "Tamarindo",
    updated,
    hook: l("the closest international airport to Tamarindo", "el aeropuerto internacional más cercano a Tamarindo"),
    road: l(
      "Between Liberia airport and Tamarindo the road is Route 21 across flat Guanacaste ranch land and dry forest toward Belén, and then the road through Huacas and Villarreal to the coast. It's an easy, mostly straight drive. Expect slower traffic through the small towns and in Tamarindo itself in the afternoon.",
      "Entre el aeropuerto de Liberia y Tamarindo se va por la Ruta 21, entre las fincas ganaderas planas y el bosque seco de Guanacaste, hacia Belén, y luego por la carretera que pasa por Huacas y Villarreal hasta la costa. Es un recorrido sencillo y casi todo recto. El tráfico es más lento al cruzar los pueblos pequeños y en el propio Tamarindo por la tarde.",
    ),
    ways: [
      way(
        "bus",
        "Public buses reach Tamarindo from the town of Liberia. From the airport you normally need a taxi into town to catch one, because buses do not reliably stop at the terminal.",
        "Hay buses públicos a Tamarindo desde la ciudad de Liberia. Desde el aeropuerto normalmente hay que tomar un taxi hasta la ciudad para abordarlos, porque los buses no siempre paran en la terminal aérea.",
      ),
      way(
        "shuttle",
        "Shared shuttles wait for several flights and drop travellers at several hotels, so they cost less per person and take longer than the drive itself.",
        "Los shuttles compartidos esperan varios vuelos y dejan viajeros en varios hoteles, así que cuestan menos por persona y tardan más que el recorrido en sí.",
      ),
      way(
        "taxi",
        "Official airport taxis also make the trip. Agree the fare before you get in.",
        "Los taxis oficiales del aeropuerto también hacen el viaje. Acuerde la tarifa antes de subir.",
      ),
      way(
        "flight",
        "No flight makes sense on this ride: Liberia is already Tamarindo's closest airport.",
        "Ningún vuelo tiene sentido en este trayecto: Liberia ya es el aeropuerto más cercano a Tamarindo.",
      ),
      way(
        "car",
        "A rental car is useful if you want to explore other beaches up and down the coast; the road from Liberia is paved and simple.",
        "Un vehículo alquilado es útil si quiere conocer otras playas de la costa; la carretera desde Liberia está pavimentada y es sencilla.",
      ),
    ],
    faqs: [
      q(
        "Should we fly into Liberia or San José for Tamarindo?",
        "¿Conviene llegar por Liberia o por San José para ir a Tamarindo?",
        "Liberia (LIR) is far closer: about {time:LIR>Tamarindo} by road, against {time:SJO>Tamarindo} from San José (SJO).",
        "Liberia (LIR) queda mucho más cerca: {time:LIR>Tamarindo} por carretera, frente a {time:SJO>Tamarindo} desde San José (SJO).",
      ),
      q(
        "Can we stop for groceries between the airport and Tamarindo?",
        "¿Podemos parar a comprar víveres entre el aeropuerto y Tamarindo?",
        "Yes. Many travelers staying in rentals ask for a quick supermarket stop; just tell your driver.",
        "Sí. Muchos viajeros que se hospedan en casas de alquiler piden una parada rápida en un supermercado; solo dígaselo a su conductor.",
      ),
      q(
        "Do we need a large vehicle for surfboards?",
        "¿Necesitamos un vehículo grande para tablas de surf?",
        "Tell us about boards or other bulky items in your booking notes and choose a class with room to spare; each vehicle class lists how many travellers and suitcases it fits.",
        "Cuéntenos de las tablas u otros objetos voluminosos en las notas de su reserva y elija una categoría con espacio de sobra; cada categoría de vehículo indica cuántos viajeros y maletas caben.",
      ),
    ],
    ab: {
      lead: l(
        `Liberia is the closest international airport to Tamarindo. ${MEET} and takes you straight to your hotel or rental, with no shuttle stops at other hotels along the way.`,
        `Liberia es el aeropuerto internacional más cercano a Tamarindo. ${MEET_ES} y lo lleva directo a su hotel o casa de alquiler, sin las paradas de un shuttle en otros hoteles por el camino.`,
      ),
      faq: q(
        "Our flight is delayed. Will the driver still be there?",
        "Nuestro vuelo viene atrasado. ¿Estará el conductor igual?",
        "Yes. On airport pickups we follow your flight, and your driver waits up to 60 minutes after it actually lands.",
        "Sí. En las recogidas en aeropuerto seguimos su vuelo, y su conductor espera hasta 60 minutos después del aterrizaje real.",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up at your hotel or rental in Tamarindo, Langosta or Playa Grande and drives you to the departures door at Liberia airport.",
        "Su conductor lo recoge en su hotel o casa de alquiler en Tamarindo, Langosta o Playa Grande y lo lleva hasta la puerta de salidas del aeropuerto de Liberia.",
      ),
      faq: q(
        "Is one more morning on the beach possible before an afternoon flight?",
        "¿Alcanza una mañana más de playa antes de un vuelo por la tarde?",
        "Often, yes: the ride is only about {time:Tamarindo>LIR}. Count back from the time your airline wants you at the airport and leave a margin for town traffic.",
        "Muchas veces sí: el traslado es de solo {time:Tamarindo>LIR} aproximadamente. Cuente hacia atrás desde la hora en que su aerolínea lo quiere en el aeropuerto y deje un margen por el tráfico de los pueblos.",
      ),
    },
  },

  // ───────── SJO ↔ Tamarindo ─────────
  {
    a: "SJO",
    b: "Tamarindo",
    updated,
    hook: l("comfort stops when you want them", "paradas de descanso cuando usted quiera"),
    road: l(
      "San José and Tamarindo are on opposite sides of the country's north-west. The ride uses Route 27 to the Pacific, the Inter-American Highway (Route 1) through the lowlands, Route 18 across the Tempisque River on the Friendship Bridge onto the Nicoya Peninsula, and Route 21 past Santa Cruz. It's a long day on the road; Friday and holiday traffic around San José can add more.",
      "San José y Tamarindo están en lados opuestos del noroeste del país. El traslado usa la Ruta 27 hasta el Pacífico, la Interamericana (Ruta 1) por las tierras bajas, la Ruta 18, que cruza el río Tempisque por el puente de la Amistad hacia la península de Nicoya, y la Ruta 21, que pasa por Santa Cruz. Es un día largo de carretera; el tráfico de los viernes y feriados alrededor de San José puede sumar más.",
    ),
    ways: [
      way(
        "bus",
        "Public buses link downtown San José and Tamarindo on a long trip. They use a terminal in the city, not the airport.",
        "Hay buses públicos entre el centro de San José y Tamarindo, en un viaje largo. Usan una terminal en la ciudad, no el aeropuerto.",
      ),
      way(
        "shuttle",
        "Shared shuttles cross between San José and the Guanacaste beaches at fixed times, with hotel pickups at both ends.",
        "Hay shuttles compartidos entre San José y las playas de Guanacaste en horarios fijos, con recogidas en hoteles en ambos extremos.",
      ),
      way(
        "flight",
        "Domestic flights have linked San José with Tamarindo's small airstrip and with Liberia. Planes are small and luggage limits are strict.",
        "Ha habido vuelos nacionales entre San José y el pequeño aeródromo de Tamarindo, y también a Liberia. Los aviones son pequeños y los límites de equipaje son estrictos.",
      ),
      way(
        "car",
        "The whole way is paved, but it is a long drive to do yourself straight after a flight.",
        "Todo el camino está pavimentado, pero es un recorrido largo para manejarlo usted mismo recién bajado de un vuelo.",
      ),
    ],
    faqs: [
      q(
        "Is it better to use Liberia airport for Tamarindo?",
        "¿Es mejor usar el aeropuerto de Liberia para Tamarindo?",
        "If you can, yes: Liberia (LIR) is about {time:LIR>Tamarindo} from Tamarindo, against {time:SJO>Tamarindo} from San José. When your flights use San José, a private ride is the simplest way across with all your luggage.",
        "Si puede, sí: Liberia (LIR) queda a {time:LIR>Tamarindo} de Tamarindo, frente a {time:SJO>Tamarindo} desde San José. Cuando sus vuelos son por San José, un traslado privado es la forma más sencilla de cruzar con todo su equipaje.",
      ),
      q(
        "Can we break up the drive?",
        "¿Podemos dividir el recorrido?",
        "Yes. Tell your driver when you want a restroom, food or coffee stop. Most groups stop once around the halfway point.",
        "Sí. Dígale a su conductor cuándo quiere una parada para ir al baño, comer o tomar un café. La mayoría de los grupos para una vez, más o menos a mitad de camino.",
      ),
      q(
        "Does this ride use a ferry?",
        "¿Este traslado usa un ferry?",
        "No. It crosses the Tempisque River on a bridge. The Gulf of Nicoya ferry is only used for rides to the southern Nicoya Peninsula, such as Santa Teresa.",
        "No. Cruza el río Tempisque por un puente. El ferry del golfo de Nicoya solo se usa en traslados al sur de la península de Nicoya, como Santa Teresa.",
      ),
    ],
    ab: {
      lead: l(
        `Landed in San José but staying in Tamarindo? ${MEET} and takes you all the way across to the Guanacaste coast, stopping whenever you need a break.`,
        `¿Aterrizó en San José pero se hospeda en Tamarindo? ${MEET_ES} y lo lleva hasta la costa de Guanacaste, con paradas cada vez que necesite un descanso.`,
      ),
      faq: q(
        "We land late. Is that a problem?",
        "Aterrizamos tarde. ¿Es un problema?",
        "Tell us your arrival time when you book. With a late landing, many travelers spend the first night near the airport and drive across the next morning in daylight. {night}",
        "Indíquenos su hora de llegada al reservar. Cuando el vuelo aterriza tarde, muchos viajeros pasan la primera noche cerca del aeropuerto y hacen el recorrido a la mañana siguiente, con luz de día. {night}",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up in Tamarindo, Langosta or Playa Grande and takes you across to the Central Valley, to the airport or to a hotel near it for the night before your flight.",
        "Su conductor lo recoge en Tamarindo, Langosta o Playa Grande y lo lleva hasta el Valle Central, al aeropuerto o a un hotel cercano para la noche anterior a su vuelo.",
      ),
      faq: q(
        "Can we do Tamarindo to SJO on the day of our flight?",
        "¿Podemos hacer Tamarindo–SJO el mismo día del vuelo?",
        "Only with an early start and a late flight: the ride takes about {time:Tamarindo>SJO} before any traffic. Many travellers come across the day before and sleep near the airport.",
        "Solo saliendo temprano y con un vuelo tarde: el traslado toma aproximadamente {time:Tamarindo>SJO} sin contar el tráfico. Muchos viajeros cruzan el día anterior y duermen cerca del aeropuerto.",
      ),
    },
  },

  // ───────── SJO ↔ Puerto Viejo ─────────
  {
    a: "SJO",
    b: "PuertoViejo",
    updated,
    hook: l("through Braulio Carrillo rainforest to the Caribbean", "por el bosque lluvioso del Braulio Carrillo hasta el Caribe"),
    road: l(
      "Between San José and Puerto Viejo the road is Route 32, straight through Braulio Carrillo National Park: steep, curvy and often misty. It reaches the Caribbean lowlands at Guápiles and runs past the banana plantations around Siquirres to Limón, where Route 36 follows the coast past Cahuita. Heavy rain can close Route 32 for landslides; when it does, drivers take the longer road through Turrialba, which adds time.",
      "Entre San José y Puerto Viejo se va por la Ruta 32, que atraviesa el Parque Nacional Braulio Carrillo: empinada, con curvas y a menudo con neblina. Llega a las llanuras del Caribe en Guápiles y pasa entre los bananales de los alrededores de Siquirres hasta Limón, donde la Ruta 36 sigue la costa pasando por Cahuita. Las lluvias fuertes pueden cerrar la Ruta 32 por derrumbes; cuando eso ocurre, los conductores toman la carretera más larga por Turrialba, lo que suma tiempo.",
    ),
    ways: [
      way(
        "bus",
        "Direct public buses run between San José and Puerto Viejo, passing Limón and Cahuita. They are inexpensive and take most of a morning or afternoon. The terminal is in the city, not at the airport, and has changed in recent years.",
        "Hay buses públicos directos entre San José y Puerto Viejo, que pasan por Limón y Cahuita. Son económicos y toman buena parte de una mañana o una tarde. La terminal está en la ciudad, no en el aeropuerto, y ha cambiado en los últimos años.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between San José and the South Caribbean at fixed times, usually once or twice a day.",
        "Hay shuttles compartidos entre San José y el Caribe Sur en horarios fijos, normalmente una o dos veces al día.",
      ),
      way(
        "flight",
        "Domestic flights have operated between San José and Limón, which still leaves about an hour by road to Puerto Viejo. The route has not run continuously.",
        "Ha habido vuelos nacionales entre San José y Limón, desde donde todavía falta cerca de una hora por carretera hasta Puerto Viejo. La ruta no ha operado de forma continua.",
      ),
      way(
        "car",
        "Route 32 is busy with container trucks heading to the port, and it is steep, foggy and often wet in the mountains. Once in Puerto Viejo, most people get around by bicycle.",
        "La Ruta 32 tiene mucho tránsito de camiones de contenedores hacia el puerto, y en la montaña es empinada, con neblina y a menudo mojada. Ya en Puerto Viejo, la mayoría se mueve en bicicleta.",
      ),
    ],
    faqs: [
      q(
        "What if Route 32 is closed?",
        "¿Qué pasa si la Ruta 32 está cerrada?",
        "It happens after very heavy rain. Your driver checks conditions before leaving and takes the alternative road through Turrialba if needed. We keep you posted on WhatsApp.",
        "Ocurre después de lluvias muy fuertes. Su conductor revisa las condiciones antes de salir y, si hace falta, toma la carretera alterna por Turrialba. Lo mantenemos informado por WhatsApp.",
      ),
      q(
        "Can we stop in Cahuita?",
        "¿Podemos parar en Cahuita?",
        "Yes. Cahuita is right on the way, so a short stop for lunch or a look at the village is easy. Just tell your driver.",
        "Sí. Cahuita queda de camino, así que es fácil hacer una parada corta para almorzar o conocer el pueblo. Solo dígaselo a su conductor.",
      ),
      q(
        "Do we need a 4x4 to reach Puerto Viejo?",
        "¿Se necesita un 4x4 para llegar a Puerto Viejo?",
        "No. The road is paved all the way from San José to Puerto Viejo and on along the coast, so any vehicle class works; choose by travellers and luggage.",
        "No. La carretera está pavimentada desde San José hasta Puerto Viejo y a lo largo de la costa, así que sirve cualquier categoría de vehículo; elija según los viajeros y el equipaje.",
      ),
    ],
    ab: {
      lead: l(
        `${MEET} and takes you through the rainforest of Braulio Carrillo National Park and down to the Caribbean, right to your hotel in Puerto Viejo, Cocles or Playa Chiquita.`,
        `${MEET_ES} y lo lleva por el bosque lluvioso del Parque Nacional Braulio Carrillo hasta el Caribe, a la puerta de su hotel en Puerto Viejo, Cocles o Playa Chiquita.`,
      ),
      faq: q(
        "Is Liberia airport an option for Puerto Viejo?",
        "¿El aeropuerto de Liberia sirve para ir a Puerto Viejo?",
        "Not a practical one: it is about {time:LIR>PuertoViejo} away, against {time:SJO>PuertoViejo} from San José. Fly into San José for the Caribbean coast.",
        "No es práctico: queda a unas {time:LIR>PuertoViejo}, frente a {time:SJO>PuertoViejo} desde San José. Para la costa del Caribe, llegue por San José.",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up at your hotel anywhere along the coast road, from Puerto Viejo to Manzanillo, and takes you back over the mountains to the airport or your San José hotel.",
        "Su conductor lo recoge en su hotel en cualquier punto de la carretera costera, de Puerto Viejo a Manzanillo, y lo lleva de regreso por la montaña hasta el aeropuerto o su hotel en San José.",
      ),
      faq: q(
        "How much margin should we leave before a flight?",
        "¿Cuánto margen conviene dejar antes de un vuelo?",
        "A generous one. The ride takes about {time:PuertoViejo>SJO}, trucks slow Route 32 and rain can close it, so many travellers return the day before an international flight.",
        "Uno amplio. El traslado toma aproximadamente {time:PuertoViejo>SJO}, los camiones hacen lenta la Ruta 32 y la lluvia puede cerrarla, por lo que muchos viajeros regresan el día anterior a un vuelo internacional.",
      ),
    },
  },

  // ───────── SJO ↔ Sierpe (boat dock) ─────────
  {
    a: "SJO",
    b: "Sierpe",
    legacySlug: "sjo-airport-to-sierpe-drake-bay",
    updated,
    hook: l("timed around your boat to Drake Bay", "coordinado con su lancha a Bahía Drake"),
    road: l(
      "Between San José and Sierpe the ride follows Route 27 to the Pacific and then the Costanera Sur down the coast past Jacó, Quepos, Dominical and Uvita to Palmar Norte, where a short local road leads to the river town of Sierpe and its boat dock. It is highway nearly all the way, with long straight stretches between oil-palm plantations and the sea.",
      "Entre San José y Sierpe el traslado sigue la Ruta 27 hasta el Pacífico y luego la Costanera Sur a lo largo de la costa, pasando por Jacó, Quepos, Dominical y Uvita, hasta Palmar Norte, donde un camino local corto lleva al pueblo ribereño de Sierpe y a su muelle. Casi todo es carretera principal, con largas rectas entre plantaciones de palma aceitera y el mar.",
    ),
    ways: [
      way(
        "bus",
        "Long-distance public buses run between San José and Palmar Norte, where a taxi or local bus covers the last stretch to Sierpe. It is the cheapest way and a long day.",
        "Hay buses públicos de larga distancia entre San José y Palmar Norte, donde un taxi o un bus local cubre el último tramo hasta Sierpe. Es la forma más barata y un día largo.",
      ),
      way(
        "shuttle",
        "Shared shuttles serve Sierpe from some tourist towns at fixed times. Routes are fewer than on the main circuit, so check what is running on your dates.",
        "Algunos shuttles compartidos llegan a Sierpe desde ciertos pueblos turísticos en horarios fijos. Hay menos rutas que en el circuito principal: revise cuáles operan en sus fechas.",
      ),
      way(
        "flight",
        "Small planes fly between San José and the Drake Bay airstrip, which skips Sierpe and the boat altogether. Luggage limits are strict.",
        "Hay avionetas entre San José y el aeródromo de Bahía Drake, lo que evita Sierpe y la lancha. Los límites de equipaje son estrictos.",
      ),
      way(
        "car",
        "You can drive to Sierpe on paved roads and leave the car in paid parking near the dock while you are in Drake Bay.",
        "Se puede manejar hasta Sierpe por carreteras pavimentadas y dejar el vehículo en un parqueo de pago cerca del muelle mientras está en Bahía Drake.",
      ),
    ],
    faqs: [
      q(
        "What time do the boats leave Sierpe?",
        "¿A qué hora salen las lanchas de Sierpe?",
        "Boat times are set by the lodges and boat operators, not by us, and they can change. Confirm yours with your lodge, tell us, and we plan the ride around it.",
        "Los horarios de las lanchas los definen los lodges y los operadores, no nosotros, y pueden cambiar. Confirme el suyo con su lodge, indíquenoslo, y planificamos el traslado en función de esa hora.",
      ),
      q(
        "Do we need permits for Corcovado?",
        "¿Se necesitan permisos para Corcovado?",
        "Yes. Corcovado National Park requires SINAC permits and a certified guide, booked in advance, and overnight spaces at Sirena Station are limited. Book them before your trip.",
        "Sí. El Parque Nacional Corcovado exige permisos del SINAC y un guía certificado, reservados con anticipación, y los espacios para pasar la noche en la Estación Sirena son limitados. Resérvelos antes de su viaje.",
      ),
      q(
        "Can we stop on the way?",
        "¿Podemos hacer paradas por el camino?",
        "Yes, if there's time around your boat. The Tárcoles crocodile bridge and the Carara macaw walk are right on the coastal road.",
        "Sí, si el horario de su lancha lo permite. El puente de los cocodrilos de Tárcoles y la caminata de las lapas en Carara están sobre la carretera costera.",
      ),
    ],
    ab: {
      lead: l(
        "Most travelers reach Drake Bay by boat from Sierpe. Your driver takes you from the airport down the Pacific coast to the dock in Sierpe, timed around your boat.",
        "La mayoría de los viajeros llega a Bahía Drake en lancha desde Sierpe. Su conductor lo lleva desde el aeropuerto, bajando por la costa del Pacífico, hasta el muelle de Sierpe, en coordinación con el horario de su lancha.",
      ),
      faq: q(
        "We arrive on an international flight. Can we reach Drake Bay the same day?",
        "Llegamos en un vuelo internacional. ¿Podemos llegar a Bahía Drake el mismo día?",
        "Usually not. The road alone takes about {time:SJO>Sierpe} and the boat comes after it, so an international arrival normally means a first night near the airport, on the coast or in Sierpe.",
        "Por lo general, no. Solo la carretera toma aproximadamente {time:SJO>Sierpe} y después viene la lancha, así que una llegada internacional normalmente implica una primera noche cerca del aeropuerto, en la costa o en Sierpe.",
      ),
    },
    ba: {
      lead: l(
        "Back from Drake Bay? Your driver waits for you at the Sierpe dock and takes you up the coast to the airport or your San José hotel.",
        "¿De regreso de Bahía Drake? Su conductor lo espera en el muelle de Sierpe y lo lleva por la costa hasta el aeropuerto o su hotel en San José.",
      ),
      faq: q(
        "Can we take the boat in the morning and fly out of San José that evening?",
        "¿Podemos tomar la lancha por la mañana y volar desde San José esa noche?",
        "Only with a wide margin: add the boat, about {time:Sierpe>SJO} by road and the time your airline wants you at the airport. Many travellers sleep near the airport and fly the next day.",
        "Solo con un margen amplio: sume la lancha, aproximadamente {time:Sierpe>SJO} por carretera y el tiempo que su aerolínea le pide estar en el aeropuerto. Muchos viajeros duermen cerca del aeropuerto y vuelan al día siguiente.",
      ),
    },
  },

  // ───────── SJO ↔ Drake Bay (road + boat) ─────────
  {
    a: "SJO",
    b: "DrakeBay",
    updated,
    hook: l("road transfer and river boat in one booking", "traslado por carretera y lancha en una sola reserva"),
    road: l(
      "The trip between San José and Drake Bay has two parts. By road, Route 27 and the Costanera Sur run along the Pacific coast past Jacó, Quepos and Uvita to Palmar Norte and the Sierpe dock. By boat, you travel the Sierpe River through one of Central America's largest mangrove forests, cross the river mouth and follow the Osa coast to the beach at Drake Bay.",
      "El viaje entre San José y Bahía Drake tiene dos partes. Por carretera, la Ruta 27 y la Costanera Sur recorren la costa del Pacífico, pasando por Jacó, Quepos y Uvita, hasta Palmar Norte y el muelle de Sierpe. En lancha, se navega el río Sierpe entre uno de los manglares más grandes de Centroamérica, se cruza la boca del río y se sigue la costa de Osa hasta la playa de Bahía Drake.",
    ),
    ways: [
      way(
        "bus",
        "Public buses run between San José and Palmar Norte, with a taxi or local bus to Sierpe; from there you still need a place on a boat. It is the cheapest way and a very long day.",
        "Hay buses públicos entre San José y Palmar Norte, con un taxi o un bus local hasta Sierpe; desde allí todavía necesita un espacio en una lancha. Es la forma más barata y un día muy largo.",
      ),
      way(
        "shuttle",
        "Some shared shuttles reach Sierpe at fixed times, and the boat is booked separately. Routes are few, so check what is running on your dates.",
        "Algunos shuttles compartidos llegan a Sierpe en horarios fijos, y la lancha se reserva aparte. Hay pocas rutas: revise cuáles operan en sus fechas.",
      ),
      way(
        "flight",
        "Small planes fly between San José and the Drake Bay airstrip, the fastest way in, followed by a short ride to your lodge. Luggage limits are strict.",
        "Hay avionetas entre San José y el aeródromo de Bahía Drake, la forma más rápida de llegar, seguidas de un traslado corto a su lodge. Los límites de equipaje son estrictos.",
      ),
      way(
        "car",
        "Driving all the way to Drake Bay means a rough road with several river crossings: it needs a high-clearance 4x4 and can be impassable in the rainy season. Most people who drive leave the car in Sierpe and take the boat.",
        "Llegar manejando hasta Bahía Drake implica un camino en mal estado con varios cruces de ríos: requiere un 4x4 alto y puede quedar intransitable en la época lluviosa. La mayoría de quienes manejan deja el vehículo en Sierpe y toma la lancha.",
      ),
    ],
    faqs: [
      q(
        "Is the boat included in the price?",
        "¿La lancha está incluida en el precio?",
        "Yes. The price on this page is for the vehicle option that includes the river boat between Sierpe and Drake Bay. If your lodge already provides the boat, book the ride to the Sierpe dock instead.",
        "Sí. El precio de esta página corresponde a la opción de vehículo que incluye la lancha entre Sierpe y Bahía Drake. Si su lodge ya le da la lancha, reserve el traslado hasta el muelle de Sierpe.",
      ),
      q(
        "Does the transfer include Corcovado National Park?",
        "¿El traslado incluye el Parque Nacional Corcovado?",
        "No, it is transport only. Corcovado can only be visited with a certified guide and a SINAC permit booked in advance. Our multi-day trips include a Corcovado trip with the permits.",
        "No, es solo el transporte. Corcovado solo se visita con un guía certificado y un permiso del SINAC reservado con anticipación. Entre nuestros viajes de varios días hay uno a Corcovado con los permisos incluidos.",
      ),
      q(
        "How should we pack for the boat?",
        "¿Cómo conviene empacar para la lancha?",
        "Lightly, and with anything delicate in a waterproof bag: boarding and landing in Drake Bay are from the beach, in shallow water. Soft bags are easier to handle on a boat than large hard suitcases.",
        "Liviano, y con todo lo delicado en una bolsa impermeable: en Bahía Drake se aborda y se desembarca en la playa, con el agua a los tobillos. Los bolsos blandos se manejan mejor en una lancha que las maletas rígidas grandes.",
      ),
    ],
    ab: {
      lead: l(
        "One booking covers both legs: your driver takes you from the airport to the Sierpe dock, and the river boat takes you on to Drake Bay.",
        "Una sola reserva cubre los dos tramos: su conductor lo lleva del aeropuerto al muelle de Sierpe, y la lancha lo lleva hasta Bahía Drake.",
      ),
      faq: q(
        "Can we do airport to Drake Bay in one day?",
        "¿Se puede ir del aeropuerto a Bahía Drake en un solo día?",
        "It takes an early start: about {time:SJO>DrakeBay} door to door, boat included, and the boat has to fit into the same day. After an international flight, most travellers sleep near the airport or on the coast first.",
        "Requiere salir temprano: aproximadamente {time:SJO>DrakeBay} de puerta a puerta, con la lancha incluida, y la lancha tiene que caber en ese mismo día. Después de un vuelo internacional, la mayoría de los viajeros duerme primero cerca del aeropuerto o en la costa.",
      ),
    },
    ba: {
      lead: l(
        "The way out starts on the beach: the boat takes you from Drake Bay to Sierpe, where your driver is waiting to take you up the coast to San José.",
        "La salida empieza en la playa: la lancha lo lleva de Bahía Drake a Sierpe, donde su conductor lo espera para llevarlo por la costa hasta San José.",
      ),
      faq: q(
        "Should we fly home the same day we leave Drake Bay?",
        "¿Conviene volar a casa el mismo día que salimos de Bahía Drake?",
        "We would not plan it that way. The trip takes about {time:DrakeBay>SJO} door to door and depends on the boat and the sea, so a night near the airport before an international flight is the safe choice.",
        "No lo planearíamos así. El viaje toma aproximadamente {time:DrakeBay>SJO} de puerta a puerta y depende de la lancha y del mar, así que lo seguro es pasar una noche cerca del aeropuerto antes de un vuelo internacional.",
      ),
    },
  },

  // ───────── LIR ↔ La Fortuna / Arenal ─────────
  {
    a: "LIR",
    b: "Arenal",
    updated,
    hook: l("around Lake Arenal, with an optional Río Celeste stop", "bordeando el lago Arenal, con parada opcional en Río Celeste"),
    road: l(
      "Between Liberia and La Fortuna the usual road follows the Inter-American Highway through Guanacaste's dry lowlands to Cañas, climbs to Tilarán and then winds around the north shore of Lake Arenal, past Nuevo Arenal and the dam, with lake and volcano views on a clear day. The lake road is paved but narrow and full of curves, and wind and rain are common.",
      "Entre Liberia y La Fortuna la carretera habitual sigue la Interamericana por las tierras bajas y secas de Guanacaste hasta Cañas, sube a Tilarán y luego bordea la orilla norte del lago Arenal, pasando por Nuevo Arenal y la represa, con vistas del lago y del volcán en días despejados. La carretera del lago está pavimentada, pero es angosta y con muchas curvas, y el viento y la lluvia son frecuentes.",
    ),
    stopsNote: l(
      "Río Celeste is not on the lake road: adding it sends the ride north of the lake, through the Tenorio Volcano area, and makes it a full day.",
      "Río Celeste no queda sobre la carretera del lago: al agregarlo, el traslado pasa al norte del lago, por la zona del volcán Tenorio, y se convierte en un día completo.",
    ),
    ways: [
      way(
        "bus",
        "There is no direct public bus. The trip by bus starts in the town of Liberia, not at the airport, and takes changes in Cañas and Tilarán: a full day.",
        "No hay bus público directo. El viaje en bus empieza en la ciudad de Liberia, no en el aeropuerto, y requiere cambios en Cañas y Tilarán: un día completo.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between Liberia airport and La Fortuna at fixed times, with stops at several hotels.",
        "Hay shuttles compartidos entre el aeropuerto de Liberia y La Fortuna en horarios fijos, con paradas en varios hoteles.",
      ),
      way(
        "flight",
        "Domestic flights are organised around San José, so flying between Liberia and La Fortuna generally means connecting there. Check the airlines' current routes.",
        "Los vuelos nacionales se organizan alrededor de San José, así que volar entre Liberia y La Fortuna por lo general implica hacer conexión allí. Revise las rutas vigentes de las aerolíneas.",
      ),
      way(
        "car",
        "The route is paved. The lake section is slow and winding, and map apps sometimes suggest steep gravel shortcuts near Tilarán that are best avoided.",
        "La ruta está pavimentada. El tramo del lago es lento y con curvas, y las aplicaciones de mapas a veces proponen atajos de lastre empinados cerca de Tilarán que es mejor evitar.",
      ),
    ],
    faqs: [
      q(
        "Is Liberia or San José the better airport for La Fortuna?",
        "¿Qué aeropuerto conviene más para La Fortuna, Liberia o San José?",
        "The drive is about the same: {time:LIR>Arenal} from Liberia and {time:SJO>Arenal} from San José. Pick the airport with the better flight, or the one that suits the rest of your route.",
        "El recorrido es casi igual: {time:LIR>Arenal} desde Liberia y {time:SJO>Arenal} desde San José. Elija el aeropuerto con el mejor vuelo, o el que más convenga al resto de su ruta.",
      ),
      q(
        "Can we visit Río Celeste between Liberia and La Fortuna?",
        "¿Podemos visitar Río Celeste entre Liberia y La Fortuna?",
        "Yes, it is offered as a stop on this ride. It is a hike inside Tenorio Volcano National Park, so bring shoes that can get muddy; after heavy rain the river can lose its blue colour.",
        "Sí, se ofrece como parada en este traslado. Es una caminata dentro del Parque Nacional Volcán Tenorio, así que lleve zapatos que se puedan embarrar; después de lluvias fuertes el río puede perder su color celeste.",
      ),
      q(
        "Is the road around Lake Arenal difficult?",
        "¿Es difícil la carretera que bordea el lago Arenal?",
        "It is paved and scenic, but narrow and winding, which is why the ride takes longer than the map suggests. Ask your driver for a pause at a lookout if the curves get to you.",
        "Está pavimentada y es muy bonita, pero es angosta y con muchas curvas; por eso el traslado dura más de lo que sugiere el mapa. Pídale a su conductor una pausa en un mirador si las curvas lo afectan.",
      ),
    ],
    ab: {
      lead: l(
        `${MEET} and takes you from Guanacaste's dry plains up around Lake Arenal to your hotel in La Fortuna.`,
        `${MEET_ES} y lo lleva desde las llanuras secas de Guanacaste, bordeando el lago Arenal, hasta su hotel en La Fortuna.`,
      ),
      faq: q(
        "We land in Liberia in the afternoon. Will we arrive in daylight?",
        "Aterrizamos en Liberia por la tarde. ¿Llegaremos con luz de día?",
        "It depends on the hour: the ride is about {time:LIR>Arenal} and it gets dark around 6 PM all year in Costa Rica. A later landing simply means doing the lake road after dark, at a slower pace.",
        "Depende de la hora: el traslado toma aproximadamente {time:LIR>Arenal} y en Costa Rica oscurece cerca de las 6 p. m. todo el año. Un aterrizaje más tarde solo significa hacer la carretera del lago de noche, a un ritmo más lento.",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up at your hotel in La Fortuna and takes you around the lake and down to the Guanacaste lowlands, to the departures door at Liberia airport.",
        "Su conductor lo recoge en su hotel de La Fortuna y lo lleva bordeando el lago y bajando a las tierras bajas de Guanacaste, hasta la puerta de salidas del aeropuerto de Liberia.",
      ),
      faq: q(
        "Can we fit Río Celeste in before a flight from Liberia?",
        "¿Alcanza para Río Celeste antes de un vuelo desde Liberia?",
        "Only before a late flight: the stop turns the ride into a full day. With a midday or afternoon departure, go straight to the airport.",
        "Solo antes de un vuelo tarde: la parada convierte el traslado en un día completo. Con una salida al mediodía o por la tarde, vaya directo al aeropuerto.",
      ),
    },
  },

  // ───────── LIR ↔ Monteverde ─────────
  {
    a: "LIR",
    b: "Monteverde",
    updated,
    hook: l("from the dry lowlands up to the cloud forest", "de las tierras bajas y secas al bosque nuboso"),
    road: l(
      "Between Liberia and Monteverde most of the distance is the Inter-American Highway, flat and straight through Guanacaste's ranch land past Bagaces and Cañas. Then comes the slow part: the mountain road that climbs from the lowlands to Santa Elena, about 1,400 m above sea level, with tight curves, fog and wind. Drivers choose which of the mountain roads to use according to the day's conditions.",
      "Entre Liberia y Monteverde la mayor parte de la distancia es la Interamericana, plana y recta entre las fincas ganaderas de Guanacaste, pasando por Bagaces y Cañas. Después viene la parte lenta: la carretera de montaña que sube de las tierras bajas a Santa Elena, a unos 1.400 m sobre el nivel del mar, con curvas cerradas, neblina y viento. Los conductores eligen cuál de las carreteras de montaña usar según las condiciones del día.",
    ),
    ways: [
      way(
        "bus",
        "We know of no direct public bus between Liberia and Monteverde. Going by bus means changing on the Inter-American Highway and takes most of a day; ask locally for the current connections.",
        "No conocemos ningún bus público directo entre Liberia y Monteverde. Ir en bus implica hacer cambios sobre la Interamericana y toma buena parte de un día; consulte en el lugar las conexiones vigentes.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between Liberia and Monteverde at fixed times, with stops at several hotels.",
        "Hay shuttles compartidos entre Liberia y Monteverde en horarios fijos, con paradas en varios hoteles.",
      ),
      way(
        "flight",
        "There are no flights to Monteverde. The nearest airports are the two international ones, Liberia and San José.",
        "No hay vuelos a Monteverde. Los aeropuertos más cercanos son los dos internacionales, Liberia y San José.",
      ),
      way(
        "car",
        "The highway is easy; the climb is not. Some approaches to Monteverde still have gravel stretches, and many side roads to hotels and reserves are steep gravel.",
        "La carretera principal es fácil; la subida, no. Algunos accesos a Monteverde todavía tienen tramos de lastre, y muchos caminos secundarios a hoteles y reservas son de lastre y empinados.",
      ),
    ],
    faqs: [
      q(
        "Is Liberia or San José closer to Monteverde?",
        "¿Qué queda más cerca de Monteverde, Liberia o San José?",
        "They are about the same: {time:LIR>Monteverde} from Liberia and {time:SJO>Monteverde} from San José. Choose by flight and by where the rest of your trip goes.",
        "Quedan casi igual: {time:LIR>Monteverde} desde Liberia y {time:SJO>Monteverde} desde San José. Elija por el vuelo y por el resto de su viaje.",
      ),
      q(
        "Do we need a 4x4 between Liberia and Monteverde?",
        "¿Se necesita un 4x4 entre Liberia y Monteverde?",
        "Not for the main road. If your hotel sits up a steep gravel side road, a vehicle with more clearance is more comfortable; the vehicle classes and what each one fits are listed on this page.",
        "Para la carretera principal, no. Si su hotel está en un camino secundario de lastre y empinado, un vehículo más alto resulta más cómodo; las categorías de vehículo y lo que cabe en cada una aparecen en esta página.",
      ),
      q(
        "How different is the weather at each end?",
        "¿Qué tan distinto es el clima en cada extremo?",
        "Very. Liberia is hot and dry for much of the year, while Monteverde is cool, windy and often misty. Keep a light jacket within reach rather than at the bottom of a suitcase.",
        "Mucho. Liberia es caliente y seca buena parte del año, mientras que Monteverde es fresco, ventoso y a menudo neblinoso. Tenga una chaqueta liviana a mano y no en el fondo de la maleta.",
      ),
    ],
    ab: {
      lead: l(
        `${MEET} and takes you from the heat of Guanacaste up into the cloud forest, to the door of your hotel in Monteverde or Santa Elena.`,
        `${MEET_ES} y lo lleva del calor de Guanacaste al bosque nuboso, hasta la puerta de su hotel en Monteverde o Santa Elena.`,
      ),
      faq: q(
        "Should we go up to Monteverde after an evening landing?",
        "¿Conviene subir a Monteverde después de aterrizar al anochecer?",
        "If you can choose, arrive in daylight: the climb is slower in the dark and in fog. If your flight lands late, the ride still runs. {night}",
        "Si puede elegir, llegue con luz de día: la subida es más lenta de noche y con neblina. Si su vuelo aterriza tarde, el traslado se hace igual. {night}",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up at your hotel in Monteverde or Santa Elena, takes the mountain road down carefully and follows the Inter-American Highway north to Liberia airport.",
        "Su conductor lo recoge en su hotel de Monteverde o Santa Elena, baja con cuidado la carretera de montaña y sigue la Interamericana hacia el norte hasta el aeropuerto de Liberia.",
      ),
      faq: q(
        "Can we do a morning activity in Monteverde before a flight from Liberia?",
        "¿Podemos hacer una actividad por la mañana en Monteverde antes de un vuelo desde Liberia?",
        "Only with a late-afternoon or evening flight. The ride is about {time:Monteverde>LIR}, and the airline's check-in time comes on top of it.",
        "Solo con un vuelo al final de la tarde o de noche. El traslado toma aproximadamente {time:Monteverde>LIR}, y a eso se suma el tiempo que la aerolínea le pide para registrarse.",
      ),
    },
  },

  // ───────── LIR ↔ Manuel Antonio ─────────
  {
    a: "LIR",
    b: "ManuelAntonio",
    updated,
    hook: l("Guanacaste and the Central Pacific in one ride", "Guanacaste y el Pacífico Central en un solo traslado"),
    road: l(
      "Liberia and Manuel Antonio are joined by two highways. The Inter-American runs through Guanacaste's lowlands past Cañas toward the port of Puntarenas, and from the Caldera area the coastal highway continues past Jacó and Parrita to Quepos. It is paved and mostly flat the whole way, so the length of the day comes from the distance, not from the road.",
      "Liberia y Manuel Antonio están unidos por dos carreteras principales. La Interamericana recorre las tierras bajas de Guanacaste, pasando por Cañas, rumbo al puerto de Puntarenas, y desde la zona de Caldera la Costanera continúa por Jacó y Parrita hasta Quepos. Todo el camino está pavimentado y es casi plano, así que lo largo del día se debe a la distancia y no a la carretera.",
    ),
    ways: [
      way(
        "bus",
        "There is no direct public bus. By bus the trip takes at least one change, typically in Puntarenas, and a full day.",
        "No hay bus público directo. En bus, el viaje requiere al menos un cambio, normalmente en Puntarenas, y un día completo.",
      ),
      way(
        "shuttle",
        "Shared shuttles run between Liberia and Manuel Antonio at fixed times, with stops at several hotels.",
        "Hay shuttles compartidos entre Liberia y Manuel Antonio en horarios fijos, con paradas en varios hoteles.",
      ),
      way(
        "flight",
        "Liberia and Quepos both have domestic flights, generally by way of San José. Check the airlines' current routes; planes are small and luggage limits are strict.",
        "Liberia y Quepos tienen vuelos nacionales, por lo general pasando por San José. Revise las rutas vigentes de las aerolíneas; los aviones son pequeños y los límites de equipaje son estrictos.",
      ),
      way(
        "car",
        "An easy drive on paved highways, though a long one after a flight. In Manuel Antonio itself a car is little use: parking near the park is scarce.",
        "Un recorrido fácil por carreteras pavimentadas, aunque largo después de un vuelo. En Manuel Antonio mismo un vehículo sirve de poco: hay poco parqueo cerca del parque.",
      ),
    ],
    faqs: [
      q(
        "Isn't San José the airport for Manuel Antonio?",
        "¿El aeropuerto para Manuel Antonio no es San José?",
        "Usually, yes: it is about {time:SJO>ManuelAntonio} from San José, against {time:LIR>ManuelAntonio} from Liberia. This ride makes sense when your flight uses Liberia or when you combine Manuel Antonio with the Guanacaste beaches.",
        "Normalmente sí: queda a {time:SJO>ManuelAntonio} de San José, frente a {time:LIR>ManuelAntonio} desde Liberia. Este traslado conviene cuando su vuelo es por Liberia o cuando combina Manuel Antonio con las playas de Guanacaste.",
      ),
      q(
        "Can we stop to eat between Liberia and Manuel Antonio?",
        "¿Podemos parar a comer entre Liberia y Manuel Antonio?",
        "Yes. Tell your driver when you want a restroom, food or coffee stop; on a ride this long most groups stop at least once.",
        "Sí. Dígale a su conductor cuándo quiere una parada para ir al baño, comer o tomar un café; en un traslado así de largo la mayoría de los grupos para al menos una vez.",
      ),
      q(
        "Is the whole ride done in one day?",
        "¿Todo el traslado se hace en un día?",
        "Yes, in about {time:LIR>ManuelAntonio} plus breaks. A morning start gets you there with daylight to spare.",
        "Sí, en aproximadamente {time:LIR>ManuelAntonio} más las pausas. Saliendo por la mañana, llega con luz de día de sobra.",
      ),
    ],
    ab: {
      lead: l(
        `${MEET} and takes you down the length of the Pacific side to your hotel in Manuel Antonio or Quepos, in one ride and with your luggage in one vehicle.`,
        `${MEET_ES} y lo lleva a lo largo del lado del Pacífico hasta su hotel en Manuel Antonio o Quepos, en un solo traslado y con su equipaje en un solo vehículo.`,
      ),
      faq: q(
        "Our flight lands in Liberia after lunch. Is the ride still a good idea that day?",
        "Nuestro vuelo aterriza en Liberia después de almuerzo. ¿Sigue siendo buena idea hacer el traslado ese día?",
        "It works, but you will arrive after dark. If you would rather see the coast road by day, spend the first night in Guanacaste and travel the next morning. {night}",
        "Funciona, pero llegará de noche. Si prefiere ver la carretera costera de día, pase la primera noche en Guanacaste y viaje a la mañana siguiente. {night}",
      ),
    },
    ba: {
      lead: l(
        "Your driver picks you up at your hotel in Manuel Antonio or Quepos and takes you up the coast and through Guanacaste to Liberia airport.",
        "Su conductor lo recoge en su hotel de Manuel Antonio o Quepos y lo lleva por la costa y a través de Guanacaste hasta el aeropuerto de Liberia.",
      ),
      faq: q(
        "Can we ride to Liberia on the day of our flight home?",
        "¿Podemos hacer el traslado a Liberia el día de nuestro vuelo de regreso?",
        "Only for an evening flight and with an early start: the ride takes about {time:ManuelAntonio>LIR}. Otherwise travel the day before and sleep near the airport or at a nearby beach.",
        "Solo para un vuelo de noche y saliendo temprano: el traslado toma aproximadamente {time:ManuelAntonio>LIR}. Si no, viaje el día anterior y duerma cerca del aeropuerto o en una playa cercana.",
      ),
    },
  },
];
