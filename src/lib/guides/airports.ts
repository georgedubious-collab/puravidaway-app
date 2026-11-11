/**
 * Airport guides: /airports/<code> (English) and /es/aeropuertos/<code> (Spanish).
 * Rules and tokens: ./types.ts. The waiting-time and flight-tracking promises are NOT
 * written here: the page shows RIDE_PROMISES from src/lib/trust.ts, word for word.
 * The exact meeting point at each airport is not confirmed yet, so `pickup` says only what
 * is confirmed: the driver meets you at arrivals holding a sign with your name (Jorge,
 * 2026-11-11; the traveller chooses what it says, src/lib/sign.ts), the trip page and the chat.
 */
import type { AirportGuide, L, OtherWay } from "./types";

const UPDATED = "2026-11-11";

const PICKUP: L[] = [
  {
    en: "Your driver meets you at arrivals holding a sign with your name. Once your driver is confirmed, your private trip page (linked in your confirmation email) shows their name, photo and car, so you know who to look for.",
    es: "Su conductor lo recibe en la salida de llegadas con un rótulo con su nombre. Cuando su conductor está confirmado, la página privada de su viaje (enlazada en su correo de confirmación) muestra su nombre, su foto y su vehículo, para que sepa a quién buscar.",
  },
  {
    en: "You choose what the sign says. If you write nothing, it shows your first name and the initial of your last name. You can write something else when you book (a family or company name, for example), or ask us not to show your name: the sign then reads “Costa Rica Private Transfers”. You can change it on your trip page until your driver is on the way.",
    es: "Usted elige qué dice el rótulo. Si no escribe nada, muestra su nombre y la inicial de su apellido. Al reservar puede escribir otro texto (el nombre de su familia o de su empresa, por ejemplo), o pedir que no se muestre su nombre: el rótulo dirá entonces “Costa Rica Private Transfers”. Puede cambiarlo en la página de su viaje hasta que su conductor vaya en camino.",
  },
  {
    en: "When you book, enter your flight's landing time and your flight number. We follow the flight, and the free waiting time starts when it lands, not at the scheduled time.",
    es: "Al reservar, indique la hora de aterrizaje y el número de su vuelo. Damos seguimiento al vuelo, y la espera gratuita empieza cuando aterriza, no a la hora programada.",
  },
  {
    en: "In the last 3 hours before pickup, while your driver shares their location, you can see where they are on your trip page, and chat there with your driver and our team.",
    es: "En las últimas 3 horas antes de la recogida, mientras su conductor comparte su ubicación, puede ver dónde está en la página de su viaje, y chatear allí con su conductor y con nuestro equipo.",
  },
];

const SHUTTLE: OtherWay = {
  kind: "shuttle",
  text: {
    en: "Shared shuttles are vans that run to the main tourist towns at fixed times, usually once or twice a day, and must be booked ahead. They cost less than a private car for one or two travellers, but if your flight lands after the last departure you wait until the next day. Check current times with the shuttle company.",
    es: "Los shuttles compartidos son microbuses que van a los principales destinos turísticos en horarios fijos, normalmente una o dos veces al día, y se reservan con anticipación. Para una o dos personas cuestan menos que un vehículo privado, pero si su vuelo aterriza después de la última salida, tendrá que esperar al día siguiente. Confirme los horarios vigentes con la empresa.",
  },
};

const CAR: OtherWay = {
  kind: "car",
  text: {
    en: "The main rental companies serve the airport; many have their offices a short shuttle ride from the terminal, so confirm the pickup procedure with yours. Rental companies add Costa Rica's mandatory liability insurance to the advertised rate, so ask for the full price, and avoid starting a long drive after dark.",
    es: "Las principales arrendadoras atienden el aeropuerto; muchas tienen sus oficinas a un trayecto corto en su propio transporte desde la terminal, así que confirme con la suya cómo es la entrega. Las arrendadoras suman al precio anunciado el seguro obligatorio de responsabilidad civil de Costa Rica: pida el precio total, y evite empezar un recorrido largo de noche.",
  },
};

const TIP_IMMIGRATION = {
  title: { en: "Immigration and luggage", es: "Migración y equipaje" },
  text: {
    en: "Getting through immigration, baggage claim and customs can take twenty minutes or well over an hour when several flights land together. You don't need to guess: the free waiting time is counted from the moment your flight lands.",
    es: "Pasar migración, recoger el equipaje y la aduana puede tomar veinte minutos o bastante más de una hora cuando aterrizan varios vuelos a la vez. No hace falta adivinar: la espera gratuita se cuenta desde que aterriza su vuelo.",
  },
};

const TIP_CASH = {
  title: { en: "Cash", es: "Efectivo" },
  text: {
    en: "US dollars are widely accepted for tourism services, and colones are handier for small purchases, local buses and tolls. Cards work in most hotels, restaurants and supermarkets. Airport exchange counters often give poor rates; ATMs in towns are usually a better way to get colones.",
    es: "Los dólares estadounidenses se aceptan ampliamente en servicios turísticos, y los colones son más prácticos para compras pequeñas, buses locales y peajes. Las tarjetas funcionan en la mayoría de hoteles, restaurantes y supermercados. Las casas de cambio del aeropuerto suelen dar un tipo de cambio desfavorable; los cajeros automáticos de los pueblos suelen ser mejor opción para obtener colones.",
  },
};

const TIP_SIM = {
  title: { en: "Phone and data", es: "Teléfono y datos" },
  text: {
    en: "Costa Rica's mobile operators are Kölbi, Liberty and Claro, and they sell prepaid SIM cards with a passport. An eSIM set up before you fly is the simplest way to have data, and WhatsApp, as soon as you land. Coverage is patchy on mountain roads and in remote areas.",
    es: "Los operadores móviles de Costa Rica son Kölbi, Liberty y Claro, y venden líneas prepago presentando el pasaporte. Una eSIM configurada antes de volar es la forma más sencilla de tener datos, y WhatsApp, apenas aterriza. La cobertura es irregular en carreteras de montaña y zonas remotas.",
  },
};

const FAQ_DELAY = {
  q: { en: "What if my flight is delayed?", es: "¿Qué pasa si mi vuelo se atrasa?" },
  a: {
    en: "On airport pickups we track your flight, so a delay doesn't leave you stranded. Your driver waits up to 60 minutes free after your flight lands.",
    es: "En las recogidas en el aeropuerto seguimos su vuelo, así que un atraso no lo deja sin transporte. Su conductor espera hasta 60 minutos gratis después de que aterriza su vuelo.",
  },
};

const FAQ_FIND_DRIVER = {
  q: { en: "How do I find my driver at the airport?", es: "¿Cómo encuentro a mi conductor en el aeropuerto?" },
  a: {
    en: "Your driver meets you at arrivals holding a sign with your name, or with the text you chose when you booked. Your trip page shows your driver's name, photo and car once confirmed, and in the last 3 hours before pickup, while your driver shares their location, you can see where they are and chat with them and our team.",
    es: "Su conductor lo recibe en la salida de llegadas con un rótulo con su nombre, o con el texto que usted eligió al reservar. La página de su viaje muestra el nombre, la foto y el vehículo de su conductor cuando está confirmado, y en las últimas 3 horas antes de la recogida, mientras el conductor comparte su ubicación, puede ver dónde está y chatear con él y con nuestro equipo.",
  },
};

const FAQ_CHILD_SEATS = {
  q: { en: "Can I get a child seat?", es: "¿Puedo pedir una silla para niños?" },
  a: {
    en: "Yes, free on request. Tell us how many and the children's ages when you book.",
    es: "Sí, gratis a solicitud. Indíquenos cuántas necesita y las edades de los niños al reservar.",
  },
};

const FAQ_PAY = {
  q: { en: "How do I pay for an airport transfer?", es: "¿Cómo se paga un traslado desde el aeropuerto?" },
  a: {
    en: "Two ways. Pay online in full: once our team confirms your ride, we send you a secure payment link. Or pay your driver in cash on the day, plus a {cashFee} cash booking fee shown in your trip total.",
    es: "De dos formas. Pague en línea el total: cuando nuestro equipo confirma su traslado, le enviamos un enlace de pago seguro. O pague a su conductor en efectivo el día del viaje, más un cargo por reserva en efectivo del {cashFee} que aparece en el total de su viaje.",
  },
};

export const AIRPORT_GUIDES: AirportGuide[] = [
  {
    code: "sjo",
    hub: "SJO",
    iata: "SJO",
    updated: UPDATED,
    name: { en: "San José Airport (SJO)", es: "Aeropuerto de San José (SJO)" },
    officialName: "Juan Santamaría International Airport",
    locality: "Alajuela",
    title: {
      en: "San José Airport (SJO): transfers, drive times and arrival guide",
      es: "Aeropuerto de San José (SJO): traslados, tiempos de viaje y guía de llegada",
    },
    metaDescription: {
      en: "Arriving at Juan Santamaría International Airport (SJO): private transfer prices and drive times to La Fortuna, Manuel Antonio, Monteverde, Puerto Viejo and Tamarindo, flight-delay waiting, taxis, buses, shuttles and practical tips.",
      es: "Llegar al Aeropuerto Internacional Juan Santamaría (SJO): precios de traslado privado y tiempos de viaje a La Fortuna, Manuel Antonio, Monteverde, Puerto Viejo y Tamarindo, espera por atrasos de vuelo, taxis, buses, shuttles y consejos prácticos.",
    },
    teaser: { en: "Juan Santamaría, the main gateway", es: "Juan Santamaría, la principal puerta de entrada" },
    answer: {
      en: "Juan Santamaría International Airport (SJO) is Costa Rica's main airport. From it, a private transfer takes about {time:SJO>Arenal} to La Fortuna (from {price:SJO>Arenal} per vehicle), {time:SJO>ManuelAntonio} to Manuel Antonio (from {price:SJO>ManuelAntonio}) and {time:SJO>Monteverde} to Monteverde (from {price:SJO>Monteverde}), at green-season prices. Your driver tracks your flight and waits up to 60 minutes free after it lands.",
      es: "El Aeropuerto Internacional Juan Santamaría (SJO) es el principal aeropuerto de Costa Rica. Desde allí, un traslado privado toma unas {time:SJO>Arenal} a La Fortuna (desde {price:SJO>Arenal} por vehículo), {time:SJO>ManuelAntonio} a Manuel Antonio (desde {price:SJO>ManuelAntonio}) y {time:SJO>Monteverde} a Monteverde (desde {price:SJO>Monteverde}), a precios de temporada verde. Su conductor da seguimiento a su vuelo y espera hasta 60 minutos gratis después de que aterriza.",
    },
    intro: {
      en: "Despite its name, the airport is not in the capital: it is in Alajuela, roughly 17 to 20 km northwest of downtown San José, right beside the highways that lead to the Pacific coast, the northern volcanoes and the Caribbean. That makes it the natural starting point for most of the country, and a good reason not to drive into the city unless you are staying there.",
      es: "A pesar de su nombre, el aeropuerto no está en la capital: está en Alajuela, a unos 17 a 20 km al noroeste del centro de San José, junto a las carreteras que llevan a la costa del Pacífico, a los volcanes del norte y al Caribe. Por eso es el punto de partida natural hacia casi todo el país, y una buena razón para no entrar a la ciudad a menos que se hospede allí.",
    },
    rides: ["Arenal", "ManuelAntonio", "Monteverde", "PuertoViejo", "Tamarindo", "Sierpe"],
    pickup: PICKUP,
    otherWays: [
      {
        kind: "taxi",
        text: {
          en: "The official airport taxis are orange and wait at a stand outside arrivals. They are the simple choice for short trips to Alajuela, airport hotels and San José. For long distances, ask the fare before you get in and compare it with a pre-booked private transfer.",
          es: "Los taxis oficiales del aeropuerto son anaranjados y esperan en una parada a la salida de llegadas. Son la opción sencilla para trayectos cortos a Alajuela, a los hoteles del aeropuerto y a San José. Para distancias largas, pregunte la tarifa antes de subir y compárela con un traslado privado reservado con anticipación.",
        },
      },
      {
        kind: "rideshare",
        text: {
          en: "Ride-hailing apps work in the Central Valley, but pickup rules at the terminal have changed more than once and drivers may ask you to walk to a meeting spot. They are of little use for long trips to the coast or the mountains. Check the app when you land.",
          es: "Las aplicaciones de transporte funcionan en el Valle Central, pero las reglas para recoger pasajeros en la terminal han cambiado más de una vez y el conductor puede pedirle que camine hasta un punto de encuentro. Sirven de poco para viajes largos a la costa o a la montaña. Revise la aplicación al aterrizar.",
        },
      },
      {
        kind: "bus",
        text: {
          en: "Frequent public buses to Alajuela and to downtown San José stop on the highway in front of the airport. Long-distance buses to the beaches and volcanoes do not leave from the airport: they leave from several terminals in San José, so you first need to get into the city with your luggage. Terminals and timetables change, so confirm them shortly before you travel.",
          es: "Sobre la autopista, frente al aeropuerto, paran buses públicos frecuentes hacia Alajuela y hacia el centro de San José. Los buses de larga distancia a las playas y los volcanes no salen del aeropuerto: salen de varias terminales en San José, así que primero debe llegar a la ciudad con su equipaje. Las terminales y los horarios cambian: confírmelos poco antes de viajar.",
        },
      },
      SHUTTLE,
      CAR,
      {
        kind: "flight",
        text: {
          en: "Domestic flights on small planes leave from a separate small terminal next to the international one, to airstrips such as Quepos, Drake Bay, Tamarindo and La Fortuna. Routes, schedules and luggage limits change, so check the airline's current timetable and leave a generous connection time.",
          es: "Los vuelos nacionales, en avionetas, salen de una terminal pequeña aparte, junto a la internacional, hacia aeródromos como Quepos, Bahía Drake, Tamarindo y La Fortuna. Las rutas, los horarios y los límites de equipaje cambian: revise el itinerario vigente de la aerolínea y deje un tiempo de conexión holgado.",
        },
      },
    ],
    tips: [
      TIP_IMMIGRATION,
      {
        title: { en: "Late arrivals", es: "Llegadas tarde" },
        text: {
          en: "Night falls by about 6 pm all year, and mountain roads are slower and foggier in the dark. If you land in the evening and your destination is three hours or more away, many travellers sleep near the airport and leave in the morning.",
          es: "Anochece hacia las 6 p. m. todo el año, y las carreteras de montaña son más lentas y con más neblina en la oscuridad. Si aterriza al final de la tarde y su destino queda a tres horas o más, muchos viajeros duermen cerca del aeropuerto y salen por la mañana.",
        },
      },
      {
        title: { en: "Traffic", es: "Tráfico" },
        text: {
          en: "The highways around the airport and San José are congested at rush hour, and Route 27 to the Pacific fills up on Friday afternoons, Sunday evenings and holidays. When you travel back to the airport for your flight home, leave earlier than the drive time alone suggests.",
          es: "Las carreteras alrededor del aeropuerto y de San José se congestionan en las horas pico, y la Ruta 27 hacia el Pacífico se llena los viernes por la tarde, los domingos al final del día y en feriados. Cuando regrese al aeropuerto para su vuelo de salida, salga con más margen del que indica el tiempo de viaje.",
        },
      },
      TIP_CASH,
      TIP_SIM,
    ],
    faqs: [
      {
        q: { en: "Is SJO airport in San José?", es: "¿El aeropuerto SJO está en San José?" },
        a: {
          en: "No. Juan Santamaría International Airport is in Alajuela, roughly 17 to 20 km northwest of downtown San José.",
          es: "No. El Aeropuerto Internacional Juan Santamaría está en Alajuela, a unos 17 a 20 km al noroeste del centro de San José.",
        },
      },
      FAQ_DELAY,
      FAQ_FIND_DRIVER,
      {
        q: { en: "How long is the drive from SJO to La Fortuna and to Manuel Antonio?", es: "¿Cuánto dura el viaje de SJO a La Fortuna y a Manuel Antonio?" },
        a: {
          en: "About {time:SJO>Arenal} to La Fortuna and {time:SJO>ManuelAntonio} to Manuel Antonio, door to door. Weekend traffic and rain can add time.",
          es: "Unas {time:SJO>Arenal} a La Fortuna y {time:SJO>ManuelAntonio} a Manuel Antonio, de puerta a puerta. El tráfico de fin de semana y la lluvia pueden sumar tiempo.",
        },
      },
      {
        q: { en: "How much is a private transfer from SJO airport?", es: "¿Cuánto cuesta un traslado privado desde el aeropuerto SJO?" },
        a: {
          en: "It depends on the distance: from {price:SJO>Arenal} per vehicle to La Fortuna, {price:SJO>ManuelAntonio} to Manuel Antonio and {price:SJO>Tamarindo} to Tamarindo, at green-season prices. The price is for the whole vehicle, not per person, and you see the exact amount for your date before you book.",
          es: "Depende de la distancia: desde {price:SJO>Arenal} por vehículo a La Fortuna, {price:SJO>ManuelAntonio} a Manuel Antonio y {price:SJO>Tamarindo} a Tamarindo, a precios de temporada verde. El precio es por el vehículo completo, no por persona, y usted ve el monto exacto para su fecha antes de reservar.",
        },
      },
      {
        q: { en: "Can we stop for sightseeing on the way from the airport?", es: "¿Podemos hacer paradas turísticas saliendo del aeropuerto?" },
        a: {
          en: "Yes. On many routes you can add stops such as Poás Volcano on the way to La Fortuna (timed-entry tickets, booked in advance) or the Tárcoles crocodile bridge on the way to Manuel Antonio. Your luggage stays locked in the vehicle with your driver.",
          es: "Sí. En muchas rutas puede agregar paradas, como el volcán Poás camino a La Fortuna (entradas con horario, reservadas con anticipación) o el puente de los cocodrilos de Tárcoles camino a Manuel Antonio. Su equipaje queda bajo llave en el vehículo con su conductor.",
        },
      },
      FAQ_CHILD_SEATS,
      FAQ_PAY,
    ],
  },
  {
    code: "lir",
    hub: "LIR",
    iata: "LIR",
    updated: UPDATED,
    name: { en: "Liberia Airport (LIR)", es: "Aeropuerto de Liberia (LIR)" },
    officialName: "Daniel Oduber Quirós International Airport",
    locality: "Liberia",
    title: {
      en: "Liberia Airport (LIR): transfers, drive times and arrival guide",
      es: "Aeropuerto de Liberia (LIR): traslados, tiempos de viaje y guía de llegada",
    },
    metaDescription: {
      en: "Arriving at Daniel Oduber Quirós International Airport (LIR) in Liberia, Guanacaste: private transfer prices and drive times to Tamarindo, La Fortuna and Monteverde, flight-delay waiting, taxis, buses, shuttles and practical tips.",
      es: "Llegar al Aeropuerto Internacional Daniel Oduber Quirós (LIR), en Liberia, Guanacaste: precios de traslado privado y tiempos de viaje a Tamarindo, La Fortuna y Monteverde, espera por atrasos de vuelo, taxis, buses, shuttles y consejos prácticos.",
    },
    teaser: { en: "Daniel Oduber, the gateway to Guanacaste", es: "Daniel Oduber, la puerta de entrada a Guanacaste" },
    answer: {
      en: "Daniel Oduber Quirós International Airport (LIR), in Liberia, is the gateway to Guanacaste's beaches. From it, a private transfer takes about {time:LIR>Tamarindo} to Tamarindo (from {price:LIR>Tamarindo} per vehicle), {time:LIR>Arenal} to La Fortuna (from {price:LIR>Arenal}) and {time:LIR>Monteverde} to Monteverde (from {price:LIR>Monteverde}), at green-season prices. Your driver tracks your flight and waits up to 60 minutes free after it lands.",
      es: "El Aeropuerto Internacional Daniel Oduber Quirós (LIR), en Liberia, es la puerta de entrada a las playas de Guanacaste. Desde allí, un traslado privado toma {time:LIR>Tamarindo} a Tamarindo (desde {price:LIR>Tamarindo} por vehículo), {time:LIR>Arenal} a La Fortuna (desde {price:LIR>Arenal}) y {time:LIR>Monteverde} a Monteverde (desde {price:LIR>Monteverde}), a precios de temporada verde. Su conductor da seguimiento a su vuelo y espera hasta 60 minutos gratis después de que aterriza.",
    },
    intro: {
      en: "Liberia's airport, also known as Guanacaste Airport, is a small single-terminal airport a short drive west of the city of Liberia. It is the closest international airport to Tamarindo, Flamingo, the Papagayo Gulf and the rest of the Guanacaste coast, and about as far from La Fortuna and Monteverde as San José is.",
      es: "El aeropuerto de Liberia, también conocido como Aeropuerto de Guanacaste, es un aeropuerto pequeño, de una sola terminal, a poca distancia al oeste de la ciudad de Liberia. Es el aeropuerto internacional más cercano a Tamarindo, Flamingo, el golfo de Papagayo y el resto de la costa de Guanacaste, y queda casi tan lejos de La Fortuna y de Monteverde como San José.",
    },
    rides: ["Tamarindo", "Arenal", "Monteverde", "ManuelAntonio"],
    pickup: PICKUP,
    otherWays: [
      {
        kind: "taxi",
        text: {
          en: "Official airport taxis wait at a stand outside arrivals. They suit short trips to Liberia and nearby hotels; for the beaches, ask the fare before you get in and compare it with a pre-booked private transfer.",
          es: "Los taxis oficiales del aeropuerto esperan en una parada a la salida de llegadas. Convienen para trayectos cortos a Liberia y a hoteles cercanos; para las playas, pregunte la tarifa antes de subir y compárela con un traslado privado reservado con anticipación.",
        },
      },
      {
        kind: "rideshare",
        text: {
          en: "Ride-hailing apps are unreliable at Liberia airport and around Guanacaste: there are few drivers and airport pickups are not dependable. Treat them as a backup, not a plan.",
          es: "Las aplicaciones de transporte son poco confiables en el aeropuerto de Liberia y en Guanacaste en general: hay pocos conductores y no se puede contar con que recojan en el aeropuerto. Considérelas un respaldo, no un plan.",
        },
      },
      {
        kind: "bus",
        text: {
          en: "A local bus links the airport road with the city of Liberia, and buses to the beach towns leave from Liberia's bus stations. Beach buses do not reliably stop at the airport, so most travellers who go by bus take a taxi into town first. Timetables change, so check locally.",
          es: "Un bus local une la carretera del aeropuerto con la ciudad de Liberia, y los buses hacia las playas salen de las terminales de Liberia. Los buses a las playas no siempre paran en el aeropuerto, así que la mayoría de quienes viajan en bus toma primero un taxi a la ciudad. Los horarios cambian: consulte en el lugar.",
        },
      },
      SHUTTLE,
      CAR,
    ],
    tips: [
      TIP_IMMIGRATION,
      {
        title: { en: "Busy days", es: "Días de mucho movimiento" },
        text: {
          en: "Lines are longest when several flights land close together, most often on weekends from December to April. The terminal is small and the exit is easy to find.",
          es: "Las filas son más largas cuando aterrizan varios vuelos seguidos, sobre todo los fines de semana de diciembre a abril. La terminal es pequeña y la salida es fácil de encontrar.",
        },
      },
      {
        title: { en: "Groceries on the way", es: "Víveres en el camino" },
        text: {
          en: "If you are staying in a rental home, ask for a quick supermarket stop on the way to the beach: tell us when you book or tell your driver.",
          es: "Si se hospeda en una casa de alquiler, pida una parada rápida en un supermercado camino a la playa: indíquelo al reservar o dígaselo a su conductor.",
        },
      },
      TIP_CASH,
      TIP_SIM,
    ],
    faqs: [
      {
        q: { en: "How far is Tamarindo from Liberia airport?", es: "¿Qué tan lejos queda Tamarindo del aeropuerto de Liberia?" },
        a: {
          en: "About {time:LIR>Tamarindo} by road. A private transfer costs from {price:LIR>Tamarindo} per vehicle at green-season prices.",
          es: "A {time:LIR>Tamarindo} por carretera, aproximadamente. Un traslado privado cuesta desde {price:LIR>Tamarindo} por vehículo a precios de temporada verde.",
        },
      },
      FAQ_DELAY,
      FAQ_FIND_DRIVER,
      {
        q: { en: "Is Liberia or San José the better airport?", es: "¿Qué aeropuerto conviene más, Liberia o San José?" },
        a: {
          en: "Liberia (LIR) for the Guanacaste beaches; San José (SJO) for Manuel Antonio, the Caribbean coast and the Osa Peninsula. For La Fortuna and Monteverde the drive is similar from both ({time:LIR>Arenal} and {time:SJO>Arenal} to La Fortuna), so choose by flight.",
          es: "Liberia (LIR) para las playas de Guanacaste; San José (SJO) para Manuel Antonio, el Caribe y la península de Osa. Para La Fortuna y Monteverde el recorrido es parecido desde ambos ({time:LIR>Arenal} y {time:SJO>Arenal} a La Fortuna), así que elija según el vuelo.",
        },
      },
      {
        q: { en: "How much is a private transfer from Liberia airport?", es: "¿Cuánto cuesta un traslado privado desde el aeropuerto de Liberia?" },
        a: {
          en: "From {price:LIR>Tamarindo} per vehicle to Tamarindo, {price:LIR>Arenal} to La Fortuna and {price:LIR>Monteverde} to Monteverde, at green-season prices. The price is for the whole vehicle, not per person, and you see the exact amount for your date before you book.",
          es: "Desde {price:LIR>Tamarindo} por vehículo a Tamarindo, {price:LIR>Arenal} a La Fortuna y {price:LIR>Monteverde} a Monteverde, a precios de temporada verde. El precio es por el vehículo completo, no por persona, y usted ve el monto exacto para su fecha antes de reservar.",
        },
      },
      {
        q: { en: "Can you take us to a beach other than Tamarindo?", es: "¿Pueden llevarnos a una playa distinta de Tamarindo?" },
        a: {
          en: "Yes. Type your exact hotel, rental or town in the trip builder, anywhere in Costa Rica, and you will see the price to that address.",
          es: "Sí. Escriba su hotel, casa o pueblo exactos en el planificador de viajes, en cualquier lugar de Costa Rica, y verá el precio hasta esa dirección.",
        },
      },
      FAQ_CHILD_SEATS,
      FAQ_PAY,
    ],
  },
];
