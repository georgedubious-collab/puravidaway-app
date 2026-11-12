/**
 * Text of the day tour pages, one object per catalog tour, English and Spanish side by side.
 * Rules and tokens: ./types.ts. Name, region, duration, highlights and prices are NOT here:
 * they come from the catalog. To add a page for a new tour: give it a slug in ./slugs.ts and
 * add one object below; the page, the index, the sitemap, llms.txt and the links follow.
 */
import { DESTINATION_GUIDES } from "../guides/destinations";
import type { L } from "../guides/types";
import type { TourPageContent } from "./types";

/** Date the tour pages' facts were last checked; shown on every page. Bump it after a re-check. */
export const TOURS_UPDATED = "2026-11-12";

const l = (en: string, es: string): L => ({ en, es });
const q = (qEn: string, qEs: string, aEn: string, aEs: string) => ({ q: l(qEn, qEs), a: l(aEn, aEs) });

/**
 * A "good to know" line of a destination guide, word for word (src/lib/guides/destinations.ts),
 * so park rules are written once. A wrong slug or index fails the build.
 */
function guideNote(slug: string, index: number): L {
  const note = DESTINATION_GUIDES.find((g) => g.slug === slug)?.goodToKnow?.[index];
  if (!note) throw new Error(`Tour pages: no "good to know" line ${index} in the ${slug} guide`);
  return note;
}

/** The same cancellation answer on every tour, in the words of /faq and /cancellation. */
const CANCEL = q(
  "Can I cancel?",
  "¿Puedo cancelar?",
  "Yes: free cancellation and a full refund up to 24 hours before pickup; within 24 hours or a no-show, no refund. If weather, a road closure or a park closure stops the tour, we offer you another date or a refund of the tour.",
  "Sí: cancelación gratuita y reembolso completo hasta 24 horas antes de la recogida; con menos de 24 horas o si no se presenta, no hay reembolso. Si el clima, el cierre de una carretera o de un parque impide el tour, le ofrecemos otra fecha o el reembolso del tour.",
);

/** The Smart En-Route Transfer, as the booking app and /faq describe it. */
const EN_ROUTE = q(
  "Can the day end at my next hotel?",
  "¿El día puede terminar en mi siguiente hotel?",
  "Yes. Add the Smart En-Route Transfer (+{enRoute} per group in green season) and take your luggage along: we pick you up in one town, run the tour, and drop you at your next hotel, so the tour is also your transfer.",
  "Sí. Agregue el Smart En-Route Transfer (+{enRoute} por grupo en temporada verde) y lleve su equipaje: lo recogemos en un pueblo, hacemos el tour y lo dejamos en su siguiente hotel, así el tour también es su traslado.",
);

const WILDLIFE_HONEST = l(
  "Animals are wild, so no sighting is ever guaranteed.",
  "Los animales están en libertad, así que ningún avistamiento está garantizado.",
);

export const TOUR_CONTENT: TourPageContent[] = [
  {
    id: "dt1",
    updated: TOURS_UPDATED,
    metaDescription: l(
      "Private day tour in La Fortuna: Arenal's 1968 lava trails, La Fortuna Waterfall and a hot springs soak, with a local naturalist guide, entrances and lunch included. Price per person by group size.",
      "Tour privado de un día en La Fortuna: senderos de lava de 1968 del Arenal, catarata de La Fortuna y aguas termales, con guía naturalista local, entradas y almuerzo incluidos. Precio por persona según el grupo.",
    ),
    answer: l(
      "A private day tour of {hours} around Arenal Volcano for your group only, starting in La Fortuna. It combines the 1968 lava trails, La Fortuna Waterfall and a hot springs soak, with a local naturalist guide, entrances and lunch included, from {pp4} per person for 4 or more travellers ({pp1} for one traveller, green season, checked {asof}).",
      "Un día privado de {hours} alrededor del volcán Arenal solo para su grupo, con inicio en La Fortuna. Combina los senderos de lava de 1968, la catarata de La Fortuna y un baño en aguas termales, con guía naturalista local, entradas y almuerzo incluidos, desde {pp4} por persona para 4 viajeros o más ({pp1} para un viajero, temporada verde, revisado en {asof}).",
    ),
    intro: l(
      "The classic La Fortuna day in one go: walk across the lava fields of the 1968 eruption, go down to the waterfall in the forest, and soak in water warmed by the volcano. Your guide sets the pace for your group, and nobody else joins.",
      "El día clásico de La Fortuna de una sola vez: camine sobre los campos de lava de la erupción de 1968, baje a la catarata en medio del bosque y relájese en agua calentada por el volcán. Su guía marca el ritmo de su grupo, y nadie más se une.",
    ),
    start: l(
      "The tour is in La Fortuna and around Arenal, in a private vehicle with only your group. Write your hotel in the trip notes when you book, and our team confirms where and when you are picked up.",
      "El tour es en La Fortuna y alrededor del Arenal, en un vehículo privado solo para su grupo. Escriba su hotel en las notas del viaje al reservar, y nuestro equipo le confirma dónde y a qué hora lo recogen.",
    ),
    parts: [
      {
        title: l("The 1968 lava trails", "Los senderos de lava de 1968"),
        text: l(
          "Trails across old lava fields with views of the volcano's cone and Lake Arenal.",
          "Senderos sobre antiguos campos de lava, con vistas del cono del volcán y del lago Arenal.",
        ),
      },
      {
        title: l("La Fortuna Waterfall", "La catarata de La Fortuna"),
        text: l(
          "A tall waterfall in the forest, reached by a long staircase down (and back up).",
          "Una catarata alta en medio del bosque, a la que se baja (y se vuelve a subir) por una larga escalinata.",
        ),
      },
      {
        title: l("A hot springs soak", "Un baño en aguas termales"),
        text: l(
          "Pools fed by rivers warmed by the volcano: the quiet part of an active day, and just as good in the rain.",
          "Piscinas alimentadas por ríos calentados por el volcán: la parte tranquila de un día activo, y se disfrutan igual bajo la lluvia.",
        ),
      },
      {
        title: l("Lunch", "Almuerzo"),
        text: l("Lunch is part of the day and included in the price.", "El almuerzo es parte del día y está incluido en el precio."),
      },
    ],
    bring: [
      l("Shoes with good grip for the waterfall stairs and the lava trails", "Zapatos con buen agarre para la escalinata de la catarata y los senderos de lava"),
      l("Swimwear and a change of clothes for the hot springs", "Traje de baño y una muda de ropa para las aguas termales"),
      l("A light rain jacket: showers are common here in every season", "Una chaqueta liviana para la lluvia: los aguaceros son comunes aquí en cualquier época"),
      l("Sunscreen, a hat, insect repellent and a refillable water bottle", "Protector solar, sombrero, repelente de insectos y una botella de agua reutilizable"),
    ],
    goodToKnow: [],
    faqs: [
      q(
        "How much does the Arenal Volcano, waterfall and hot springs tour cost?",
        "¿Cuánto cuesta el tour del volcán Arenal, la catarata y las aguas termales?",
        "In green season, {pp1} per person for one traveller, {pp2} each for 2 or 3 travellers and {pp4} each for 4 or more, with the guide, entrances and lunch included. Other seasons cost more (see the price table); the exact price for your date is shown before you book.",
        "En temporada verde, {pp1} por persona para un viajero, {pp2} cada uno para 2 o 3 viajeros y {pp4} cada uno para 4 o más, con guía, entradas y almuerzo incluidos. Las otras temporadas cuestan más (vea la tabla de precios); el precio exacto para su fecha aparece antes de reservar.",
      ),
      q(
        "Is the tour private?",
        "¿El tour es privado?",
        "Yes. Only your group, with a local naturalist guide and a private vehicle; you don't share the day with other travellers.",
        "Sí. Solo su grupo, con un guía naturalista local y un vehículo privado; no comparte el día con otros viajeros.",
      ),
      q(
        "Will we see Arenal Volcano?",
        "¿Vamos a ver el volcán Arenal?",
        "Often, but not always: Arenal's summit is often wrapped in cloud, especially in the afternoon. December to April is the drier season, with the best odds of a clear volcano; from May to November mornings are often clear.",
        "Muchas veces, pero no siempre: la cima del Arenal suele estar cubierta de nubes, sobre todo por la tarde. De diciembre a abril es la época más seca, con más posibilidades de verlo despejado; de mayo a noviembre las mañanas suelen estar despejadas.",
      ),
      q(
        "Is the waterfall hard to reach?",
        "¿Es difícil llegar a la catarata?",
        "It is a long staircase down to the waterfall and the same staircase back up, so wear shoes with good grip and take your time. Tell us when you book if anyone in your group has trouble with stairs.",
        "Es una larga escalinata hasta la catarata y la misma escalinata de regreso, así que use zapatos con buen agarre y vaya con calma. Avísenos al reservar si alguien de su grupo tiene dificultad con las escaleras.",
      ),
      EN_ROUTE,
      q(
        "How do I get to La Fortuna for the tour?",
        "¿Cómo llego a La Fortuna para el tour?",
        "A private transfer from San José airport (SJO) takes about {time:SJO>Arenal} and costs from {price:SJO>Arenal} for the whole vehicle; from Liberia airport (LIR) about {time:LIR>Arenal}, from {price:LIR>Arenal}. Plan to arrive the day before the tour.",
        "Un traslado privado desde el aeropuerto de San José (SJO) toma aproximadamente {time:SJO>Arenal} y cuesta desde {price:SJO>Arenal} por el vehículo completo; desde el aeropuerto de Liberia (LIR), unas {time:LIR>Arenal}, desde {price:LIR>Arenal}. Conviene llegar el día antes del tour.",
      ),
      CANCEL,
    ],
  },
  {
    id: "dt2",
    updated: TOURS_UPDATED,
    metaDescription: l(
      "Private day tour in Manuel Antonio: a guided wildlife walk in the national park with a naturalist and spotting scope, then an afternoon catamaran with snorkelling. Entrances and lunch included. Price per person by group size.",
      "Tour privado de un día en Manuel Antonio: caminata de vida silvestre en el parque nacional con guía naturalista y telescopio, y por la tarde catamarán con snorkel. Entradas y almuerzo incluidos. Precio por persona según el grupo.",
    ),
    answer: l(
      "A private day tour of {hours} in Manuel Antonio for your group only: a wildlife walk in Manuel Antonio National Park with a naturalist guide and spotting scope, then an afternoon catamaran with snorkelling. Entrances and lunch are included, from {pp4} per person for 4 or more travellers ({pp1} for one traveller, green season, checked {asof}).",
      "Un día privado de {hours} en Manuel Antonio solo para su grupo: una caminata de vida silvestre en el Parque Nacional Manuel Antonio con guía naturalista y telescopio, y por la tarde un catamarán con snorkel. Entradas y almuerzo incluidos, desde {pp4} por persona para 4 viajeros o más ({pp1} para un viajero, temporada verde, revisado en {asof}).",
    ),
    intro: l(
      "Manuel Antonio packs forest and sea into one small park. A naturalist with a spotting scope finds the sloths, monkeys and toucans you would walk past, and the afternoon is on the water.",
      "Manuel Antonio reúne bosque y mar en un parque pequeño. Un naturalista con telescopio encuentra los perezosos, monos y tucanes que usted pasaría de largo, y la tarde es en el agua.",
    ),
    start: l(
      "The tour is in Manuel Antonio and Quepos, in a private vehicle with only your group. Write your hotel in the trip notes when you book, and our team confirms where and when you are picked up.",
      "El tour es en Manuel Antonio y Quepos, en un vehículo privado solo para su grupo. Escriba su hotel en las notas del viaje al reservar, y nuestro equipo le confirma dónde y a qué hora lo recogen.",
    ),
    parts: [
      {
        title: l("Wildlife walk in Manuel Antonio National Park", "Caminata de vida silvestre en el Parque Nacional Manuel Antonio"),
        text: l(
          "Short trails through the forest to sheltered beaches, with a naturalist guide and a spotting scope to look for sloths, monkeys and toucans.",
          "Senderos cortos por el bosque hasta playas protegidas, con un guía naturalista y un telescopio para buscar perezosos, monos y tucanes.",
        ),
      },
      {
        title: l("Catamaran and snorkelling", "Catamarán y snorkel"),
        text: l("A sail along the coast in the afternoon, with time to snorkel.", "Un paseo en catamarán por la costa en la tarde, con tiempo para hacer snorkel."),
      },
      {
        title: l("Lunch", "Almuerzo"),
        text: l("Lunch is part of the day and included in the price.", "El almuerzo es parte del día y está incluido en el precio."),
      },
    ],
    partsNote: l(
      "The catamaran is in the afternoon. " + WILDLIFE_HONEST.en,
      "El catamarán es en la tarde. " + WILDLIFE_HONEST.es,
    ),
    bring: [
      l("Comfortable walking shoes or sandals with grip for the park trails", "Zapatos cómodos para caminar o sandalias con buen agarre para los senderos del parque"),
      l("Swimwear, a towel and a change of clothes for the catamaran", "Traje de baño, toalla y una muda de ropa para el catamarán"),
      l("Sunscreen, a hat and insect repellent", "Protector solar, sombrero y repelente de insectos"),
      l("A small waterproof bag for your phone on the boat", "Una bolsa impermeable pequeña para el teléfono en el bote"),
    ],
    goodToKnow: [guideNote("manuel-antonio", 0)],
    faqs: [
      q(
        "How much does the Manuel Antonio park and catamaran tour cost?",
        "¿Cuánto cuesta el tour del parque Manuel Antonio y el catamarán?",
        "In green season, {pp1} per person for one traveller, {pp2} each for 2 or 3 travellers and {pp4} each for 4 or more, with the guide, park entrance, catamaran and lunch included. Other seasons cost more (see the price table); the exact price for your date is shown before you book.",
        "En temporada verde, {pp1} por persona para un viajero, {pp2} cada uno para 2 o 3 viajeros y {pp4} cada uno para 4 o más, con guía, entrada al parque, catamarán y almuerzo incluidos. Las otras temporadas cuestan más (vea la tabla de precios); el precio exacto para su fecha aparece antes de reservar.",
      ),
      q(
        "Can I do this tour on a Tuesday?",
        "¿Puedo hacer este tour un martes?",
        "No. Manuel Antonio National Park is closed on Tuesdays, so the park walk can't take place that day. Choose another date for the tour.",
        "No. El Parque Nacional Manuel Antonio cierra los martes, así que la caminata en el parque no se puede hacer ese día. Elija otra fecha para el tour.",
      ),
      q(
        "Do I need to buy park tickets myself?",
        "¿Tengo que comprar yo las entradas del parque?",
        "No, the park entrance is included in the tour price. Tickets are sold online only, for a set entry time, and the number of visitors per day is limited, so book the tour as early as you can, especially from December to April.",
        "No, la entrada al parque está incluida en el precio del tour. Las entradas se venden solo en línea, para una hora de ingreso, y el número de visitantes por día es limitado, así que reserve el tour lo antes posible, sobre todo de diciembre a abril.",
      ),
      q(
        "What wildlife will we see?",
        "¿Qué animales vamos a ver?",
        "The guide looks for sloths, monkeys and toucans, and the spotting scope brings them close. Animals are wild, so no sighting is ever guaranteed.",
        "El guía busca perezosos, monos y tucanes, y el telescopio los acerca. Los animales están en libertad, así que ningún avistamiento está garantizado.",
      ),
      EN_ROUTE,
      q(
        "How do I get to Manuel Antonio for the tour?",
        "¿Cómo llego a Manuel Antonio para el tour?",
        "A private transfer from San José airport (SJO) takes about {time:SJO>ManuelAntonio} and costs from {price:SJO>ManuelAntonio} for the whole vehicle. Plan to arrive the day before the tour.",
        "Un traslado privado desde el aeropuerto de San José (SJO) toma aproximadamente {time:SJO>ManuelAntonio} y cuesta desde {price:SJO>ManuelAntonio} por el vehículo completo. Conviene llegar el día antes del tour.",
      ),
      CANCEL,
    ],
  },
  {
    id: "dt3",
    updated: TOURS_UPDATED,
    metaDescription: l(
      "Private day tour in the Osa region: a boat safari through the Sierpe mangroves and snorkelling at Caño Island, with a local naturalist guide, entrances and lunch included. Price per person by group size.",
      "Tour privado de un día en la región de Osa: safari en lancha por los manglares de Sierpe y snorkel en la Isla del Caño, con guía naturalista local, entradas y almuerzo incluidos. Precio por persona según el grupo.",
    ),
    answer: l(
      "A private day tour of {hours} in the Osa region for your group only: a boat safari through the Sierpe mangroves and snorkelling at Caño Island, with dolphins in season. A local naturalist guide, entrances and lunch are included, from {pp4} per person for 4 or more travellers ({pp1} for one traveller, green season, checked {asof}).",
      "Un día privado de {hours} en la región de Osa solo para su grupo: un safari en lancha por los manglares de Sierpe y snorkel en la Isla del Caño, con delfines en temporada. Guía naturalista local, entradas y almuerzo incluidos, desde {pp4} por persona para 4 viajeros o más ({pp1} para un viajero, temporada verde, revisado en {asof}).",
    ),
    intro: l(
      "Two sides of Osa in one day: the slow, green channels of the Térraba-Sierpe wetland, Costa Rica's largest mangrove forest, and the clear water around Caño Island, a biological reserve offshore.",
      "Dos caras de Osa en un día: los canales lentos y verdes del humedal Térraba-Sierpe, el manglar más grande de Costa Rica, y el agua clara alrededor de la Isla del Caño, una reserva biológica mar adentro.",
    ),
    start: l(
      "The tour starts and ends in Puerto Jiménez, in the Osa region, with only your group. Write where you are staying in the trip notes when you book, and our team confirms where and when the day starts.",
      "El tour empieza y termina en Puerto Jiménez, en la región de Osa, solo para su grupo. Escriba dónde se hospeda en las notas del viaje al reservar, y nuestro equipo le confirma dónde y a qué hora empieza el día.",
    ),
    parts: [
      {
        title: l("Sierpe mangrove boat safari", "Safari en lancha por los manglares de Sierpe"),
        text: l(
          "The boat goes slowly through the Térraba-Sierpe wetland to look for crocodiles, monkeys and birds.",
          "La lancha avanza despacio por el humedal Térraba-Sierpe para buscar cocodrilos, monos y aves.",
        ),
      },
      {
        title: l("Caño Island snorkelling", "Snorkel en la Isla del Caño"),
        text: l(
          "A biological reserve offshore with some of the country's clearest water for snorkelling.",
          "Una reserva biológica mar adentro, con algunas de las aguas más claras del país para hacer snorkel.",
        ),
      },
      {
        title: l("Dolphins in season", "Delfines en temporada"),
        text: l(
          "Dolphins are seen through much of the year, and humpback whales pass in season.",
          "Los delfines se ven durante buena parte del año, y las ballenas jorobadas pasan en temporada.",
        ),
      },
      {
        title: l("Lunch", "Almuerzo"),
        text: l("Lunch is part of the day and included in the price.", "El almuerzo es parte del día y está incluido en el precio."),
      },
    ],
    partsNote: WILDLIFE_HONEST,
    bring: [
      l("Swimwear, a towel and a change of clothes", "Traje de baño, toalla y una muda de ropa"),
      l("Sunscreen, a hat and sunglasses: there is little shade on the water", "Protector solar, sombrero y lentes de sol: en el agua hay poca sombra"),
      l("A waterproof bag for your phone, documents and cash", "Una bolsa impermeable para el teléfono, los documentos y el dinero"),
      l("Motion-sickness tablets if you get seasick: the ride to the island is on the open sea", "Pastillas para el mareo si se marea en el mar: el viaje a la isla es en mar abierto"),
    ],
    goodToKnow: [guideNote("drake-bay", 0)],
    faqs: [
      q(
        "How much does the Sierpe mangroves and Caño Island tour cost?",
        "¿Cuánto cuesta el tour de los manglares de Sierpe y la Isla del Caño?",
        "In green season, {pp1} per person for one traveller, {pp2} each for 2 or 3 travellers and {pp4} each for 4 or more, with the guide, entrances and lunch included. Other seasons cost more (see the price table); the exact price for your date is shown before you book.",
        "En temporada verde, {pp1} por persona para un viajero, {pp2} cada uno para 2 o 3 viajeros y {pp4} cada uno para 4 o más, con guía, entradas y almuerzo incluidos. Las otras temporadas cuestan más (vea la tabla de precios); el precio exacto para su fecha aparece antes de reservar.",
      ),
      q(
        "Does this tour go to Corcovado National Park?",
        "¿Este tour va al Parque Nacional Corcovado?",
        "No. It covers the Sierpe mangroves and Caño Island. Corcovado can only be visited with a certified guide and a SINAC permit booked in advance; the guide and the permit are booked separately.",
        "No. Incluye los manglares de Sierpe y la Isla del Caño. Corcovado solo se visita con un guía certificado y un permiso del SINAC reservados con anticipación; el guía y el permiso se reservan aparte.",
      ),
      q(
        "Will we see dolphins or whales?",
        "¿Vamos a ver delfines o ballenas?",
        "Often: dolphins are seen through much of the year, and humpback whales pass in season. Animals are wild, so no sighting is ever guaranteed.",
        "Muchas veces: los delfines se ven durante buena parte del año, y las ballenas jorobadas pasan en temporada. Los animales están en libertad, así que ningún avistamiento está garantizado.",
      ),
      q(
        "When are the seas calmest?",
        "¿Cuándo está más tranquilo el mar?",
        "December to April is the drier season, with calmer seas for the boat rides to Caño Island. It is also when lodges in the area fill up first, so book early.",
        "De diciembre a abril es la época más seca, con el mar más tranquilo para los viajes en lancha a la Isla del Caño. También es cuando los lodges de la zona se llenan primero, así que reserve con tiempo.",
      ),
      q(
        "How do I get to Sierpe or Drake Bay?",
        "¿Cómo llego a Sierpe o a Bahía Drake?",
        "A private transfer from San José airport (SJO) to the Sierpe dock takes about {time:SJO>Sierpe} and costs from {price:SJO>Sierpe} for the whole vehicle. Drake Bay is reached from Sierpe by river boat (about {boat}); our ride with the boat included costs from {price:SJO>DrakeBay}.",
        "Un traslado privado desde el aeropuerto de San José (SJO) hasta el muelle de Sierpe toma aproximadamente {time:SJO>Sierpe} y cuesta desde {price:SJO>Sierpe} por el vehículo completo. A Bahía Drake se llega desde Sierpe en lancha por el río (unas {boat}); nuestro traslado con la lancha incluida cuesta desde {price:SJO>DrakeBay}.",
      ),
      EN_ROUTE,
      CANCEL,
    ],
  },
  {
    id: "dt4",
    updated: TOURS_UPDATED,
    metaDescription: l(
      "Private day tour in Monteverde: hanging bridges through the cloud-forest canopy, a zipline and a guided night walk, with a local naturalist guide, entrances and lunch included. Price per person by group size.",
      "Tour privado de un día en Monteverde: puentes colgantes por el dosel del bosque nuboso, canopy (tirolesa) y caminata nocturna guiada, con guía naturalista local, entradas y almuerzo incluidos. Precio por persona según el grupo.",
    ),
    answer: l(
      "A private day tour of {hours} in Monteverde for your group only: hanging bridges through the cloud-forest canopy, a zipline and a guided night walk. A local naturalist guide, entrances and lunch are included, from {pp4} per person for 4 or more travellers ({pp1} for one traveller, green season, checked {asof}).",
      "Un día privado de {hours} en Monteverde solo para su grupo: puentes colgantes por el dosel del bosque nuboso, canopy (tirolesa) y una caminata nocturna guiada. Guía naturalista local, entradas y almuerzo incluidos, desde {pp4} por persona para 4 viajeros o más ({pp1} para un viajero, temporada verde, revisado en {asof}).",
    ),
    intro: l(
      "The cloud forest from three angles: walking through the treetops on suspension bridges, flying over them on a zipline, and after dark on foot with a guide, when a different set of animals comes out.",
      "El bosque nuboso desde tres ángulos: caminando entre las copas de los árboles por puentes colgantes, volando sobre ellas en un canopy, y al anochecer a pie con un guía, cuando sale otra fauna.",
    ),
    start: l(
      "The tour is in Monteverde and Santa Elena, in a private vehicle with only your group. Write your hotel in the trip notes when you book, and our team confirms where and when you are picked up.",
      "El tour es en Monteverde y Santa Elena, en un vehículo privado solo para su grupo. Escriba su hotel en las notas del viaje al reservar, y nuestro equipo le confirma dónde y a qué hora lo recogen.",
    ),
    parts: [
      {
        title: l("Hanging bridges", "Puentes colgantes"),
        text: l("Walk through the cloud-forest canopy on suspension bridges.", "Camine entre las copas del bosque nuboso por puentes colgantes."),
      },
      {
        title: l("Zipline", "Canopy (tirolesa)"),
        text: l("Fly over the canopy on a zipline.", "Vuele sobre el bosque en un canopy."),
      },
      {
        title: l("Guided night walk", "Caminata nocturna guiada"),
        text: l(
          "A guided walk after dark to look for sloths, frogs, insects and sleeping birds.",
          "Una caminata guiada al anochecer para buscar perezosos, ranas, insectos y aves dormidas.",
        ),
      },
      {
        title: l("Lunch", "Almuerzo"),
        text: l("Lunch is part of the day and included in the price.", "El almuerzo es parte del día y está incluido en el precio."),
      },
    ],
    partsNote: l(
      "The night walk is after dark, so the day ends with it. " + WILDLIFE_HONEST.en,
      "La caminata nocturna es al anochecer, así que el día termina con ella. " + WILDLIFE_HONEST.es,
    ),
    bring: [
      l("A light jacket and a rain layer: Monteverde is cooler, windier and mistier than the coast", "Una chaqueta liviana y algo para la lluvia: Monteverde es más fresco, ventoso y neblinoso que la costa"),
      l("Closed shoes with good grip and long trousers", "Zapatos cerrados con buen agarre y pantalón largo"),
      l("Insect repellent and a refillable water bottle", "Repelente de insectos y una botella de agua reutilizable"),
      l("A small bag that closes, for the zipline", "Un bolso pequeño que cierre, para el canopy"),
    ],
    goodToKnow: [guideNote("monteverde", 0)],
    faqs: [
      q(
        "How much does the Monteverde hanging bridges, zipline and night walk tour cost?",
        "¿Cuánto cuesta el tour de puentes colgantes, canopy y caminata nocturna en Monteverde?",
        "In green season, {pp1} per person for one traveller, {pp2} each for 2 or 3 travellers and {pp4} each for 4 or more, with the guide, entrances and lunch included. Other seasons cost more (see the price table); the exact price for your date is shown before you book.",
        "En temporada verde, {pp1} por persona para un viajero, {pp2} cada uno para 2 o 3 viajeros y {pp4} cada uno para 4 o más, con guía, entradas y almuerzo incluidos. Las otras temporadas cuestan más (vea la tabla de precios); el precio exacto para su fecha aparece antes de reservar.",
      ),
      q(
        "Is it cold in Monteverde at night?",
        "¿Hace frío en Monteverde en la noche?",
        "Cooler than the rest of the country. Evenings are often misty and windy, around 15–18 °C, so keep a light jacket and a rain layer at hand for the night walk.",
        "Más fresco que el resto del país. Las noches suelen ser neblinosas y ventosas, alrededor de 15–18 °C: tenga a mano una chaqueta liviana y algo para la lluvia para la caminata nocturna.",
      ),
      q(
        "Does the tour visit a cloud forest reserve?",
        "¿El tour visita una reserva de bosque nuboso?",
        "The tour's parts are the hanging bridges, the zipline and the guided night walk. If you also want a cloud forest reserve, plan it for another day: the reserves limit how many visitors are inside at once, and some sell timed tickets online, so book on each reserve's own website.",
        "Las partes del tour son los puentes colgantes, el canopy y la caminata nocturna guiada. Si además quiere visitar una reserva de bosque nuboso, planéela para otro día: las reservas limitan cuántos visitantes hay adentro al mismo tiempo, y algunas venden en línea entradas con horario, así que reserve en el sitio web de cada reserva.",
      ),
      q(
        "Is the tour private?",
        "¿El tour es privado?",
        "Yes. Only your group, with a local naturalist guide and a private vehicle; you don't share the day with other travellers.",
        "Sí. Solo su grupo, con un guía naturalista local y un vehículo privado; no comparte el día con otros viajeros.",
      ),
      q(
        "How do I get to Monteverde for the tour?",
        "¿Cómo llego a Monteverde para el tour?",
        "A private transfer from San José airport (SJO) takes about {time:SJO>Monteverde} and costs from {price:SJO>Monteverde} for the whole vehicle; from La Fortuna about {time:Arenal>Monteverde}, around Lake Arenal. Plan to arrive the day before the tour.",
        "Un traslado privado desde el aeropuerto de San José (SJO) toma aproximadamente {time:SJO>Monteverde} y cuesta desde {price:SJO>Monteverde} por el vehículo completo; desde La Fortuna, unas {time:Arenal>Monteverde}, rodeando el lago Arenal. Conviene llegar el día antes del tour.",
      ),
      EN_ROUTE,
      CANCEL,
    ],
  },
];
