import "server-only";
import { perPersonTierCents, stopFitsRoute } from "./catalog";
import { seasonForYmd } from "./catalogModel";
import { hubName, localizeCatalog, regionName } from "./catalogEs";
import { getCatalog } from "./catalogSource";
import { isValidPickupTime, isValidYmd, todayInCostaRica } from "./dates";
import { isNightPickup, nightPremiumOn } from "./nightPremium";
import { MapsError, resolvePlace, rideRoute } from "./googleMaps";
import { isAirportPickup, isHubPlace } from "./places";
import { applyMultiplier, perPersonCents, perPersonShare, quoteDayTour, quoteTransfer } from "./pricing";
import type { PublicLang } from "./publicLang";
import { LEGACY_MIN_OFFER_USD } from "./tripRequest";

/**
 * Prices for the traveller app. The app never calculates a price itself: it
 * sends the places, date, travellers and chosen stops, and shows what comes
 * back. The same functions price the website, and the server prices the trip
 * again when the request is sent.
 */
export interface RideQuote {
  /** The pieces of the trip item the app sends back when booking. */
  base: {
    origin: string;
    destination: string;
    originPlace?: { id: string; label: string };
    destinationPlace?: { id: string; label: string };
  };
  originLabel: string;
  destinationLabel: string;
  airportPickup: boolean;
  minutes: number;
  km: number | null;
  ferries: number;
  season: { name: string; percent: number };
  /**
   * Night pickups (pricing_settings, /admin/pricing): the premium in percent (20 = +20%; 0 = none
   * configured), the window's hours in Costa Rica time (from startHour up to, not including,
   * endHour) and whether it applies to the pickup time this quote was asked for. When it
   * applies, every vehicle's totalCents already includes it. App builds from before this field
   * send no time, so it never applies to them.
   */
  night: { percent: number; startHour: number; endHour: number; applies: boolean };
  cashFeeBps: number;
  /**
   * Kept only for customer-app builds from before 2026-11-11, which still read it (their offer
   * input). Travellers book at the fixed price only; the server refuses offers.
   */
  minOfferCents: number;
  vehicles: {
    id: string;
    name: string;
    /** Example models ("Toyota Prado") or "". The app shows it as "... or similar", never alone. */
    exampleModels: string;
    badge: string;
    maxPax: number;
    luggage: string;
    allowsStops: boolean;
    spanishSpeakingDriver: boolean;
    /** Exact total for this vehicle with the chosen stops (stops ignored where the vehicle doesn't allow them). */
    totalCents: number;
    /** Night-pickup premium inside totalCents (0 by day). */
    nightCents: number;
    /** Daytrip-style "from $X per person": the car shared by a full car (see perPersonCents). */
    perPersonCents: number;
    perPersonShare: number;
  }[];
  /** `cents` is the whole stop for this group; `tourPerPersonCents` > 0 when it includes a guided visit per person. */
  stops: { id: string; name: string; description: string; durationMin: number; cents: number; tourPerPersonCents: number; entrance: string }[];
}

export class QuoteError extends Error {}

/** `lang` only changes the words (names, badges, luggage, stops, season); ids and prices are the same in both languages. */
export async function rideQuote(input: {
  from: string;
  to: string;
  date: string;
  /** Pickup time "HH:MM" (Costa Rica). Optional: older app builds don't send it and get the daytime price. */
  time?: string | null;
  pax: number;
  stopIds: string[];
  lang?: PublicLang;
}): Promise<RideQuote> {
  const lang: PublicLang = input.lang === "es" ? "es" : "en";
  if (input.time != null && input.time !== "" && !isValidPickupTime(input.time)) throw new QuoteError("Pick a pickup time.");
  const pickupTime = input.time || null;
  const today = todayInCostaRica();
  if (!isValidYmd(input.date) || input.date < today) throw new QuoteError("Pick a travel date from today onwards.");
  if (!Number.isInteger(input.pax) || input.pax < 1 || input.pax > 10) throw new QuoteError("Choose 1 to 10 travellers.");
  let origin, destination, route;
  try {
    [origin, destination] = await Promise.all([resolvePlace(input.from), resolvePlace(input.to)]);
    if (origin.id === destination.id) throw new QuoteError("Pick a different drop-off.");
    route = await rideRoute(origin, destination);
  } catch (e) {
    if (e instanceof MapsError || e instanceof QuoteError) throw new QuoteError(e.message);
    throw e;
  }
  const catalog = localizeCatalog(await getCatalog(), lang);
  const season = seasonForYmd(input.date, catalog);
  const fits = catalog.stops.filter((s) => stopFitsRoute(s, origin.hub, destination.hub));
  const stopIds = input.stopIds.filter((id) => fits.some((s) => s.id === id));
  const vehicles = catalog.vehicles.filter(
    (v) => v.maxPax >= input.pax && (!v.onlyForHubs || v.onlyForHubs.includes(origin.hub) || v.onlyForHubs.includes(destination.hub)),
  );
  // Our town names for hubs; the looked-up label for typed places.
  const label = (p: typeof origin) => (isHubPlace(p) ? hubName(p.hub, lang) : p.label);

  const quotes = vehicles.map((v) => ({
    v,
    q: quoteTransfer({
      origin: origin.hub,
      destination: destination.hub,
      vehicleId: v.id,
      stopIds: v.allowsStops ? stopIds : [],
      season,
      catalog,
      route,
      pax: input.pax,
      pickupTime,
    }),
  }));
  const first = quotes[0]?.q;
  return {
    base: {
      origin: origin.hub,
      destination: destination.hub,
      ...(isHubPlace(origin) ? {} : { originPlace: { id: origin.id, label: origin.label } }),
      ...(isHubPlace(destination) ? {} : { destinationPlace: { id: destination.id, label: destination.label } }),
    },
    originLabel: label(origin),
    destinationLabel: label(destination),
    airportPickup: isAirportPickup(origin),
    minutes: first?.driveMinutes ?? 0,
    km: route ? Math.round(route.km) : null,
    ferries: route?.ferries ?? 0,
    season: { name: season.name, percent: Math.round((season.multiplierBps - 10000) / 100) },
    night: {
      percent: nightPremiumOn(catalog.nightPremium) ? catalog.nightPremium.bps / 100 : 0,
      startHour: catalog.nightPremium.startHour,
      endHour: catalog.nightPremium.endHour,
      applies: isNightPickup(pickupTime, catalog.nightPremium),
    },
    cashFeeBps: catalog.cashFeeBps,
    minOfferCents: LEGACY_MIN_OFFER_USD * 100,
    vehicles: quotes.map(({ v, q }) => ({
      id: v.id,
      name: v.name,
      exampleModels: v.exampleModels,
      badge: v.badge,
      maxPax: v.maxPax,
      luggage: v.luggage,
      allowsStops: v.allowsStops,
      spanishSpeakingDriver: v.spanishSpeakingDriver,
      totalCents: q.totalCents,
      nightCents: q.nightCents,
      perPersonCents: perPersonCents(q.totalCents, v.maxPax),
      perPersonShare: perPersonShare(v.maxPax),
    })),
    stops: fits.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      cents: applyMultiplier(s.priceCents + s.tourPerPersonCents * input.pax, season.multiplierBps),
      tourPerPersonCents: applyMultiplier(s.tourPerPersonCents, season.multiplierBps),
      entrance: s.entrance,
    })),
  };
}

export interface TourQuote {
  id: string;
  name: string;
  region: string;
  regionName: string;
  durationHours: number;
  highlights: string[];
  perPersonCents: number;
  totalCents: number;
  /** Total with the Smart En-Route Transfer (end the day at the next hotel). */
  totalWithUpgradeCents: number;
}

/** Day tours with the total for this group and date. */
export async function tourQuotes(date: string, pax: number, lang: PublicLang = "en"): Promise<{ tours: TourQuote[]; cashFeeBps: number }> {
  const today = todayInCostaRica();
  if (!isValidYmd(date) || date < today) throw new QuoteError("Pick a date from today onwards.");
  if (!Number.isInteger(pax) || pax < 1 || pax > 10) throw new QuoteError("Choose 1 to 10 travellers.");
  const catalog = localizeCatalog(await getCatalog(), lang);
  const season = seasonForYmd(date, catalog);
  return {
    cashFeeBps: catalog.cashFeeBps,
    tours: catalog.dayTours.map((t) => ({
      id: t.id,
      name: t.name,
      region: t.region,
      regionName: regionName(t.region, lang),
      durationHours: t.durationHours,
      highlights: t.highlights,
      perPersonCents: applyMultiplier(perPersonTierCents(t.perPerson, pax), season.multiplierBps),
      totalCents: quoteDayTour(t.id, false, pax, season, catalog),
      totalWithUpgradeCents: quoteDayTour(t.id, true, pax, season, catalog),
    })),
  };
}
