/**
 * Route landing pages (/transfers/<slug> and /es/traslados/<slug>): the "website" layer
 * that ranks on Google and drops travellers into the trip builder with the ride pre-filled.
 *
 * The pages are assembled here from data (src/lib/routes/): one block per town, one per
 * pair of towns ("corridor"), each corridor giving two pages, A → B and B → A. To add a
 * route, add a corridor to src/lib/routes/corridorsAirports.ts or corridorsTowns.ts.
 * Prices, drive times, distances and stops come from the catalog, never from the text.
 */
import { DRAKE_BOAT_MINUTES, routeKm, routeMinutes, type HubId } from "./catalog";
import type { L, OtherWay } from "./guides/types";
import type { PublicLang } from "./publicLang";
import { AIRPORT_CORRIDORS } from "./routes/corridorsAirports";
import { TOWN_CORRIDORS } from "./routes/corridorsTowns";
import { HUB_BLOCKS } from "./routes/hubs";
import type { Corridor, RouteFaq } from "./routes/types";

/** Every corridor. The first ones are the routes shown as "Popular routes" on the home page and in the footer. */
export const CORRIDORS: Corridor[] = [...AIRPORT_CORRIDORS.slice(0, 6), ...TOWN_CORRIDORS.slice(0, 2), ...AIRPORT_CORRIDORS.slice(6), ...TOWN_CORRIDORS.slice(2)];

export interface RoutePage {
  slug: string;
  origin: HubId;
  destination: HubId;
  /** ISO date the facts were last checked. */
  updated: string;
  /** H1 and <title>. */
  title: L;
  metaDescription: L;
  /** The dated direct answer (tokens), then one or two sentences about this direction. */
  answer: L;
  lead: L;
  /** Where the ride starts and ends: "your hotel in Manuel Antonio or Quepos". */
  pickupPlace: L;
  dropoffPlace: L;
  road: L;
  stopsNote?: L;
  ways: OtherWay[];
  /** 7 questions: this direction, the pair, the pickup town, the arrival town, the price. */
  faqs: RouteFaq[];
}

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "November 2026" / "noviembre de 2026" from an ISO date. */
function monthYear(iso: string): L {
  const [y, m] = iso.split("-").map(Number);
  return { en: `${MONTHS_EN[m - 1]} ${y}`, es: `${MONTHS_ES[m - 1]} de ${y}` };
}

function buildPage(c: Corridor, origin: HubId, destination: HubId): RoutePage {
  const forward = origin === c.a;
  const dir = forward ? c.ab : c.ba;
  const o = HUB_BLOCKS[origin];
  const d = HUB_BLOCKS[destination];
  const pair = `${origin}>${destination}`;
  const when = monthYear(c.updated);
  const boat = origin === "DrakeBay" || destination === "DrakeBay";
  // The road part of a Drake Bay trip is the ride to or from the Sierpe dock.
  const roadPair = origin === "DrakeBay" ? `Sierpe>${destination}` : destination === "DrakeBay" ? `${origin}>Sierpe` : pair;
  return {
    slug: forward && c.legacySlug ? c.legacySlug : `${o.slug}-to-${d.slug}`,
    origin,
    destination,
    updated: c.updated,
    title: {
      en: `Private transfer from ${o.name.en} to ${d.name.en}`,
      es: `Traslado privado ${o.esFrom} ${d.esTo}`,
    },
    metaDescription: {
      en: `Private door-to-door ride from ${o.long} to ${d.long}. Fixed price per vehicle, ${c.hook.en}, local partner drivers.`,
      es: `Traslado privado puerta a puerta ${o.esFromLong} ${d.esToLong}. Precio fijo por vehículo, ${c.hook.es}, conductores locales asociados.`,
    },
    answer: boat
      ? {
          en: `A private transfer from ${o.name.en} to ${d.name.en} takes about {time:${pair}} door to door: about {time:${roadPair}} by road ({km:${roadPair}} km) ${origin === "DrakeBay" ? "from" : "to"} the Sierpe dock, and about {boat} by river boat. It costs from {price:${pair}} for the whole vehicle with the boat included, not per person, for up to {pax:${pair}} travellers (green-season price, checked ${when.en}).`,
          es: `Un traslado privado ${o.esFrom} ${d.esTo} toma aproximadamente {time:${pair}} de puerta a puerta: {time:${roadPair}} por carretera ({km:${roadPair}} km) ${origin === "DrakeBay" ? "desde" : "hasta"} el muelle de Sierpe, y {boat} en lancha por el río. Cuesta desde {price:${pair}} por el vehículo completo con la lancha incluida, no por persona, para hasta {pax:${pair}} viajeros (precio de temporada verde, revisado en ${when.es}).`,
        }
      : {
          en: `A private transfer from ${o.name.en} to ${d.name.en} takes about {time:${pair}} door to door ({km:${pair}} km by road) and costs from {price:${pair}} for the whole vehicle, not per person, for up to {pax:${pair}} travellers (green-season price, checked ${when.en}).`,
          es: `Un traslado privado ${o.esFrom} ${d.esTo} toma aproximadamente {time:${pair}} de puerta a puerta ({km:${pair}} km por carretera) y cuesta desde {price:${pair}} por el vehículo completo, no por persona, para hasta {pax:${pair}} viajeros (precio de temporada verde, revisado en ${when.es}).`,
        },
    lead: dir.lead,
    pickupPlace: o.place,
    dropoffPlace: d.place,
    road: c.road,
    stopsNote: c.stopsNote,
    ways: c.ways,
    faqs: [
      dir.faq,
      ...c.faqs,
      o.pickupFaq(origin, destination),
      d.arrivalFaq(origin, destination),
      {
        q: {
          en: `Is the price from ${o.name.en} to ${d.name.en} per person?`,
          es: `¿El precio ${o.esFrom} ${d.esTo} es por persona?`,
        },
        a: {
          en: `No. {price:${pair}} is the green-season price of the whole vehicle ${boat ? "with the boat included" : "in the cheapest class"}, for up to {pax:${pair}} travellers; larger vehicles cost more. The exact price for your date, vehicle and stops is shown before you book.`,
          es: `No. {price:${pair}} es el precio de temporada verde del vehículo completo ${boat ? "con la lancha incluida" : "en la categoría más económica"}, para hasta {pax:${pair}} viajeros; los vehículos más grandes cuestan más. El precio exacto para su fecha, vehículo y paradas aparece antes de reservar.`,
        },
      },
    ],
  };
}

/** All route pages: every corridor A → B first (the original nine keep their place at the top), then every B → A. */
export const ROUTE_PAGES: RoutePage[] = [...CORRIDORS.map((c) => buildPage(c, c.a, c.b)), ...CORRIDORS.map((c) => buildPage(c, c.b, c.a))];

/**
 * Build-time check (like the token check in src/lib/guides): every page must have a
 * unique slug, a drive time and a distance in the catalog (the price formula needs the
 * km), and 5–8 FAQs. Anything missing throws here, which fails `npm run build`.
 */
function assertRoutePages(pages: RoutePage[]): void {
  const slugs = new Set<string>();
  for (const p of pages) {
    const name = `Route page ${p.slug}`;
    if (slugs.has(p.slug)) throw new Error(`${name}: duplicate slug`);
    slugs.add(p.slug);
    if (p.origin === p.destination) throw new Error(`${name}: same pickup and drop-off`);
    const minutes = routeMinutes(p.origin, p.destination);
    const road = minutes - (p.origin === "DrakeBay" || p.destination === "DrakeBay" ? DRAKE_BOAT_MINUTES : 0);
    if (!(minutes > 0 && road > 0)) throw new Error(`${name}: no drive time in ROUTE_MINUTES (src/lib/catalog.ts)`);
    if (!(routeKm(p.origin, p.destination) > 0)) throw new Error(`${name}: no road distance in ROUTE_KM (src/lib/catalog.ts), so no price source`);
    if (p.faqs.length < 5 || p.faqs.length > 8) throw new Error(`${name}: ${p.faqs.length} FAQs (5 to 8 expected)`);
    if (p.ways.length < 3) throw new Error(`${name}: "other ways to get there" needs at least bus, shuttle and car`);
  }
}
assertRoutePages(ROUTE_PAGES);

export function routePage(slug: string): RoutePage | undefined {
  return ROUTE_PAGES.find((p) => p.slug === slug);
}

/** The landing page for exactly this origin → destination, if one exists. */
export function routePageFor(origin: HubId, destination: HubId): RoutePage | undefined {
  return ROUTE_PAGES.find((p) => p.origin === origin && p.destination === destination);
}

/** English path of the index of all route pages (Spanish: /es/traslados). */
export const TRANSFERS_PATH = "/transfers";

/** English path of a route page; localizedHref() gives the Spanish one. */
export const routePath = (p: Pick<RoutePage, "slug">) => `${TRANSFERS_PATH}/${p.slug}`;

/** Link for a related ride: its landing page when there is one, otherwise the trip builder. */
export function relatedHref(origin: HubId, destination: HubId): string {
  const page = routePageFor(origin, destination);
  return page ? routePath(page) : builderHref(origin, destination);
}

export function builderHref(origin: HubId, destination: HubId): string {
  return `/?from=${origin}&to=${destination}`;
}

/** Short label of a route for menus and lists: "SJO Airport to Manuel Antonio" / "Aeropuerto SJO a Manuel Antonio". */
export function routeLabel(p: Pick<RoutePage, "origin" | "destination">, lang: PublicLang): string {
  const o = HUB_BLOCKS[p.origin];
  const d = HUB_BLOCKS[p.destination];
  return lang === "es" ? `${o.name.es.replace(/^./, (ch) => ch.toUpperCase())} ${d.esTo}` : `${o.name.en} to ${d.name.en}`;
}
