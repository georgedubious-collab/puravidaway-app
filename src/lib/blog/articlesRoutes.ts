/**
 * Travel guides about one ride: "how to get from A to B" (docs/SEO.md §5, items 1, 2, 4 and 5).
 * Rules and tokens: ./types.ts. Facts reused from the destination guides (src/lib/guides/) and
 * the route pages (src/lib/routes/); bus, shuttle and flight notes stay general on purpose.
 */
import { FIRST_ISSUE, RENTAL_FACTS, classesIntro, faq, includedBlock, l, list, note, p, shuttleMath } from "./shared";
import type { Article } from "./types";

// ───────────────────────── 1. San José → La Fortuna ─────────────────────────
const LA_FORTUNA: Article = {
  slug: "san-jose-to-la-fortuna",
  published: FIRST_ISSUE,
  updated: FIRST_ISSUE,
  photo: "la-fortuna-hot-river",
  title: l(
    "San José to La Fortuna (Arenal): bus, shuttle, private transfer or driving",
    "De San José a La Fortuna (Arenal): bus, shuttle, traslado privado o manejar",
  ),
  short: l("San José to La Fortuna: every option", "De San José a La Fortuna: todas las opciones"),
  metaDescription: l(
    "How to get from San José airport (SJO) to La Fortuna and Arenal Volcano: public bus, shared shuttle, private transfer and rental car compared on time, cost, luggage and comfort, with the real drive time.",
    "Cómo ir del aeropuerto de San José (SJO) a La Fortuna y el volcán Arenal: bus público, shuttle compartido, traslado privado y vehículo de alquiler comparados en tiempo, costo, equipaje y comodidad, con el tiempo de viaje real.",
  ),
  teaser: l("Bus, shuttle, private car or rental: which one suits you", "Bus, shuttle, vehículo privado o alquiler: cuál le conviene"),
  answer: l(
    "Updated {asof}: La Fortuna is about {time:SJO>Arenal} by road from San José airport (SJO), {km:SJO>Arenal} km over the mountains north of the Central Valley. A private transfer costs from {price:SJO>Arenal} for the whole vehicle (green-season price). Shared shuttles charge per seat and run at fixed times; public buses are the cheapest but leave from downtown San José, not the airport; driving yourself is simple, but the mountain stretch is slow.",
    "Actualizado en {asof}: La Fortuna está a unas {time:SJO>Arenal} por carretera del aeropuerto de San José (SJO), {km:SJO>Arenal} km por las montañas al norte del Valle Central. Un traslado privado cuesta desde {price:SJO>Arenal} por el vehículo completo (precio de temporada verde). Los shuttles compartidos cobran por asiento y salen en horarios fijos; el bus público es lo más barato, pero sale del centro de San José, no del aeropuerto; manejar por su cuenta es sencillo, pero el tramo de montaña es lento.",
  ),
  sections: [
    {
      id: "at-a-glance",
      title: l("The four options at a glance", "Las cuatro opciones de un vistazo"),
      blocks: [
        p(
          "Almost every visitor to Costa Rica passes through La Fortuna, the town at the foot of Arenal Volcano, and most arrive from San José's Juan Santamaría airport. There is no wrong way to make the trip; there is only the way that fits your group, your luggage and your landing time. This table sums it up, and the sections below go through each option honestly.",
          "Casi todos los visitantes de Costa Rica pasan por La Fortuna, el pueblo al pie del volcán Arenal, y la mayoría llega desde el aeropuerto Juan Santamaría de San José. No hay una forma equivocada de hacer el viaje; solo está la que mejor calza con su grupo, su equipaje y la hora de su vuelo. Esta tabla lo resume, y las secciones siguientes repasan cada opción con honestidad.",
        ),
        {
          kind: "table",
          caption: l("Ways to travel from San José airport to La Fortuna compared", "Formas de viajar del aeropuerto de San José a La Fortuna comparadas"),
          head: [l("Option", "Opción"), l("Door to door?", "¿Puerta a puerta?"), l("Time", "Tiempo"), l("Cost", "Costo"), l("Best for", "Ideal para")],
          rows: [
            [
              l("Public bus", "Bus público"),
              l("No: leaves from a terminal in downtown San José", "No: sale de una terminal en el centro de San José"),
              l("The longest; some buses change in Ciudad Quesada", "El más largo; algunos buses hacen cambio en Ciudad Quesada"),
              l("The lowest, per seat", "El más bajo, por asiento"),
              l("Budget travellers with light luggage", "Viajeros con presupuesto ajustado y poco equipaje"),
            ],
            [
              l("Shared shuttle", "Shuttle compartido"),
              l("Yes, with stops at other hotels", "Sí, con paradas en otros hoteles"),
              l("Longer than private: several pickups and drop-offs", "Más que el privado: varias recogidas y entregas"),
              l("Per seat; check current fares", "Por asiento; confirme las tarifas vigentes"),
              l("One or two travellers who can match the timetable", "Una o dos personas que se ajustan al horario"),
            ],
            [
              l("Private transfer", "Traslado privado"),
              l("Yes, direct", "Sí, directo"),
              l("About {time:SJO>Arenal}", "Unas {time:SJO>Arenal}"),
              l("From {price:SJO>Arenal} per vehicle", "Desde {price:SJO>Arenal} por vehículo"),
              l("Families and groups, any landing time, stops on the way", "Familias y grupos, cualquier hora de llegada, paradas en el camino"),
            ],
            [
              l("Rental car", "Vehículo de alquiler"),
              l("Yes, after collecting the car", "Sí, después de recoger el vehículo"),
              l("Similar to private, plus the rental paperwork", "Parecido al privado, más el trámite del alquiler"),
              l("Daily rate + mandatory insurance + fuel", "Tarifa diaria + seguro obligatorio + combustible"),
              l("Travellers who want a car for the whole trip", "Quienes quieren vehículo para todo el viaje"),
            ],
          ],
        },
      ],
    },
    {
      id: "the-road",
      title: l("The road: why it takes longer than the map suggests", "La carretera: por qué tarda más de lo que sugiere el mapa"),
      blocks: [
        p(
          "On paper {km:SJO>Arenal} km is a short distance. In practice the road climbs out of the Central Valley on Route 1 past coffee towns such as Grecia and Naranjo, then crosses the mountains either through Ciudad Quesada or via San Ramón and La Tigra before dropping to the green San Carlos plains. The mountain stretch is winding, often misty, and afternoon rain is common, so drivers keep a steady, careful pace. That is why we plan about {time:SJO>Arenal} door to door, not the time a straight highway would suggest.",
          "En el papel, {km:SJO>Arenal} km es poca distancia. En la práctica, la carretera sale del Valle Central por la Ruta 1, pasando por pueblos cafetaleros como Grecia y Naranjo, y luego cruza la montaña por Ciudad Quesada o por San Ramón y La Tigra antes de bajar a las verdes llanuras de San Carlos. El tramo de montaña tiene muchas curvas, a menudo neblina, y la lluvia por la tarde es frecuente, por lo que los conductores mantienen un ritmo constante y prudente. Por eso calculamos unas {time:SJO>Arenal} de puerta a puerta, y no el tiempo que sugeriría una autopista recta.",
        ),
        p(
          "Which of the two mountain roads your driver takes depends on traffic, fog and road works on the day. Both end in the same place. The full ride, with prices by vehicle and the stops on offer, is on the [San José airport to La Fortuna route page](/transfers/sjo-airport-to-la-fortuna-arenal).",
          "Cuál de las dos carreteras de montaña toma su conductor depende del tráfico, la neblina y los trabajos en la vía ese día. Las dos llegan al mismo lugar. El traslado completo, con precios por vehículo y las paradas disponibles, está en la [página de la ruta aeropuerto de San José – La Fortuna](/transfers/sjo-airport-to-la-fortuna-arenal).",
        ),
      ],
    },
    {
      id: "bus",
      title: l("Public bus: the cheapest, with a catch", "Bus público: lo más barato, con una condición"),
      blocks: [
        p(
          "Public buses link downtown San José with La Fortuna, some direct and others with a change in Ciudad Quesada. They are by far the cheapest option and perfectly safe, but they are also the slowest, and the catch for new arrivals is that they leave from a bus terminal in the city, not from the airport. Coming off a flight you first need a taxi or a local bus into San José with your luggage, then the long-distance bus.",
          "Hay buses públicos entre el centro de San José y La Fortuna, algunos directos y otros con cambio en Ciudad Quesada. Son por mucho la opción más barata y perfectamente seguros, pero también los más lentos, y la condición para quien recién llega es que salen de una terminal en la ciudad, no del aeropuerto. Al bajar del avión primero necesita un taxi o un bus local hasta San José con su equipaje, y después el bus de larga distancia.",
        ),
        list(
          ["Confirm the terminal and the departure times shortly before you travel: both change.", "Confirme la terminal y los horarios poco antes de viajar: ambos cambian."],
          ["Keep valuables with you, not in the luggage hold or the rack above your seat.", "Mantenga sus objetos de valor con usted, no en la bodega ni en la parrilla sobre su asiento."],
          ["Buses do not wait for delayed flights, so leave a wide margin if you go straight from the airport.", "Los buses no esperan vuelos atrasados, así que deje un margen amplio si va directo desde el aeropuerto."],
        ),
      ],
    },
    {
      id: "shuttle",
      title: l("Shared shuttle: door to door, on someone else's timetable", "Shuttle compartido: puerta a puerta, con el horario de otros"),
      blocks: [
        p(
          "Shared shuttles are air-conditioned vans that run between San José and La Fortuna at fixed times, usually once or twice a day, picking up and dropping off travellers at several hotels. You book a seat in advance and pay per person. They are comfortable and simple, but the ride is longer than the drive itself because of the other stops, and if your flight lands after the last departure you wait until the next day.",
          "Los shuttles compartidos son microbuses con aire acondicionado que viajan entre San José y La Fortuna en horarios fijos, normalmente una o dos veces al día, y recogen y dejan viajeros en varios hoteles. Se reserva un asiento con anticipación y se paga por persona. Son cómodos y sencillos, pero el viaje dura más que el recorrido en sí por las demás paradas, y si su vuelo aterriza después de la última salida, tendrá que esperar al día siguiente.",
        ),
        shuttleMath("SJO", "Arenal"),
      ],
    },
    {
      id: "private",
      title: l("Private transfer: what you get for the price", "Traslado privado: lo que recibe por el precio"),
      blocks: [
        p(
          "A private transfer is a car or van with a local driver for your group only, from the airport (or your San José hotel) straight to your hotel door in La Fortuna, at the time you choose.",
          "Un traslado privado es un vehículo con conductor local solo para su grupo, del aeropuerto (o de su hotel en San José) directo a la puerta de su hotel en La Fortuna, a la hora que usted elija.",
        ),
        includedBlock(true),
        classesIntro("SJO", "Arenal"),
        { kind: "classes", origin: "SJO", destination: "Arenal" },
        p(
          "The drive can also be part of the trip. Poás Volcano is a detour into the mountains above the airport (entry is by timed ticket booked in advance, and clouds often hide the crater later in the day), and a highland coffee farm or the sloth trail in La Fortuna itself can be added too. Each stop shows its length and price in the trip builder, and your luggage stays locked in the vehicle with your driver.",
          "El recorrido también puede ser parte del viaje. El volcán Poás es un desvío hacia las montañas sobre el aeropuerto (la entrada es con boleto de horario fijo reservado con anticipación, y las nubes suelen tapar el cráter conforme avanza el día), y también se pueden agregar una finca de café de altura o el sendero de perezosos en La Fortuna misma. Cada parada muestra su duración y su precio en el planificador de viajes, y su equipaje queda bajo llave en el vehículo con su conductor.",
        ),
      ],
    },
    {
      id: "driving",
      title: l("Driving yourself", "Manejar por su cuenta"),
      blocks: [
        p(
          "The road to La Fortuna is paved all the way and easy to follow with a navigation app. A rental car makes sense if you want one for the rest of your trip anyway. Before you compare it with a transfer, count the full cost:",
          "La carretera a La Fortuna está pavimentada en todo el recorrido y es fácil de seguir con una aplicación de navegación. Un vehículo de alquiler tiene sentido si de todas formas lo quiere para el resto del viaje. Antes de compararlo con un traslado, cuente el costo completo:",
        ),
        RENTAL_FACTS,
        p(
          "Many travellers mix the two: a private transfer for the long first leg after a long flight, and a car later, once they know the roads.",
          "Muchos viajeros combinan las dos cosas: un traslado privado para el primer tramo largo después de un vuelo largo, y un vehículo más adelante, cuando ya conocen las carreteras.",
        ),
      ],
    },
    {
      id: "which",
      title: l("Which one should you choose?", "¿Cuál le conviene?"),
      blocks: [
        list(
          ["Solo, on a tight budget, landing in the morning: the public bus, if you don't mind the trip into San José first.", "Si viaja solo, con presupuesto ajustado y aterriza en la mañana: el bus público, si no le molesta ir primero hasta San José."],
          ["One or two people whose flight matches a departure: a shared shuttle.", "Una o dos personas cuyo vuelo calza con una salida: un shuttle compartido."],
          ["Three or more people, children, lots of luggage, a late or early flight, or stops on the way: a private transfer.", "Tres personas o más, niños, mucho equipaje, un vuelo muy tarde o muy temprano, o paradas en el camino: un traslado privado."],
          ["You want a car for the whole trip and are comfortable on mountain roads: a rental, picked up in daylight.", "Quiere vehículo para todo el viaje y se siente cómodo en carreteras de montaña: un alquiler, recogido con luz de día."],
        ),
      ],
    },
    {
      id: "from-liberia",
      title: l("Landing in Liberia instead, and where to go next", "Si aterriza en Liberia, y a dónde ir después"),
      blocks: [
        p(
          "La Fortuna is about as far from Liberia airport (LIR) as from San José, so choose the airport by flight price and by the rest of your route; our [guide to choosing between SJO and LIR](/guides/sjo-or-liberia-which-airport) compares them. From La Fortuna most travellers continue to Monteverde or to the Pacific coast:",
          "La Fortuna queda casi tan lejos del aeropuerto de Liberia (LIR) como del de San José, así que elija el aeropuerto por el precio del vuelo y por el resto de su ruta; nuestra [guía para elegir entre SJO y LIR](/guides/sjo-or-liberia-which-airport) los compara. Desde La Fortuna la mayoría continúa hacia Monteverde o la costa del Pacífico:",
        ),
        {
          kind: "rides",
          caption: l("Rides to and from La Fortuna: drive times and prices", "Traslados desde y hacia La Fortuna: tiempos y precios"),
          rows: [
            { origin: "SJO", destination: "Arenal" },
            { origin: "LIR", destination: "Arenal" },
            { origin: "Arenal", destination: "Monteverde" },
            { origin: "Arenal", destination: "ManuelAntonio" },
            { origin: "Arenal", destination: "Tamarindo" },
          ],
        },
        p(
          "For things to do, the best time to go and where to stay by area, see the [La Fortuna and Arenal destination guide](/destinations/la-fortuna). Our private [day tours](/?tab=tours) include a day of Arenal's lava trails, the La Fortuna Waterfall and hot springs.",
          "Para saber qué hacer, la mejor época y dónde hospedarse por zona, vea la [guía de destino de La Fortuna y Arenal](/destinations/la-fortuna). Nuestros [tours privados de un día](/?tab=tours) incluyen un día por los senderos de lava del Arenal, la catarata de La Fortuna y aguas termales.",
        ),
      ],
    },
  ],
  faqs: [
    faq(
      "How long is the drive from San José airport to La Fortuna?",
      "¿Cuánto dura el viaje del aeropuerto de San José a La Fortuna?",
      "About {time:SJO>Arenal} door to door by private car ({km:SJO>Arenal} km). Rain, fog on the mountain stretch and Central Valley traffic can add time; buses and shared shuttles take longer.",
      "Unas {time:SJO>Arenal} de puerta a puerta en vehículo privado ({km:SJO>Arenal} km). La lluvia, la neblina en el tramo de montaña y el tráfico del Valle Central pueden sumar tiempo; el bus y los shuttles compartidos tardan más.",
    ),
    faq(
      "What is the cheapest way from San José to La Fortuna?",
      "¿Cuál es la forma más barata de ir de San José a La Fortuna?",
      "The public bus from downtown San José. Remember to add the taxi or local bus from the airport into the city, and confirm the terminal and timetable before you travel.",
      "El bus público desde el centro de San José. Recuerde sumar el taxi o el bus local del aeropuerto a la ciudad, y confirme la terminal y el horario antes de viajar.",
    ),
    faq(
      "Is there a bus from SJO airport straight to La Fortuna?",
      "¿Hay un bus directo del aeropuerto SJO a La Fortuna?",
      "Not from the terminal. Long-distance buses to La Fortuna leave from a bus terminal in downtown San José, so you first need to get into the city.",
      "No desde la terminal aérea. Los buses de larga distancia a La Fortuna salen de una terminal en el centro de San José, así que primero debe llegar a la ciudad.",
    ),
    faq(
      "For a family of four, is a shared shuttle or a private transfer better value?",
      "Para una familia de cuatro, ¿conviene más un shuttle compartido o un traslado privado?",
      "Multiply the shuttle's seat price by four and compare it with the private price for a vehicle that fits four travellers and their luggage. The totals are often close, and the private ride leaves when you land, goes straight to your hotel and can stop on the way.",
      "Multiplique el precio del asiento en el shuttle por cuatro y compárelo con el precio privado de un vehículo para cuatro viajeros con su equipaje. Los totales suelen ser parecidos, y el traslado privado sale cuando usted aterriza, va directo a su hotel y puede parar en el camino.",
    ),
    faq(
      "Can we visit Poás Volcano on the way to La Fortuna?",
      "¿Podemos visitar el volcán Poás camino a La Fortuna?",
      "Yes, as a stop on a private transfer. Poás uses timed-entry tickets that must be booked in advance, and the crater is usually clearest in the morning, so pick an entry time that matches your pickup.",
      "Sí, como parada en un traslado privado. El Poás usa entradas con horario asignado que se reservan con anticipación, y el cráter suele estar más despejado en la mañana, así que elija una hora de ingreso que calce con su recogida.",
    ),
    faq(
      "Our flight lands at night. Can we still go to La Fortuna?",
      "Nuestro vuelo aterriza de noche. ¿Podemos ir igual a La Fortuna?",
      "Yes. {night} The mountain road is slower in the dark and fog, so some travellers prefer a night near the airport and an early start.",
      "Sí. {night} La carretera de montaña es más lenta de noche y con neblina, así que algunos viajeros prefieren pasar la noche cerca del aeropuerto y salir temprano.",
    ),
    faq(
      "Is the price of a private transfer per person?",
      "¿El precio del traslado privado es por persona?",
      "No. {price:SJO>Arenal} is the green-season price of the whole vehicle in the cheapest class, for up to {pax:SJO>Arenal} travellers. The exact price for your date, vehicle and stops is shown before you book.",
      "No. {price:SJO>Arenal} es el precio de temporada verde del vehículo completo en la categoría más económica, para hasta {pax:SJO>Arenal} viajeros. El precio exacto para su fecha, vehículo y paradas aparece antes de reservar.",
    ),
  ],
  book: { origin: "SJO", destination: "Arenal" },
  about: { hubPairs: [["SJO", "Arenal"]], hubs: ["Arenal", "SJO"] },
  related: ["/transfers/sjo-airport-to-la-fortuna-arenal", "/transfers/la-fortuna-to-sjo-airport", "/destinations/la-fortuna", "/airports/sjo", "/transfers/la-fortuna-to-monteverde"],
};

// ───────────────────────── 2. San José → Manuel Antonio ─────────────────────────
const MANUEL_ANTONIO: Article = {
  slug: "san-jose-to-manuel-antonio",
  published: FIRST_ISSUE,
  updated: FIRST_ISSUE,
  photo: "manuel-antonio-sunset",
  title: l(
    "San José to Manuel Antonio: every option, drive time and cost",
    "De San José a Manuel Antonio: todas las opciones, tiempo de viaje y costo",
  ),
  short: l("San José to Manuel Antonio: every option", "De San José a Manuel Antonio: todas las opciones"),
  metaDescription: l(
    "How to get from San José airport (SJO) to Manuel Antonio and Quepos: the real drive time on Route 27 and the coastal highway, public bus, shared shuttle, domestic flight, private transfer and rental car compared.",
    "Cómo ir del aeropuerto de San José (SJO) a Manuel Antonio y Quepos: el tiempo real por la Ruta 27 y la Costanera, bus público, shuttle compartido, vuelo nacional, traslado privado y vehículo de alquiler comparados.",
  ),
  teaser: l("Highway, crocodiles on the way and park tickets", "Autopista, cocodrilos en el camino y entradas al parque"),
  answer: l(
    "Updated {asof}: Manuel Antonio is about {time:SJO>ManuelAntonio} by road from San José airport (SJO), {km:SJO>ManuelAntonio} km on highways all the way. A private transfer costs from {price:SJO>ManuelAntonio} for the whole vehicle (green-season price). Public buses and shared shuttles cost less per seat and take longer; small planes fly to Quepos; driving is easy, but a car is of little use once you are there.",
    "Actualizado en {asof}: Manuel Antonio está a unas {time:SJO>ManuelAntonio} por carretera del aeropuerto de San José (SJO), {km:SJO>ManuelAntonio} km por carretera principal todo el camino. Un traslado privado cuesta desde {price:SJO>ManuelAntonio} por el vehículo completo (precio de temporada verde). El bus público y los shuttles compartidos cuestan menos por asiento y tardan más; hay avionetas a Quepos; manejar es sencillo, pero allá un vehículo sirve de poco.",
  ),
  sections: [
    {
      id: "at-a-glance",
      title: l("Five ways to get there", "Cinco formas de llegar"),
      blocks: [
        p(
          "Manuel Antonio is a forested hill on the Central Pacific coast that drops to white-sand beaches and one of Costa Rica's most visited national parks. Quepos, at the foot of the hill, is the working town with the marina, the banks and the bus terminal. From San José you have five realistic ways to get there:",
          "Manuel Antonio es una colina boscosa en el Pacífico Central que baja hasta playas de arena blanca y uno de los parques nacionales más visitados de Costa Rica. Quepos, al pie de la colina, es la ciudad con la marina, los bancos y la terminal de buses. Desde San José hay cinco formas realistas de llegar:",
        ),
        {
          kind: "table",
          caption: l("Ways to travel from San José to Manuel Antonio compared", "Formas de viajar de San José a Manuel Antonio comparadas"),
          head: [l("Option", "Opción"), l("From the airport?", "¿Desde el aeropuerto?"), l("Time", "Tiempo"), l("Cost", "Costo"), l("Watch out for", "Tenga en cuenta")],
          rows: [
            [
              l("Public bus", "Bus público"),
              l("No: a terminal in downtown San José", "No: una terminal en el centro de San José"),
              l("Longer than by car; some buses are direct", "Más que en vehículo; algunos buses son directos"),
              l("The lowest, per seat", "El más bajo, por asiento"),
              l("Getting to the terminal with luggage", "Llegar a la terminal con el equipaje"),
            ],
            [
              l("Shared shuttle", "Shuttle compartido"),
              l("Yes, at fixed times", "Sí, en horarios fijos"),
              l("Longer than private: other hotels on the way", "Más que el privado: otros hoteles en el camino"),
              l("Per seat; check current fares", "Por asiento; confirme las tarifas vigentes"),
              l("Your flight must match a departure", "Su vuelo debe calzar con una salida"),
            ],
            [
              l("Domestic flight", "Vuelo nacional"),
              l("From a small terminal next to the international one", "Desde una terminal pequeña junto a la internacional"),
              l("A short flight, plus check-in and the ride from the airstrip", "Un vuelo corto, más el registro y el traslado desde el aeródromo"),
              l("Per seat; check the airline", "Por asiento; consulte la aerolínea"),
              l("Strict luggage limits; schedules change by season", "Límites estrictos de equipaje; horarios que cambian según la temporada"),
            ],
            [
              l("Private transfer", "Traslado privado"),
              l("Yes, door to door", "Sí, puerta a puerta"),
              l("About {time:SJO>ManuelAntonio}", "Unas {time:SJO>ManuelAntonio}"),
              l("From {price:SJO>ManuelAntonio} per vehicle", "Desde {price:SJO>ManuelAntonio} por vehículo"),
              l("Weekend traffic on Route 27", "El tráfico de fin de semana en la Ruta 27"),
            ],
            [
              l("Rental car", "Vehículo de alquiler"),
              l("Yes, after collecting the car", "Sí, después de recoger el vehículo"),
              l("Similar to private", "Parecido al privado"),
              l("Daily rate + mandatory insurance + fuel + tolls", "Tarifa diaria + seguro obligatorio + combustible + peajes"),
              l("Little use once in Manuel Antonio; scarce parking", "Sirve de poco ya en Manuel Antonio; poco parqueo"),
            ],
          ],
        },
      ],
    },
    {
      id: "the-road",
      title: l("The road: highways, and one thing that slows them down", "La carretera: autopistas, y algo que las vuelve lentas"),
      blocks: [
        p(
          "This is one of the easiest long drives in the country. Route 27, a toll highway, takes you from the Central Valley down to the Pacific at Orotina; the coastal highway (the Costanera Sur) then follows the shore past Jacó and the oil-palm plantations around Parrita to Quepos, and the last few kilometres climb the hill road to Manuel Antonio's hotels. We plan about {time:SJO>ManuelAntonio} door to door.",
          "Es uno de los recorridos largos más sencillos del país. La Ruta 27, una autopista con peajes, baja del Valle Central al Pacífico en Orotina; luego la Costanera Sur sigue la costa, pasando por Jacó y las plantaciones de palma aceitera de los alrededores de Parrita, hasta Quepos, y los últimos kilómetros suben por la carretera de la colina hasta los hoteles de Manuel Antonio. Calculamos unas {time:SJO>ManuelAntonio} de puerta a puerta.",
        ),
        p(
          "The one thing that changes the picture is traffic: Route 27 fills up on Friday afternoons, Sunday evenings and holidays, when half of San José heads for the beach and back, and that can add an hour. If you are flying home from Manuel Antonio, leave earlier than the drive time alone suggests. Prices by vehicle and the stops on offer are on the [San José airport to Manuel Antonio route page](/transfers/sjo-airport-to-manuel-antonio).",
          "Lo único que cambia el panorama es el tráfico: la Ruta 27 se llena los viernes por la tarde, los domingos al final del día y en feriados, cuando media San José va y vuelve de la playa, y eso puede sumar una hora. Si regresa a su vuelo desde Manuel Antonio, salga con más margen del que indica el tiempo de viaje. Los precios por vehículo y las paradas disponibles están en la [página de la ruta aeropuerto de San José – Manuel Antonio](/transfers/sjo-airport-to-manuel-antonio).",
        ),
      ],
    },
    {
      id: "bus-and-shuttle",
      title: l("Public bus and shared shuttle", "Bus público y shuttle compartido"),
      blocks: [
        p(
          "Public buses run between downtown San José and Quepos / Manuel Antonio, some of them direct. They are cheap and comfortable enough, but they leave from a terminal in the city, not from the airport. Once you are in Quepos, a frequent local bus runs over the hill to the beach and the park entrance. Confirm the terminal and the timetable shortly before you travel.",
          "Hay buses públicos entre el centro de San José y Quepos / Manuel Antonio, algunos directos. Son baratos y razonablemente cómodos, pero salen de una terminal en la ciudad, no del aeropuerto. Ya en Quepos, un bus local frecuente cruza la colina hasta la playa y la entrada del parque. Confirme la terminal y el horario poco antes de viajar.",
        ),
        p(
          "Shared shuttles run the route at fixed times and call at several hotels at each end. They are the middle ground: door to door, but on a timetable and with other travellers' stops.",
          "Los shuttles compartidos hacen la ruta en horarios fijos y pasan por varios hoteles en cada extremo. Son el punto intermedio: puerta a puerta, pero con horario y con las paradas de otros viajeros.",
        ),
        shuttleMath("SJO", "ManuelAntonio"),
      ],
    },
    {
      id: "flight",
      title: l("Flying to Quepos", "Volar a Quepos"),
      blocks: [
        p(
          "Domestic flights connect San José with the Quepos airstrip, a short ride from the hotels. They save road time, but planes are small, luggage limits are strict, and you still have check-in, the wait and a ride at the other end. Schedules change by season, so check the airline's current timetable and leave a generous connection after an international arrival.",
          "Hay vuelos nacionales entre San José y el aeródromo de Quepos, a pocos minutos de los hoteles. Ahorran tiempo de carretera, pero los aviones son pequeños, los límites de equipaje son estrictos, y además están el registro, la espera y un traslado al llegar. Los horarios cambian según la temporada: revise el itinerario vigente de la aerolínea y deje una conexión holgada después de un vuelo internacional.",
        ),
      ],
    },
    {
      id: "private",
      title: l("Private transfer, with crocodiles on the way", "Traslado privado, con cocodrilos en el camino"),
      blocks: [
        includedBlock(true),
        classesIntro("SJO", "ManuelAntonio"),
        { kind: "classes", origin: "SJO", destination: "ManuelAntonio" },
        p(
          "Two of the best wildlife stops in the country are right on this road. The Tárcoles bridge, on the coastal highway, is famous for the large crocodiles resting on the riverbanks below it, and Carara National Park next to it is one of the best places to see scarlet macaws. Both add very little driving. Add them in the trip builder (each shows its length and price), and your luggage stays locked in the vehicle while your driver waits with it.",
          "Dos de las mejores paradas de vida silvestre del país están sobre esta carretera. El puente de Tárcoles, sobre la Costanera, es famoso por los grandes cocodrilos que descansan en las orillas del río, y el Parque Nacional Carara, al lado, es uno de los mejores lugares para ver lapas rojas. Las dos casi no suman recorrido. Agréguelas en el planificador de viajes (cada una muestra su duración y su precio), y su equipaje queda bajo llave en el vehículo mientras su conductor espera con él.",
        ),
      ],
    },
    {
      id: "driving",
      title: l("Driving yourself", "Manejar por su cuenta"),
      blocks: [
        p(
          "The roads are good paved highways and easy to follow. The catch is at the other end: around Manuel Antonio a car is of little use, because the hill road is narrow, parking near the park is scarce, and the local bus and taxis are frequent. If you rent, count the full cost:",
          "Las carreteras son buenas autopistas pavimentadas y fáciles de seguir. La condición está al llegar: en Manuel Antonio un vehículo sirve de poco, porque la carretera de la colina es angosta, hay poco parqueo cerca del parque, y el bus local y los taxis pasan con frecuencia. Si alquila, cuente el costo completo:",
        ),
        RENTAL_FACTS,
      ],
    },
    {
      id: "before-you-go",
      title: l("Before you go: national park tickets", "Antes de ir: entradas al parque nacional"),
      blocks: [
        note(
          "Manuel Antonio National Park is closed on Tuesdays. Tickets are sold online only, in advance, for a set entry time, and the number of visitors per day is limited; they are not sold at the gate. Buy them as soon as your dates are fixed, especially from December to April, and check the national parks service (SINAC) for current rules and prices.",
          "El Parque Nacional Manuel Antonio cierra los martes. Las entradas se venden solo en línea, con anticipación y para una hora de ingreso, y el cupo diario es limitado; no se venden en la entrada. Cómprelas apenas tenga sus fechas, sobre todo de diciembre a abril, y consulte las reglas y los precios vigentes en el Sistema Nacional de Áreas de Conservación (SINAC).",
        ),
        p(
          "Plan your arrival day around it: if you land in the morning and your park day is a Tuesday, move it. For areas to stay, the best season and things to do, read the [Manuel Antonio destination guide](/destinations/manuel-antonio); our private [day tours](/?tab=tours) include a guided wildlife walk in the park with a catamaran and snorkelling.",
          "Planifique su día de llegada en función de eso: si aterriza en la mañana y su día de parque cae martes, cámbielo. Para zonas donde hospedarse, la mejor época y qué hacer, lea la [guía de destino de Manuel Antonio](/destinations/manuel-antonio); nuestros [tours privados de un día](/?tab=tours) incluyen una caminata guiada de vida silvestre en el parque con catamarán y snorkel.",
        ),
        {
          kind: "rides",
          caption: l("Rides to and from Manuel Antonio: drive times and prices", "Traslados desde y hacia Manuel Antonio: tiempos y precios"),
          rows: [
            { origin: "SJO", destination: "ManuelAntonio" },
            { origin: "Arenal", destination: "ManuelAntonio" },
            { origin: "Monteverde", destination: "ManuelAntonio" },
            { origin: "LIR", destination: "ManuelAntonio" },
          ],
        },
      ],
    },
  ],
  faqs: [
    faq(
      "How far is Manuel Antonio from San José airport?",
      "¿Qué tan lejos queda Manuel Antonio del aeropuerto de San José?",
      "{km:SJO>ManuelAntonio} km by road, about {time:SJO>ManuelAntonio} door to door by private car. Weekend and holiday traffic on Route 27 can add an hour.",
      "{km:SJO>ManuelAntonio} km por carretera, unas {time:SJO>ManuelAntonio} de puerta a puerta en vehículo privado. El tráfico de fines de semana y feriados en la Ruta 27 puede sumar una hora.",
    ),
    faq(
      "Is there a direct bus from San José to Manuel Antonio?",
      "¿Hay bus directo de San José a Manuel Antonio?",
      "Yes, some public buses run direct from a terminal in downtown San José to Quepos and Manuel Antonio. They do not leave from the airport, and timetables change, so confirm them before you travel.",
      "Sí, algunos buses públicos van directo desde una terminal en el centro de San José hasta Quepos y Manuel Antonio. No salen del aeropuerto, y los horarios cambian: confírmelos antes de viajar.",
    ),
    faq(
      "Is it worth flying to Quepos?",
      "¿Vale la pena volar a Quepos?",
      "Sometimes, for travellers with little luggage and a tight schedule. With check-in, waiting and the ride from the airstrip, the time saved is smaller than it looks, and luggage limits are strict.",
      "A veces, para quienes llevan poco equipaje y tienen poco tiempo. Con el registro, la espera y el traslado desde el aeródromo, el tiempo ahorrado es menor de lo que parece, y los límites de equipaje son estrictos.",
    ),
    faq(
      "Can we see the crocodiles on the way?",
      "¿Podemos ver los cocodrilos en el camino?",
      "Yes. The Tárcoles bridge is right on the coastal highway, so it is an easy stop on a private transfer, and Carara's macaw walk is next to it.",
      "Sí. El puente de Tárcoles está sobre la Costanera, así que es una parada fácil en un traslado privado, y la caminata para ver lapas en Carara queda al lado.",
    ),
    faq(
      "Do I need a car in Manuel Antonio?",
      "¿Necesito vehículo en Manuel Antonio?",
      "No. The local bus between Quepos and the park is frequent, taxis are easy to find and parking near the park is scarce.",
      "No. El bus local entre Quepos y el parque pasa con frecuencia, es fácil conseguir taxi y hay poco parqueo cerca del parque.",
    ),
    faq(
      "Can we land in the afternoon and reach Manuel Antonio the same day?",
      "¿Podemos aterrizar en la tarde y llegar a Manuel Antonio el mismo día?",
      "Yes. The drive is about {time:SJO>ManuelAntonio} on highways, so an afternoon landing simply means arriving in the evening. {night}",
      "Sí. El recorrido es de unas {time:SJO>ManuelAntonio} por autopista, así que aterrizar en la tarde solo significa llegar al anochecer. {night}",
    ),
    faq(
      "Is the park open every day?",
      "¿El parque abre todos los días?",
      "No. Manuel Antonio National Park is closed on Tuesdays, and tickets are sold online only, in advance, for a set entry time.",
      "No. El Parque Nacional Manuel Antonio cierra los martes, y las entradas se venden solo en línea, con anticipación y para una hora de ingreso.",
    ),
  ],
  book: { origin: "SJO", destination: "ManuelAntonio" },
  about: { hubPairs: [["SJO", "ManuelAntonio"]], hubs: ["ManuelAntonio", "SJO"] },
  related: ["/transfers/sjo-airport-to-manuel-antonio", "/transfers/manuel-antonio-to-sjo-airport", "/destinations/manuel-antonio", "/airports/sjo", "/transfers/la-fortuna-to-manuel-antonio"],
};

// ───────────────────────── 3. San José → Monteverde ─────────────────────────
const MONTEVERDE: Article = {
  slug: "san-jose-to-monteverde",
  published: FIRST_ISSUE,
  updated: FIRST_ISSUE,
  photo: "monteverde",
  title: l(
    "San José to Monteverde: the road, the drive time, bus and shuttle",
    "De San José a Monteverde: la carretera, el tiempo de viaje, bus y shuttle",
  ),
  short: l("San José to Monteverde: the road", "De San José a Monteverde: la carretera"),
  metaDescription: l(
    "How to get from San José airport (SJO) to Monteverde: what the mountain road is really like today, the realistic drive time, public bus, shared shuttle, private transfer and driving yourself, and tips for the climb.",
    "Cómo ir del aeropuerto de San José (SJO) a Monteverde: cómo es hoy la carretera de montaña, el tiempo de viaje realista, bus público, shuttle compartido, traslado privado y manejar por su cuenta, y consejos para la subida.",
  ),
  teaser: l("The climb to the cloud forest, explained", "La subida al bosque nuboso, explicada"),
  answer: l(
    "Updated {asof}: Monteverde is about {time:SJO>Monteverde} by road from San José airport (SJO), {km:SJO>Monteverde} km, and the last stretch is a steep, winding mountain climb. There are no flights. A private transfer costs from {price:SJO>Monteverde} for the whole vehicle (green-season price); direct public buses leave from downtown San José, and shared shuttles run at fixed times.",
    "Actualizado en {asof}: Monteverde está a unas {time:SJO>Monteverde} por carretera del aeropuerto de San José (SJO), {km:SJO>Monteverde} km, y el último tramo es una subida de montaña empinada y con curvas. No hay vuelos. Un traslado privado cuesta desde {price:SJO>Monteverde} por el vehículo completo (precio de temporada verde); hay buses públicos directos desde el centro de San José, y shuttles compartidos en horarios fijos.",
  ),
  sections: [
    {
      id: "the-road",
      title: l("The road, step by step", "La carretera, paso a paso"),
      blocks: [
        p(
          "Monteverde is a string of small communities around the town of Santa Elena, about 1,400 m above sea level, surrounded by cloud forest reserves. Everyone arrives by road, and the road has a reputation. Here is what it is like today:",
          "Monteverde es una serie de pequeñas comunidades alrededor del pueblo de Santa Elena, a unos 1.400 m sobre el nivel del mar, rodeadas de reservas de bosque nuboso. Todos llegan por carretera, y la carretera tiene su fama. Así es hoy:",
        ),
        list(
          ["From the airport, Route 27 takes you down from the Central Valley toward the Pacific side.", "Desde el aeropuerto, la Ruta 27 baja del Valle Central hacia el lado del Pacífico."],
          ["The Inter-American Highway (Route 1) then runs north through hot, dry lowland cattle country.", "Luego la Interamericana (Ruta 1) sigue al norte por tierras bajas, calurosas y secas, de fincas ganaderas."],
          [
            "The last stretch is Route 606 through Guacimal, climbing from the lowlands to Santa Elena. It is paved now, but narrow, steep and full of tight curves, with fog and, in the dry season, strong winds.",
            "El último tramo es la Ruta 606 por Guacimal, que sube desde las tierras bajas hasta Santa Elena. Hoy está asfaltada, pero es angosta, empinada y llena de curvas cerradas, con neblina y, en la época seca, vientos fuertes.",
          ],
          ["Many side roads to hotels and reserves around Monteverde are still steep gravel.", "Muchos caminos secundarios a hoteles y reservas alrededor de Monteverde siguen siendo de lastre y empinados."],
        ),
        p(
          "That last climb sets the pace, which is why we plan about {time:SJO>Monteverde} door to door even though the distance is only {km:SJO>Monteverde} km. The way down is not much faster: the same curves set the pace in both directions. Prices by vehicle are on the [San José airport to Monteverde route page](/transfers/sjo-airport-to-monteverde).",
          "Esa última subida marca el ritmo, y por eso calculamos unas {time:SJO>Monteverde} de puerta a puerta aunque la distancia es de solo {km:SJO>Monteverde} km. La bajada no es mucho más rápida: las mismas curvas marcan el ritmo en los dos sentidos. Los precios por vehículo están en la [página de la ruta aeropuerto de San José – Monteverde](/transfers/sjo-airport-to-monteverde).",
        ),
      ],
    },
    {
      id: "options",
      title: l("Your options compared", "Sus opciones comparadas"),
      blocks: [
        {
          kind: "table",
          caption: l("Ways to travel from San José to Monteverde compared", "Formas de viajar de San José a Monteverde comparadas"),
          head: [l("Option", "Opción"), l("From the airport?", "¿Desde el aeropuerto?"), l("Time", "Tiempo"), l("Cost", "Costo"), l("Good to know", "Conviene saber")],
          rows: [
            [
              l("Public bus", "Bus público"),
              l("No: a terminal in downtown San José", "No: una terminal en el centro de San José"),
              l("Most of a morning or afternoon", "Buena parte de una mañana o una tarde"),
              l("The lowest, per seat", "El más bajo, por asiento"),
              l("Seats can sell out in high season", "En temporada alta los asientos pueden agotarse"),
            ],
            [
              l("Shared shuttle", "Shuttle compartido"),
              l("Yes, at fixed times", "Sí, en horarios fijos"),
              l("Longer than private: hotel pickups on the way", "Más que el privado: recogidas en hoteles por el camino"),
              l("Per seat; check current fares", "Por asiento; confirme las tarifas vigentes"),
              l("Book ahead; match your flight to a departure", "Reserve con anticipación; su vuelo debe calzar con una salida"),
            ],
            [
              l("Private transfer", "Traslado privado"),
              l("Yes, door to door", "Sí, puerta a puerta"),
              l("About {time:SJO>Monteverde}", "Unas {time:SJO>Monteverde}"),
              l("From {price:SJO>Monteverde} per vehicle", "Desde {price:SJO>Monteverde} por vehículo"),
              l("Stops whenever you need a break", "Paradas cada vez que necesite un descanso"),
            ],
            [
              l("Rental car", "Vehículo de alquiler"),
              l("Yes, after collecting the car", "Sí, después de recoger el vehículo"),
              l("Similar to private", "Parecido al privado"),
              l("Daily rate + mandatory insurance + fuel", "Tarifa diaria + seguro obligatorio + combustible"),
              l("Good clearance helps on gravel side roads", "Un vehículo alto ayuda en los caminos de lastre"),
            ],
            [
              l("Flight", "Vuelo"),
              l("—", "—"),
              l("—", "—"),
              l("—", "—"),
              l("There is no airport in Monteverde", "Monteverde no tiene aeropuerto"),
            ],
          ],
        },
      ],
    },
    {
      id: "bus-and-shuttle",
      title: l("Bus and shuttle", "Bus y shuttle"),
      blocks: [
        p(
          "Direct public buses link downtown San José with Santa Elena, and there are also buses from Puntarenas and other lowland towns. They are the cheapest way up, but they leave from a terminal in the city, not the airport, and seats can sell out in high season, so buy your ticket early and confirm the terminal and timetable before you travel.",
          "Hay buses públicos directos del centro de San José a Santa Elena, y también buses desde Puntarenas y otros pueblos de las tierras bajas. Son la forma más barata de subir, pero salen de una terminal en la ciudad, no del aeropuerto, y en temporada alta los asientos pueden agotarse, así que compre su boleto con tiempo y confirme la terminal y el horario antes de viajar.",
        ),
        p(
          "Shared shuttles run between San José and Monteverde at fixed times, with pickups at several hotels along the way. They take you to your hotel door, which matters here because many hotels are up gravel side roads.",
          "Los shuttles compartidos viajan entre San José y Monteverde en horarios fijos, con recogidas en varios hoteles por el camino. Lo dejan en la puerta de su hotel, algo importante aquí porque muchos hoteles quedan en caminos de lastre.",
        ),
        shuttleMath("SJO", "Monteverde"),
      ],
    },
    {
      id: "private",
      title: l("Private transfer: drivers who know the climb", "Traslado privado: conductores que conocen la subida"),
      blocks: [
        p(
          "Our partner drivers do the Monteverde climb regularly and drive it at a safe pace. Tell your driver when you want a restroom, coffee or snack stop: there are good places along the highway before the climb.",
          "Nuestros conductores asociados hacen la subida a Monteverde con frecuencia y la manejan a un ritmo seguro. Dígale a su conductor cuándo quiere una parada para ir al baño, tomar un café o comer algo: hay buenos lugares a lo largo de la carretera antes de la subida.",
        ),
        includedBlock(true),
        classesIntro("SJO", "Monteverde"),
        { kind: "classes", origin: "SJO", destination: "Monteverde" },
        p(
          "The two sightseeing stops offered on this ride, the Tárcoles crocodile bridge and Carara's macaw walk, are on the coastal highway south of the direct road, so they mean a detour toward Jacó and back; the trip builder shows the extra time and price before you add them.",
          "Las dos paradas turísticas que se ofrecen en este traslado, el puente de los cocodrilos de Tárcoles y la caminata de las lapas en Carara, están sobre la Costanera, al sur de la carretera directa, así que implican un desvío hacia Jacó y de vuelta; el planificador de viajes muestra el tiempo y el precio adicionales antes de agregarlas.",
        ),
      ],
    },
    {
      id: "driving",
      title: l("Driving yourself up the mountain", "Subir la montaña manejando"),
      blocks: [
        p(
          "The main climb is paved and the route is easy to follow, but take it slowly: tight curves, oncoming trucks and buses, fog and wind are normal. Arrive in daylight if you can, and remember that many hotel driveways are steep gravel where a vehicle with good clearance helps. The usual rental costs apply:",
          "La subida principal está pavimentada y la ruta es fácil de seguir, pero tómela con calma: las curvas cerradas, los camiones y buses en sentido contrario, la neblina y el viento son normales. Si puede, llegue con luz de día, y recuerde que muchas entradas de hoteles son de lastre y empinadas, donde ayuda un vehículo alto. Aplican los costos usuales del alquiler:",
        ),
        RENTAL_FACTS,
      ],
    },
    {
      id: "tips",
      title: l("Tips for the climb", "Consejos para la subida"),
      blocks: [
        list(
          [
            "Carsickness: the last stretch is a long series of curves. Sit in front if you are prone to it, look at the road ahead and ask for a short pause whenever you need one.",
            "Mareo: el último tramo es una larga serie de curvas. Siéntese adelante si es propenso, mire la carretera al frente y pida una pausa corta cuando la necesite.",
          ],
          [
            "Keep a light jacket and a rain layer in your hand luggage: evenings in Monteverde are often misty, windy and around 15–18 °C.",
            "Tenga una chaqueta liviana y algo para la lluvia en el equipaje de mano: las noches en Monteverde suelen ser neblinosas, ventosas y de unos 15–18 °C.",
          ],
          [
            "Landing in the evening? The climb is slower in the dark and fog is common, so many travellers arrive in daylight or spend the first night near the airport.",
            "¿Aterriza al anochecer? La subida es más lenta de noche y la neblina es frecuente, así que muchos viajeros llegan con luz de día o pasan la primera noche cerca del aeropuerto.",
          ],
          [
            "Book the cloud forest reserves on their own websites: they limit how many visitors are inside at once, and some sell timed tickets online.",
            "Reserve las reservas de bosque nuboso en sus propios sitios web: limitan cuántos visitantes hay adentro a la vez, y algunas venden entradas con horario en línea.",
          ],
        ),
        p(
          "From Monteverde, most travellers continue to La Fortuna, around Lake Arenal, or down to the Pacific. There is no direct road to La Fortuna; the alternative to driving around the lake is the jeep-boat-jeep, which crosses Lake Arenal by boat and changes vehicles twice.",
          "Desde Monteverde, la mayoría continúa hacia La Fortuna, bordeando el lago Arenal, o baja al Pacífico. No hay carretera directa a La Fortuna; la alternativa a rodear el lago es el jeep-boat-jeep, que cruza el lago Arenal en lancha y cambia de vehículo dos veces.",
        ),
        {
          kind: "rides",
          caption: l("Rides to and from Monteverde: drive times and prices", "Traslados desde y hacia Monteverde: tiempos y precios"),
          rows: [
            { origin: "SJO", destination: "Monteverde" },
            { origin: "LIR", destination: "Monteverde" },
            { origin: "Monteverde", destination: "Arenal" },
            { origin: "Monteverde", destination: "ManuelAntonio" },
            { origin: "Monteverde", destination: "Tamarindo" },
          ],
        },
        p(
          "Where to stay, the reserves and the best season are in the [Monteverde destination guide](/destinations/monteverde). Our private [day tours](/?tab=tours) include the hanging bridges, a zipline and a night walk.",
          "Dónde hospedarse, las reservas y la mejor época están en la [guía de destino de Monteverde](/destinations/monteverde). Nuestros [tours privados de un día](/?tab=tours) incluyen los puentes colgantes, un canopy y una caminata nocturna.",
        ),
      ],
    },
  ],
  faqs: [
    faq(
      "How long does it take to drive from San José to Monteverde?",
      "¿Cuánto se tarda en llegar en vehículo de San José a Monteverde?",
      "About {time:SJO>Monteverde} door to door from the airport, for {km:SJO>Monteverde} km. The final mountain climb is slow, in both directions.",
      "Unas {time:SJO>Monteverde} de puerta a puerta desde el aeropuerto, para {km:SJO>Monteverde} km. La subida final por la montaña es lenta, en los dos sentidos.",
    ),
    faq(
      "Is the road to Monteverde paved now?",
      "¿La carretera a Monteverde ya está pavimentada?",
      "The main climb on Route 606 through Guacimal is paved today, but it is narrow, steep and curvy, and fog is common. Many side roads to hotels and reserves are still gravel.",
      "La subida principal por la Ruta 606, por Guacimal, hoy está asfaltada, pero es angosta, empinada y con curvas, y la neblina es frecuente. Muchos caminos secundarios a hoteles y reservas siguen siendo de lastre.",
    ),
    faq(
      "Do I need a 4x4 to get to Monteverde?",
      "¿Necesito un 4x4 para llegar a Monteverde?",
      "Not for the main road. A vehicle with good clearance helps on the steep gravel side roads to some hotels and reserves.",
      "No para la carretera principal. Un vehículo alto ayuda en los caminos de lastre empinados que llevan a algunos hoteles y reservas.",
    ),
    faq(
      "Can I fly to Monteverde?",
      "¿Se puede volar a Monteverde?",
      "No. There is no airport in Monteverde; the nearest are the international airports of San José and Liberia, about {time:SJO>Monteverde} and {time:LIR>Monteverde} away by road.",
      "No. Monteverde no tiene aeropuerto; los más cercanos son los internacionales de San José y Liberia, a unas {time:SJO>Monteverde} y {time:LIR>Monteverde} por carretera.",
    ),
    faq(
      "Is there a direct bus from San José to Monteverde?",
      "¿Hay bus directo de San José a Monteverde?",
      "Yes, from a terminal in downtown San José to Santa Elena, not from the airport. Seats can sell out in high season, so buy early and confirm the timetable.",
      "Sí, desde una terminal en el centro de San José hasta Santa Elena, no desde el aeropuerto. En temporada alta los asientos pueden agotarse: compre con tiempo y confirme el horario.",
    ),
    faq(
      "Does the road to Monteverde make people carsick?",
      "¿La carretera a Monteverde marea?",
      "It can, on the last stretch of curves. Sit in front, look at the road ahead, and ask your driver for a short pause whenever you need one.",
      "Puede pasar, en el último tramo de curvas. Siéntese adelante, mire la carretera al frente y pídale a su conductor una pausa corta cuando la necesite.",
    ),
    faq(
      "Is it better to fly into Liberia for Monteverde?",
      "¿Conviene más llegar por Liberia para ir a Monteverde?",
      "The drive is similar from both airports ({time:SJO>Monteverde} from SJO, {time:LIR>Monteverde} from LIR), so choose the one with the better flight or the one that suits the rest of your route.",
      "El recorrido es parecido desde los dos aeropuertos ({time:SJO>Monteverde} desde SJO, {time:LIR>Monteverde} desde LIR), así que elija el del mejor vuelo o el que más convenga al resto de su ruta.",
    ),
  ],
  book: { origin: "SJO", destination: "Monteverde" },
  about: { hubPairs: [["SJO", "Monteverde"]], hubs: ["Monteverde", "SJO"] },
  related: ["/transfers/sjo-airport-to-monteverde", "/transfers/monteverde-to-sjo-airport", "/destinations/monteverde", "/airports/sjo", "/transfers/monteverde-to-la-fortuna"],
};

// ───────────────────────── 4. Liberia airport → Tamarindo ─────────────────────────
const TAMARINDO: Article = {
  slug: "liberia-airport-to-tamarindo",
  published: FIRST_ISSUE,
  updated: FIRST_ISSUE,
  photo: "guanacaste-beach-sunset",
  title: l(
    "Liberia airport to Tamarindo: taxi, shuttle, private transfer and bus compared",
    "Del aeropuerto de Liberia a Tamarindo: taxi, shuttle, traslado privado y bus comparados",
  ),
  short: l("Liberia airport to Tamarindo", "Del aeropuerto de Liberia a Tamarindo"),
  metaDescription: l(
    "How to get from Liberia airport (LIR) to Tamarindo: official airport taxi, shared shuttle, private transfer, public bus and rental car compared on time, cost and convenience, with the real drive time.",
    "Cómo ir del aeropuerto de Liberia (LIR) a Tamarindo: taxi oficial del aeropuerto, shuttle compartido, traslado privado, bus público y vehículo de alquiler comparados en tiempo, costo y comodidad, con el tiempo de viaje real.",
  ),
  teaser: l("The short, easy ride to the beach", "El recorrido corto y sencillo a la playa"),
  answer: l(
    "Updated {asof}: Tamarindo is about {time:LIR>Tamarindo} by road from Liberia airport (LIR), {km:LIR>Tamarindo} km on flat, paved roads. A private transfer costs from {price:LIR>Tamarindo} for the whole vehicle (green-season price). Official airport taxis and shared shuttles also make the trip; public buses leave from the town of Liberia, not the airport; and a rental car is handy if you want to explore other beaches.",
    "Actualizado en {asof}: Tamarindo está a {time:LIR>Tamarindo} por carretera del aeropuerto de Liberia (LIR), {km:LIR>Tamarindo} km por carreteras planas y pavimentadas. Un traslado privado cuesta desde {price:LIR>Tamarindo} por el vehículo completo (precio de temporada verde). También hacen el viaje los taxis oficiales del aeropuerto y los shuttles compartidos; los buses públicos salen de la ciudad de Liberia, no del aeropuerto; y un vehículo de alquiler sirve si quiere conocer otras playas.",
  ),
  sections: [
    {
      id: "at-a-glance",
      title: l("Five options at a glance", "Cinco opciones de un vistazo"),
      blocks: [
        p(
          "Liberia's Daniel Oduber Quirós airport is the closest international airport to Tamarindo, and the drive is one of the easiest in the country. The question is not whether you can get there, but which option is best value for your group and least hassle after a flight:",
          "El aeropuerto Daniel Oduber Quirós de Liberia es el aeropuerto internacional más cercano a Tamarindo, y el recorrido es uno de los más sencillos del país. La pregunta no es si puede llegar, sino qué opción le da más por su dinero a su grupo y menos complicaciones después de un vuelo:",
        ),
        {
          kind: "table",
          caption: l("Ways to travel from Liberia airport to Tamarindo compared", "Formas de viajar del aeropuerto de Liberia a Tamarindo comparadas"),
          head: [l("Option", "Opción"), l("Book ahead?", "¿Se reserva antes?"), l("Time", "Tiempo"), l("Cost", "Costo"), l("Good to know", "Conviene saber")],
          rows: [
            [
              l("Official airport taxi", "Taxi oficial del aeropuerto"),
              l("No: taxi stand outside arrivals", "No: parada de taxis a la salida de llegadas"),
              l("About the same as private", "Parecido al privado"),
              l("Agree the fare before you get in", "Acuerde la tarifa antes de subir"),
              l("Simple if you travel light", "Sencillo si viaja con poco equipaje"),
            ],
            [
              l("Shared shuttle", "Shuttle compartido"),
              l("Yes", "Sí"),
              l("Longer: waits for several flights, several hotel drop-offs", "Más: espera varios vuelos y deja viajeros en varios hoteles"),
              l("Per seat; check current fares", "Por asiento; confirme las tarifas vigentes"),
              l("Cheapest door-to-door option for one or two", "La opción puerta a puerta más barata para una o dos personas"),
            ],
            [
              l("Private transfer", "Traslado privado"),
              l("Yes", "Sí"),
              l("About {time:LIR>Tamarindo}", "Unas {time:LIR>Tamarindo}"),
              l("From {price:LIR>Tamarindo} per vehicle", "Desde {price:LIR>Tamarindo} por vehículo"),
              l("Name sign, flight tracking, grocery stop on request", "Rótulo con su nombre, seguimiento del vuelo, parada en el súper a solicitud"),
            ],
            [
              l("Public bus", "Bus público"),
              l("No", "No"),
              l("The longest: taxi into Liberia first", "El más largo: primero un taxi a Liberia"),
              l("The lowest, plus the taxi", "El más bajo, más el taxi"),
              l("Buses don't reliably stop at the airport", "Los buses no siempre paran en el aeropuerto"),
            ],
            [
              l("Rental car", "Vehículo de alquiler"),
              l("Yes", "Sí"),
              l("Similar, plus the rental paperwork", "Parecido, más el trámite del alquiler"),
              l("Daily rate + mandatory insurance + fuel", "Tarifa diaria + seguro obligatorio + combustible"),
              l("Useful for exploring other beaches", "Útil para conocer otras playas"),
            ],
          ],
        },
      ],
    },
    {
      id: "the-road",
      title: l("The road", "La carretera"),
      blocks: [
        p(
          "From the airport the road is Route 21, across flat Guanacaste ranch land and dry forest toward Belén, then the road through Huacas and Villarreal to the coast. It is an easy, mostly straight drive of {km:LIR>Tamarindo} km. Expect slower traffic through the small towns and in Tamarindo itself in the afternoon; we plan about {time:LIR>Tamarindo} door to door. The ride, with prices by vehicle, is on the [Liberia airport to Tamarindo route page](/transfers/liberia-airport-to-tamarindo).",
          "Desde el aeropuerto se va por la Ruta 21, entre fincas ganaderas planas y el bosque seco de Guanacaste, hacia Belén, y luego por la carretera que pasa por Huacas y Villarreal hasta la costa. Es un recorrido sencillo y casi todo recto de {km:LIR>Tamarindo} km. El tráfico es más lento al cruzar los pueblos pequeños y en el propio Tamarindo por la tarde; calculamos unas {time:LIR>Tamarindo} de puerta a puerta. El traslado, con precios por vehículo, está en la [página de la ruta aeropuerto de Liberia – Tamarindo](/transfers/liberia-airport-to-tamarindo).",
        ),
      ],
    },
    {
      id: "taxi",
      title: l("Official airport taxi", "Taxi oficial del aeropuerto"),
      blocks: [
        p(
          "Official airport taxis wait at a stand outside arrivals. There is nothing to book, which makes them a good fallback, but for a beach town this far away the fare is a long-distance fare: ask it before you get in and compare it with a pre-booked private transfer. Groups with surfboards or lots of luggage should check that everything fits before setting off.",
          "Los taxis oficiales del aeropuerto esperan en una parada a la salida de llegadas. No hay que reservar nada, así que son un buen respaldo, pero para una playa a esta distancia la tarifa es de larga distancia: pregúntela antes de subir y compárela con un traslado privado reservado con anticipación. Los grupos con tablas de surf o mucho equipaje deben confirmar que todo cabe antes de salir.",
        ),
        p(
          "Ride-hailing apps are unreliable at Liberia airport and around Guanacaste: there are few drivers and airport pickups are not dependable. Treat them as a backup, not a plan.",
          "Las aplicaciones de transporte son poco confiables en el aeropuerto de Liberia y en Guanacaste en general: hay pocos conductores y no se puede contar con que recojan en el aeropuerto. Considérelas un respaldo, no un plan.",
        ),
      ],
    },
    {
      id: "shuttle-and-bus",
      title: l("Shared shuttle and public bus", "Shuttle compartido y bus público"),
      blocks: [
        p(
          "Shared shuttles wait for several flights and drop travellers at several hotels, so they cost less per person and take longer than the drive itself. Book ahead, and check what happens if your flight is late.",
          "Los shuttles compartidos esperan varios vuelos y dejan viajeros en varios hoteles, así que cuestan menos por persona y tardan más que el recorrido en sí. Reserve con anticipación y averigüe qué pasa si su vuelo se atrasa.",
        ),
        shuttleMath("LIR", "Tamarindo"),
        p(
          "Public buses reach Tamarindo from the town of Liberia. From the airport you normally need a taxi into town to catch one, because buses do not reliably stop at the terminal; timetables change, so check locally. It is the cheapest way, and the slowest.",
          "Hay buses públicos a Tamarindo desde la ciudad de Liberia. Desde el aeropuerto normalmente hay que tomar un taxi hasta la ciudad para abordarlos, porque los buses no siempre paran en la terminal aérea; los horarios cambian, así que consulte en el lugar. Es la forma más barata, y la más lenta.",
        ),
      ],
    },
    {
      id: "private",
      title: l("Private transfer", "Traslado privado"),
      blocks: [
        includedBlock(true),
        classesIntro("LIR", "Tamarindo"),
        { kind: "classes", origin: "LIR", destination: "Tamarindo" },
        list(
          [
            "Staying in a rental home? Ask for a quick supermarket stop on the way: tell us when you book or tell your driver.",
            "¿Se hospeda en una casa de alquiler? Pida una parada rápida en un supermercado camino a la playa: indíquelo al reservar o dígaselo a su conductor.",
          ],
          [
            "Bringing surfboards or other bulky items? Mention them in your booking notes and choose a class with room to spare; each class lists how many travellers and suitcases it fits.",
            "¿Lleva tablas de surf u otros objetos voluminosos? Menciónelos en las notas de su reserva y elija una categoría con espacio de sobra; cada categoría indica cuántos viajeros y maletas caben.",
          ],
          [
            "Not staying in Tamarindo itself? Type your exact hotel or rental in Langosta, Playa Grande, Flamingo or anywhere else in the trip builder to see the price to that address.",
            "¿No se hospeda en Tamarindo mismo? Escriba su hotel o casa exactos en Langosta, Playa Grande, Flamingo o cualquier otro lugar en el planificador de viajes para ver el precio hasta esa dirección.",
          ],
        ),
      ],
    },
    {
      id: "rental",
      title: l("Rental car", "Vehículo de alquiler"),
      blocks: [
        p(
          "Guanacaste is the one region where a rental car is genuinely useful for many travellers: the road from Liberia is paved and simple, and a car lets you explore the beaches up and down the coast. If you only plan to stay in Tamarindo, where everything is within walking distance, a transfer each way is usually simpler. If you rent:",
          "Guanacaste es la región donde un vehículo de alquiler resulta realmente útil para muchos viajeros: la carretera desde Liberia está pavimentada y es sencilla, y un vehículo le permite conocer las playas de la costa. Si solo piensa quedarse en Tamarindo, donde todo queda a poca distancia a pie, un traslado de ida y otro de vuelta suele ser más sencillo. Si alquila:",
        ),
        RENTAL_FACTS,
      ],
    },
    {
      id: "going-home",
      title: l("Going home, and coming from San José instead", "El regreso, y si llega por San José"),
      blocks: [
        p(
          "On the way back the ride takes about {time:Tamarindo>LIR}, so a last morning on the beach before an afternoon flight is often possible: count back from the time your airline wants you at the airport and leave a margin for town traffic. If your flights use San José instead, the ride across the country takes about {time:SJO>Tamarindo}; with a late landing many travellers sleep near the airport and cross the next morning. Our [guide to choosing between SJO and LIR](/guides/sjo-or-liberia-which-airport) compares the two airports.",
          "De regreso el traslado toma unas {time:Tamarindo>LIR}, así que muchas veces alcanza una última mañana de playa antes de un vuelo por la tarde: cuente hacia atrás desde la hora en que su aerolínea lo quiere en el aeropuerto y deje un margen por el tráfico de los pueblos. Si sus vuelos son por San José, el viaje cruzando el país toma unas {time:SJO>Tamarindo}; cuando el vuelo aterriza tarde, muchos viajeros duermen cerca del aeropuerto y cruzan a la mañana siguiente. Nuestra [guía para elegir entre SJO y LIR](/guides/sjo-or-liberia-which-airport) compara los dos aeropuertos.",
        ),
        {
          kind: "rides",
          caption: l("Rides to and from Tamarindo: drive times and prices", "Traslados desde y hacia Tamarindo: tiempos y precios"),
          rows: [
            { origin: "LIR", destination: "Tamarindo" },
            { origin: "SJO", destination: "Tamarindo" },
            { origin: "Tamarindo", destination: "Arenal" },
            { origin: "Tamarindo", destination: "Monteverde" },
          ],
        },
        p(
          "For the best season, sea turtles at Playa Grande and where to stay beach by beach, see the [Tamarindo and Guanacaste destination guide](/destinations/tamarindo) and the [Liberia airport arrival guide](/airports/lir).",
          "Para la mejor época, las tortugas marinas de Playa Grande y dónde hospedarse playa por playa, vea la [guía de destino de Tamarindo y Guanacaste](/destinations/tamarindo) y la [guía de llegada al aeropuerto de Liberia](/airports/lir).",
        ),
      ],
    },
  ],
  faqs: [
    faq(
      "How far is Tamarindo from Liberia airport?",
      "¿Qué tan lejos queda Tamarindo del aeropuerto de Liberia?",
      "{km:LIR>Tamarindo} km, about {time:LIR>Tamarindo} by road. Traffic in the small towns and in Tamarindo in the afternoon can add a little.",
      "{km:LIR>Tamarindo} km, unas {time:LIR>Tamarindo} por carretera. El tráfico en los pueblos pequeños y en Tamarindo por la tarde puede sumar un poco.",
    ),
    faq(
      "Is a taxi from Liberia airport to Tamarindo a good idea?",
      "¿Conviene tomar un taxi del aeropuerto de Liberia a Tamarindo?",
      "It works, with nothing to book. Agree the fare before you get in and compare it with a pre-booked private transfer, which includes the name sign, flight tracking and free waiting.",
      "Funciona, y no hay que reservar nada. Acuerde la tarifa antes de subir y compárela con un traslado privado reservado con anticipación, que incluye el rótulo con su nombre, el seguimiento del vuelo y la espera gratuita.",
    ),
    faq(
      "Is there a bus from Liberia airport to Tamarindo?",
      "¿Hay bus del aeropuerto de Liberia a Tamarindo?",
      "Not reliably from the airport. Buses to Tamarindo leave from the town of Liberia, so most bus travellers take a taxi into town first.",
      "No de forma confiable desde el aeropuerto. Los buses a Tamarindo salen de la ciudad de Liberia, así que la mayoría de quienes viajan en bus toma primero un taxi a la ciudad.",
    ),
    faq(
      "Our flight is delayed. Will the driver still be there?",
      "Nuestro vuelo viene atrasado. ¿Estará el conductor igual?",
      "Yes. On airport pickups we follow your flight, and your driver waits up to 60 minutes after it actually lands.",
      "Sí. En las recogidas en aeropuerto seguimos su vuelo, y su conductor espera hasta 60 minutos después del aterrizaje real.",
    ),
    faq(
      "Can we stop for groceries on the way?",
      "¿Podemos parar a comprar víveres en el camino?",
      "Yes. Many travellers staying in rentals ask for a quick supermarket stop; tell us when you book or tell your driver.",
      "Sí. Muchos viajeros que se hospedan en casas de alquiler piden una parada rápida en un supermercado; indíquelo al reservar o dígaselo a su conductor.",
    ),
    faq(
      "Is it better to fly into Liberia or San José for Tamarindo?",
      "¿Conviene llegar por Liberia o por San José para ir a Tamarindo?",
      "Liberia, if you can: about {time:LIR>Tamarindo} by road, against {time:SJO>Tamarindo} from San José.",
      "Liberia, si puede: {time:LIR>Tamarindo} por carretera, frente a {time:SJO>Tamarindo} desde San José.",
    ),
    faq(
      "Is the price per person?",
      "¿El precio es por persona?",
      "No. {price:LIR>Tamarindo} is the green-season price of the whole vehicle in the cheapest class, for up to {pax:LIR>Tamarindo} travellers; larger vehicles cost more. The exact price for your date is shown before you book.",
      "No. {price:LIR>Tamarindo} es el precio de temporada verde del vehículo completo en la categoría más económica, para hasta {pax:LIR>Tamarindo} viajeros; los vehículos más grandes cuestan más. El precio exacto para su fecha aparece antes de reservar.",
    ),
  ],
  book: { origin: "LIR", destination: "Tamarindo" },
  about: { hubPairs: [["LIR", "Tamarindo"]], hubs: ["Tamarindo", "LIR"] },
  related: ["/transfers/liberia-airport-to-tamarindo", "/transfers/tamarindo-to-liberia-airport", "/destinations/tamarindo", "/airports/lir", "/transfers/sjo-airport-to-tamarindo"],
};

export const ARTICLES_ROUTES: Article[] = [LA_FORTUNA, MANUEL_ANTONIO, MONTEVERDE, TAMARINDO];
