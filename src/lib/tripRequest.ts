/**
 * What a cart item IS (not just how it's described), so the server can
 * re-price it from the catalog before saving a booking. Shared by the
 * browser (building items) and the server (checking them).
 */
import { HUBS, stopFitsRoute, type HubId } from "./catalog";
import { seasonForYmd, type CatalogData } from "./catalogModel";
import { DEFAULT_PICKUP_TIME, DEFAULT_TOUR_TIME, isValidPickupTime, isValidYmd } from "./dates";
import { cleanPlaceLabel, isGooglePlaceId, type RideRoute } from "./places";
import { hasContactDetails, parsePrefs, type RidePrefs } from "./preferences";
import { quoteDayTour, quoteTransfer } from "./pricing";
import { cleanSignText, signTextProblem } from "./sign";

export const MIN_OFFER_USD = 50;
export const MAX_OFFER_USD = 5000;
export const MAX_TRIP_ITEMS = 10;
/** Most large suitcases, and most carry-ons, a traveller can enter (bookings.luggage_count / carry_on_count checks, migrations 0035 and 0037). */
export const MAX_BAGS = 20;

/** A typed pickup / drop-off (Google place id + what the traveller saw). */
export interface SpecPlace {
  id: string;
  label: string;
}

export type ItemSpec =
  | {
      kind: "transfer";
      /** Our town, or the nearest town to a typed place (area factor, stops). */
      origin: HubId;
      destination: HubId;
      /**
       * Typed places (docs/PRICING.md step 3). When either is set the price uses
       * Google's road route between them; the server looks the places up again
       * by id and never trusts coordinates from the browser.
       */
      originPlace?: SpecPlace;
      destinationPlace?: SpecPlace;
      vehicleId: string;
      stopIds: string[];
      pax: number;
      /**
       * Pickup time, Costa Rica time, "HH:MM" (any hour, quarter hours). A time in the night
       * window costs the night premium (src/lib/nightPremium.ts).
       * Items saved before this field existed load with DEFAULT_PICKUP_TIME.
       */
      pickupTime: string;
      /** "bid": the traveller's own offer replaces the fixed price. */
      pricing: "fixed" | "bid";
      offerCents?: number;
      /** Flight number or hotel. */
      notes?: string;
      prefs?: RidePrefs;
      /** Message for the driver (no contact details). */
      driverNotes?: string;
      /** Suitcases and large backpacks (0–20), optional; shown to the driver. */
      bags?: number;
      /** Carry-on bags (0–20). `bags` above is the large suitcases; older app builds send only `bags`. */
      carryOns?: number;
      /**
       * Name sign at the pickup (src/lib/sign.ts): what the traveller wants written on it (up to 40
       * characters, no contact details). Empty = their first name + last initial.
       */
      signText?: string;
      /** "Don't show my name": the sign shows our brand name. Ignored when signText is given. */
      signHideName?: boolean;
    }
  | {
      kind: "day_tour";
      tourId: string;
      upgrade: boolean;
      /** Travellers (per-person pricing). Items saved before 2026-11-09 load as 2. */
      pax: number;
    };

/**
 * Multi-day trips were retired on 2026-11-11 (transfers and 1-day tours only). A page or app
 * build opened before then can still send one; the server refuses it with this message
 * (Spanish in src/lib/serverMessagesEs.ts).
 */
export const RETIRED_EXPEDITION_ERROR =
  "Multi-day trips are no longer offered. Please remove that item from your trip; private transfers and 1-day tours are still available.";

/** True for a cart item sent as a multi-day trip ("expedition") by an older page or app. */
export function isRetiredExpeditionSpec(raw: unknown): boolean {
  return Boolean(raw && typeof raw === "object" && (raw as Record<string, unknown>).kind === "expedition");
}

/** Start time stored with the booking: the ride's pickup time, or the default for tours. */
export function itemTime(spec: ItemSpec): string {
  return spec.kind === "transfer" ? spec.pickupTime : DEFAULT_TOUR_TIME;
}

const HUB_IDS = new Set<string>(HUBS.map((h) => h.id));
const str = (v: unknown, max = 60) => typeof v === "string" && v.length > 0 && v.length <= max;

/** undefined = not given, null = malformed. */
function parseSpecPlace(v: unknown): SpecPlace | undefined | null {
  if (v === undefined) return undefined;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const label = cleanPlaceLabel(o.label);
  return isGooglePlaceId(o.id) && label ? { id: o.id, label } : null;
}

/** Validate untrusted input (browser storage or a request). Returns null if malformed. */
export function parseSpec(raw: unknown): ItemSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === "transfer") {
    if (!str(o.origin) || !str(o.destination) || !HUB_IDS.has(o.origin as string) || !HUB_IDS.has(o.destination as string)) return null;
    if (!str(o.vehicleId)) return null;
    if (!Array.isArray(o.stopIds) || o.stopIds.length > 10 || !o.stopIds.every((s) => str(s))) return null;
    if (!Number.isInteger(o.pax) || (o.pax as number) < 1 || (o.pax as number) > 60) return null;
    if (o.pickupTime !== undefined && !isValidPickupTime(o.pickupTime)) return null;
    if (o.pricing !== "fixed" && o.pricing !== "bid") return null;
    if (o.pricing === "bid" && (!Number.isInteger(o.offerCents) || (o.offerCents as number) <= 0)) return null;
    if (o.notes !== undefined && (typeof o.notes !== "string" || o.notes.length > 500)) return null;
    const prefs = o.prefs === undefined ? undefined : parsePrefs(o.prefs);
    if (prefs === null) return null;
    if (o.driverNotes !== undefined && (typeof o.driverNotes !== "string" || o.driverNotes.length > 500)) return null;
    if (o.bags !== undefined && o.bags !== null && (!Number.isInteger(o.bags) || (o.bags as number) < 0 || (o.bags as number) > MAX_BAGS)) return null;
    if (o.carryOns !== undefined && o.carryOns !== null && (!Number.isInteger(o.carryOns) || (o.carryOns as number) < 0 || (o.carryOns as number) > MAX_BAGS)) return null;
    // Name sign: a readable error for a long text or contact details comes from priceItem().
    if (o.signText !== undefined && o.signText !== null && (typeof o.signText !== "string" || o.signText.length > 200)) return null;
    if (o.signHideName !== undefined && o.signHideName !== null && typeof o.signHideName !== "boolean") return null;
    const signText = cleanSignText(o.signText);
    const originPlace = parseSpecPlace(o.originPlace);
    const destinationPlace = parseSpecPlace(o.destinationPlace);
    if (originPlace === null || destinationPlace === null) return null;
    return {
      kind: "transfer",
      origin: o.origin as HubId,
      destination: o.destination as HubId,
      ...(originPlace ? { originPlace } : {}),
      ...(destinationPlace ? { destinationPlace } : {}),
      vehicleId: o.vehicleId as string,
      stopIds: o.stopIds as string[],
      pax: o.pax as number,
      pickupTime: (o.pickupTime as string | undefined) ?? DEFAULT_PICKUP_TIME,
      pricing: o.pricing,
      offerCents: o.pricing === "bid" ? (o.offerCents as number) : undefined,
      notes: (o.notes as string | undefined) || undefined,
      prefs,
      driverNotes: (o.driverNotes as string | undefined) || undefined,
      ...(typeof o.bags === "number" ? { bags: o.bags } : {}),
      ...(typeof o.carryOns === "number" ? { carryOns: o.carryOns } : {}),
      ...(signText ? { signText } : o.signHideName === true ? { signHideName: true } : {}),
    };
  }
  if (o.kind === "day_tour") {
    if (!str(o.tourId) || typeof o.upgrade !== "boolean") return null;
    if (o.pax !== undefined && (!Number.isInteger(o.pax) || (o.pax as number) < 1 || (o.pax as number) > 60)) return null;
    return { kind: "day_tour", tourId: o.tourId as string, upgrade: o.upgrade, pax: (o.pax as number | undefined) ?? 2 };
  }
  // "expedition" (retired multi-day trips) and anything else: not bookable.
  return null;
}

export interface PricedItem {
  totalCents: number;
  /** Fixed catalog price, for reference when the traveller made an offer. */
  referenceCents: number;
  /** Costs the driver pays out of pocket and gets back in full (ferry tickets); see src/lib/payout.ts. */
  passThroughCents: number;
  /** Entrances, lunch and activities the company pays; deducted before the driver's share. */
  companyCostCents: number;
  /** Night-pickup premium inside totalCents (0 by day, on tours and custom offers). */
  nightCents: number;
}

/**
 * Price one item from the catalog for its travel date. Throws a readable
 * Error when the item can't be booked as specified (e.g. vehicle switched off).
 * Rides with a typed place need `route`, looked up on the server
 * (src/lib/googleMaps.ts, resolveTransfer).
 */
export function priceItem(spec: ItemSpec, date: string, catalog: CatalogData, route?: RideRoute | null): PricedItem {
  if (!isValidYmd(date)) throw new Error("A travel date is missing.");
  const season = seasonForYmd(date, catalog);

  if (spec.kind === "transfer") {
    const typed = Boolean(spec.originPlace || spec.destinationPlace);
    if (typed && !route) throw new Error("We couldn't check the road distance for this ride. Please try again.");
    if (!typed && spec.origin === spec.destination) throw new Error("Pickup and drop-off are the same place.");
    if (spec.originPlace && spec.originPlace.id === spec.destinationPlace?.id) {
      throw new Error("Pickup and drop-off are the same place.");
    }
    if (spec.driverNotes && hasContactDetails(spec.driverNotes)) {
      throw new Error("Please keep phone numbers, emails and links out of the message for your driver. You can message your driver in the trip chat once confirmed.");
    }
    const signProblem = signTextProblem(cleanSignText(spec.signText), hasContactDetails);
    if (signProblem) throw new Error(signProblem);
    const vehicle = catalog.vehicles.find((v) => v.id === spec.vehicleId);
    if (!vehicle) throw new Error("That vehicle is no longer offered. Please choose another.");
    if (vehicle.maxPax < spec.pax) throw new Error(`The ${vehicle.name} seats up to ${vehicle.maxPax}.`);
    if (vehicle.onlyForHubs && !vehicle.onlyForHubs.includes(spec.origin) && !vehicle.onlyForHubs.includes(spec.destination)) {
      throw new Error(`The ${vehicle.name} isn't available on this route.`);
    }
    if (!vehicle.allowsStops && spec.stopIds.length > 0) {
      throw new Error(`The ${vehicle.name} is a direct ride without stops. Remove the stops or choose another vehicle.`);
    }
    if (vehicle.spanishSpeakingDriver && spec.prefs?.language === "english") {
      throw new Error(`The ${vehicle.name} has a Spanish-speaking driver. Choose another vehicle for an English-speaking driver.`);
    }
    for (const id of spec.stopIds) {
      const stop = catalog.stops.find((s) => s.id === id);
      if (!stop || !stopFitsRoute(stop, spec.origin, spec.destination)) {
        throw new Error("One of the stops is no longer offered on this route.");
      }
    }
    const quote = quoteTransfer({ ...spec, season, catalog, route: typed ? route : null });
    // Guided stops: the per-person tour part (guide, entrance, activity) is paid by the company.
    const stopTourCosts = spec.stopIds.reduce(
      (n, id) => n + (catalog.stops.find((s) => s.id === id)?.tourPerPersonCents ?? 0) * spec.pax,
      0,
    );
    if (spec.pricing === "bid") {
      const offer = spec.offerCents ?? 0;
      if (offer < MIN_OFFER_USD * 100 || offer > MAX_OFFER_USD * 100) {
        throw new Error(`Offers must be between $${MIN_OFFER_USD} and $${MAX_OFFER_USD}.`);
      }
      // The reference (fixed) price includes the night premium; the offer itself is not marked up.
      return { totalCents: offer, referenceCents: quote.totalCents, passThroughCents: Math.min(offer, quote.ferryCents), companyCostCents: stopTourCosts, nightCents: 0 };
    }
    return { totalCents: quote.totalCents, referenceCents: quote.totalCents, passThroughCents: quote.ferryCents, companyCostCents: stopTourCosts, nightCents: quote.nightCents };
  }

  if (!catalog.dayTours.some((t) => t.id === spec.tourId)) throw new Error("That tour is no longer offered.");
  const total = quoteDayTour(spec.tourId, spec.upgrade, spec.pax, season, catalog);
  const tour = catalog.dayTours.find((t) => t.id === spec.tourId)!;
  return { totalCents: total, referenceCents: total, passThroughCents: 0, companyCostCents: tour.costPerPersonCents * spec.pax, nightCents: 0 };
}
