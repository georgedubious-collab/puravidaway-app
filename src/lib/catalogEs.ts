/**
 * Spanish text for the catalog (vehicles, stops, tours, expeditions, lodging,
 * seasons, towns, regions), for the Spanish website under /es.
 *
 * The catalog itself lives in the database in English (edited at /admin/pricing).
 * This file translates the items that were seeded with the site, keyed by their id.
 * Anything not listed here — an item Jorge adds later in /admin/pricing — simply
 * shows its English / database text.
 *
 * Safety net: a Spanish text is used only while the database text is still the
 * original English wording (the one in src/lib/catalog.ts). If a name or
 * description is edited in /admin/pricing, the site shows the edited text in both
 * languages instead of a Spanish translation that no longer matches.
 *
 * LATER: Spanish fields in the admin pricing editor (name_es, description_es…)
 * would replace this file.
 *
 * Copy: neutral Latin American Spanish, "usted", "conductor" for driver.
 */
import {
  DAY_TOURS,
  EXPEDITIONS,
  HUBS,
  LODGING_TIERS,
  SEASONS,
  SIGHTSEEING_STOPS,
  VEHICLE_CLASSES,
  ENTRANCE_LABEL,
  REGION_NAMES,
  type HubId,
  type Region,
  type StopEntrance,
} from "./catalog";
import type { CatalogData } from "./catalogModel";
import type { PublicLang } from "./publicLang";

/** Towns and airports (HUBS in src/lib/catalog.ts). */
export const HUB_NAMES_ES: Record<HubId, string> = {
  SJO: "Aeropuerto SJO / San José",
  LIR: "Aeropuerto de Liberia (LIR)",
  Arenal: "La Fortuna / Arenal",
  ManuelAntonio: "Manuel Antonio",
  Monteverde: "Bosque nuboso de Monteverde",
  Sierpe: "Muelle de Sierpe (Osa)",
  DrakeBay: "Bahía Drake (en lancha desde Sierpe)",
  PuertoViejo: "Puerto Viejo (Caribe)",
  Tamarindo: "Tamarindo / Guanacaste",
};

export const REGION_NAMES_ES: Record<Region, string> = {
  Arenal: "La Fortuna / Arenal",
  ManuelAntonio: "Manuel Antonio / Pacífico Central",
  Osa: "Península de Osa / Sierpe / Bahía Drake",
  Monteverde: "Monteverde y Río Celeste",
};

export const ENTRANCE_LABEL_ES: Record<StopEntrance, string> = {
  free: "Parada gratuita, sin entrada",
  included: "Entrada al parque incluida",
  gate: "La entrada al parque se paga en la taquilla",
};

const VEHICLES_ES: Record<string, { name: string; badge: string; luggage: string }> = {
  economy: { name: "Sedán Económico", badge: "Conductor de habla hispana · traslado directo", luggage: "3 maletas" },
  sedan: { name: "Sedán Estándar", badge: "Mejor precio", luggage: "3 maletas" },
  suv: { name: "SUV Confort Estándar", badge: "Amplio para 4 + equipaje", luggage: "4 maletas" },
  "4x4": { name: "4x4 Ejecutivo (Prado / Fortuner)", badge: "Caminos de Osa / Monteverde", luggage: "4 maletas" },
  van: { name: "Toyota HiAce / Hyundai Staria privada", badge: "Familias y grupos", luggage: "10 maletas" },
  sierpe_combo: {
    name: "Traslado en 4x4 + lancha por el río Sierpe",
    badge: "Bahía Drake / Corcovado",
    luggage: "Ayuda con el equipaje al embarcar",
  },
};

const STOPS_ES: Record<string, { name: string; description: string }> = {
  tarcoles: {
    name: "Puente de los cocodrilos de Tárcoles",
    description:
      "Observe cocodrilos americanos de hasta 4,5 m desde el famoso puente mientras su conductor se queda con el equipaje.",
  },
  carara: {
    name: "Caminata de las lapas rojas en el Parque Nacional Carara",
    description: "Caminata guiada por un bosque lluvioso de transición lleno de lapas rojas en libertad.",
  },
  poas: {
    name: "Cráter del volcán Poás y finca de café Doka",
    description:
      "Asómese a un lago turquesa en un cráter activo y luego pruebe café arábica de altura. Se requieren entradas con horario asignado.",
  },
  rioceleste: {
    name: "Caminata a la catarata de Río Celeste",
    description: "Camine hasta el río azul celeste dentro del Parque Nacional Volcán Tenorio.",
  },
  sloth: {
    name: "Sendero de perezosos y vida silvestre de La Fortuna",
    description: "Vea perezosos de dos y de tres dedos en un sendero guiado sobre pasarelas cerca de La Fortuna.",
  },
};

const DAY_TOURS_ES: Record<string, { name: string; highlights: string[] }> = {
  dt1: {
    name: "Senderos de lava de 1968 del volcán Arenal, catarata de La Fortuna y aguas termales",
    highlights: ["Senderos sobre campos de lava", "Catarata de La Fortuna", "Baño en aguas termales"],
  },
  dt2: {
    name: "Caminata de vida silvestre en el Parque Nacional Manuel Antonio + catamarán con snorkel",
    highlights: ["Guía naturalista con telescopio", "Perezosos, monos y tucanes", "Catamarán por la tarde"],
  },
  dt3: {
    name: "Safari en lancha por los manglares de Sierpe y snorkel en la Isla del Caño",
    highlights: ["Vida silvestre del manglar", "Arrecife de la Isla del Caño", "Delfines en temporada"],
  },
  dt4: {
    name: "Puentes colgantes, canopy y caminata nocturna en Monteverde",
    highlights: ["Dosel del bosque nuboso", "Canopy (tirolesa)", "Caminata nocturna guiada"],
  },
};

const EXPEDITIONS_ES: Record<string, { name: string; includes: string[]; itinerary: string[] }> = {
  md1: {
    name: "Parque Nacional Corcovado — noche en la Estación Sirena (vía Sierpe)",
    includes: [
      "Traslados en lancha Sierpe → Bahía Drake → Sirena",
      "Permisos oficiales del SINAC para pasar la noche",
      "Comidas en la Estación de Guardaparques Sirena",
      "Guía naturalista certificado de Osa",
    ],
    itinerary: [
      "Manglares de Sierpe → Bahía Drake, atardecer en la playa",
      "Lancha a Sirena, día completo de senderos, noche en el parque",
      "Caminata de vida silvestre al amanecer, lancha de regreso a Sierpe",
    ],
  },
  md2: {
    name: "La trilogía clásica de Costa Rica: Arenal, Monteverde y Manuel Antonio",
    includes: [
      "Traslados puerta a puerta con paradas turísticas",
      "Cruce en lancha por el lago Arenal",
      "Puentes colgantes de Monteverde",
      "Tour guiado en Manuel Antonio",
      "Asistencia por WhatsApp",
    ],
    itinerary: [
      "SJO → La Fortuna con parada en el volcán Poás",
      "Senderos de lava del Arenal y aguas termales",
      "Cruce en lancha por el lago Arenal → Monteverde",
      "Puentes colgantes, canopy y caminata nocturna",
      "Monteverde → Manuel Antonio con parada en Tárcoles",
      "Caminata de vida silvestre en el PN Manuel Antonio y catamarán",
      "Manuel Antonio → SJO",
    ],
  },
};

const LODGING_TIERS_ES: Record<string, string> = {
  base: "Básico (estación de guardaparques / estándar)",
  boutique: "Eco-resort boutique de 4 estrellas",
  luxury: "Lodge de lujo de 5 estrellas",
};

const SEASONS_ES: Record<string, string> = {
  green: "Temporada verde",
  high: "Temporada alta (dic.–abr.)",
  peak: "Temporada pico (Navidad / Año Nuevo / Semana Santa)",
};

/** Spanish only while the database text is still the seeded English wording. */
function pick(current: string, seeded: string | undefined, es: string | undefined): string {
  return es && seeded !== undefined && current === seeded ? es : current;
}

/** Name of a town / airport in `lang`. */
export function hubName(id: HubId, lang: PublicLang): string {
  return lang === "es" ? HUB_NAMES_ES[id] : (HUBS.find((h) => h.id === id)?.name ?? id);
}

/**
 * A booking's stored pickup / drop-off text in `lang`. Bookings keep our towns under
 * their English name ("Liberia Airport (LIR)"); a typed address stays as the traveller wrote it.
 */
export function placeNameFor(text: string | null | undefined, lang: PublicLang): string {
  const s = text ?? "";
  if (lang !== "es") return s;
  const hub = HUBS.find((h) => h.name === s);
  return hub ? HUB_NAMES_ES[hub.id] : s;
}

export function regionName(region: Region, lang: PublicLang): string {
  return (lang === "es" ? REGION_NAMES_ES : REGION_NAMES)[region];
}

export function entranceLabel(entrance: StopEntrance, lang: PublicLang): string {
  return (lang === "es" ? ENTRANCE_LABEL_ES : ENTRANCE_LABEL)[entrance];
}

/**
 * Catalog texts we no longer show as written, replaced at display time
 * (docs/PROJECT.md §10: only claims that are true and confirmed):
 * - "Most popular" (no booking data behind it) → a factual label.
 * - "24/7 WhatsApp concierge" (round-the-clock staffing isn't confirmed) → "WhatsApp support".
 * The database rows still hold the old text: edit them in /admin/pricing and
 * these lines become no-ops. The Spanish texts above already use the new wording.
 */
const CLAIM_REPLACEMENTS: Record<string, string> = {
  "Most popular": "Roomy for 4 + bags",
  "24/7 WhatsApp concierge": "WhatsApp support",
};

function withFactualClaims(catalog: CatalogData): CatalogData {
  const fix = (s: string) => CLAIM_REPLACEMENTS[s] ?? s;
  return {
    ...catalog,
    vehicles: catalog.vehicles.map((v) => ({ ...v, badge: fix(v.badge) })),
    expeditions: catalog.expeditions.map((e) => ({ ...e, includes: e.includes.map(fix) })),
  };
}

/**
 * The catalog with its customer-facing text in `lang`. Prices, ids and
 * everything else are untouched, so pricing works exactly the same. English
 * returns the same object.
 */
export function localizeCatalog(rawCatalog: CatalogData, lang: PublicLang): CatalogData {
  if (lang !== "es") return withFactualClaims(rawCatalog);
  const catalog = rawCatalog;
  return {
    ...catalog,
    vehicles: catalog.vehicles.map((v) => {
      const es = VEHICLES_ES[v.id];
      const seed = VEHICLE_CLASSES.find((x) => x.id === v.id);
      if (!es || !seed) return v;
      return {
        ...v,
        name: pick(v.name, seed.name, es.name),
        badge: pick(v.badge, seed.badge, es.badge),
        luggage: pick(v.luggage, seed.luggage, es.luggage),
      };
    }),
    stops: catalog.stops.map((s) => {
      const es = STOPS_ES[s.id];
      const seed = SIGHTSEEING_STOPS.find((x) => x.id === s.id);
      if (!es || !seed) return s;
      return {
        ...s,
        name: pick(s.name, seed.name, es.name),
        description: pick(s.description, seed.description, es.description),
      };
    }),
    dayTours: catalog.dayTours.map((t) => {
      const es = DAY_TOURS_ES[t.id];
      const seed = DAY_TOURS.find((x) => x.id === t.id);
      if (!es || !seed) return t;
      return {
        ...t,
        name: pick(t.name, seed.name, es.name),
        highlights: t.highlights.map((h, i) => pick(h, seed.highlights[i], es.highlights[i])),
      };
    }),
    expeditions: catalog.expeditions.map((e) => {
      const es = EXPEDITIONS_ES[e.id];
      const seed = EXPEDITIONS.find((x) => x.id === e.id);
      if (!es || !seed) return e;
      return {
        ...e,
        name: pick(e.name, seed.name, es.name),
        includes: e.includes.map((x, i) => pick(x, seed.includes[i], es.includes[i])),
        itinerary: e.itinerary.map((d, i) => ({ ...d, title: pick(d.title, seed.itinerary[i]?.title, es.itinerary[i]) })),
      };
    }),
    lodgingTiers: catalog.lodgingTiers.map((t) => ({
      ...t,
      name: pick(t.name, LODGING_TIERS.find((x) => x.id === t.id)?.name, LODGING_TIERS_ES[t.id]),
    })),
    seasons: catalog.seasons.map((s) => ({
      ...s,
      name: pick(s.name, SEASONS.find((x) => x.id === s.id)?.name, SEASONS_ES[s.id]),
    })),
  };
}
