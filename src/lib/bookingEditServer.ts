import "server-only";
import {
  affectsPrice,
  bookingEditMessages,
  changedEnds,
  currentMoney,
  editDriveMinutes,
  editPromoLine,
  hasAcceptedOffer,
  listChanges,
  newMoney,
  specForBooking,
  type BookingEditInput,
  type Change,
  type EditableBooking,
  type Money,
} from "./bookingEdit";
import { bookedItemName, routeMinutes } from "./catalog";
import { localizeCatalog } from "./catalogEs";
import { getCatalog } from "./catalogSource";
import type { CatalogData } from "./catalogModel";
import { logBookingEvent } from "./crmNotices";
import { costaRicaTimestamp } from "./dates";
import { SITE_URL, sendEmail } from "./email";
import { MapsError, resolvePlace, rideRoute } from "./googleMaps";
import { bookingPlaceCoords, bookingPlaceText, needsRoute, storedRidePlace, type RidePlace, type RideRoute } from "./places";
import type { PromoCodeRow, PromoLine } from "./promo";
import { sendPush } from "./push";
import { createSupabaseAdminClient } from "./supabase/admin";
import { priceItem } from "./tripRequest";

/**
 * Server side of the team's trip edit (src/lib/bookingEdit.ts): looks the new places up with
 * Google (one place lookup per changed end and one route, both cached 30 days, so the save after
 * the preview costs nothing), prices the booking again like the website, and sends the messages.
 */

export type PriceOption =
  /** Only notes or the tour's pickup place changed: nothing to price. */
  | { state: "unaffected" }
  /** Priced again: same money as now. */
  | { state: "same" }
  /**
   * A different price. `keep` = with an accepted offer's amount kept as the payout (same as
   * `update` when there is no accepted offer); `update` = the payout from the usual split.
   */
  | { state: "new"; before: Money; keep: Money; update: Money; line: PromoLine; offerAccepted: boolean }
  /** It can't be priced automatically (e.g. a stop doesn't fit the new route): the price is kept. */
  | { state: "error"; message: string };

export interface EditPlan {
  changes: Change[];
  /** Places, coordinates, drive time, notes, time (no money). */
  patch: Record<string, unknown>;
  price: PriceOption;
  route: RideRoute | null;
  driveMinutes: { before: number | null; after: number | null };
}

/** Readable refusal (English; the action translates known ones). */
export class EditError extends Error {}

export async function planBookingEdit(
  b: EditableBooking,
  input: BookingEditInput,
  catalog: CatalogData,
  promoCode: Pick<PromoCodeRow, "discount_type" | "value" | "applies_to"> | null,
): Promise<EditPlan> {
  const patch: Record<string, unknown> = {};
  let origin: RidePlace | null = null;
  let destination: RidePlace | null = null;
  let route: RideRoute | null = null;
  let newOrigin: { text: string } | null = null;
  let newDestination: { text: string } | null = null;
  let driveAfter = b.drive_minutes ?? null;

  if (b.service_type === "transfer") {
    const ends = changedEnds(b, input);
    try {
      [origin, destination] = await Promise.all([
        ends.origin ? resolvePlace(input.origin!.id, input.origin!.label) : Promise.resolve(storedRidePlace(b.origin, b.origin_coords)),
        ends.destination ? resolvePlace(input.destination!.id, input.destination!.label) : Promise.resolve(storedRidePlace(b.destination, b.destination_coords)),
      ]);
      if (ends.origin || ends.destination) {
        if (!origin || !destination) throw new EditError("Pick both the pickup and the drop-off again.");
        if (origin.id === destination.id) throw new EditError("Pickup and drop-off are the same place.");
        route = await rideRoute(origin, destination);
      } else {
        const stored = (b.origin_coords as { route?: RideRoute | null } | null)?.route;
        route = stored && typeof stored === "object" ? stored : null;
      }
    } catch (e) {
      if (e instanceof MapsError || e instanceof EditError) throw new EditError(e.message);
      throw e;
    }
    if (ends.origin || ends.destination) {
      // Map point + the road route between the (new) ends; drive time from it, or our table between two towns.
      const oCoords = ends.origin ? bookingPlaceCoords(origin!) : (b.origin_coords ?? bookingPlaceCoords(origin!));
      patch.origin_coords = { ...oCoords, route };
      if (ends.origin) {
        newOrigin = { text: bookingPlaceText(origin!) };
        patch.origin = newOrigin.text;
      }
      if (ends.destination) {
        newDestination = { text: bookingPlaceText(destination!) };
        patch.destination = newDestination.text;
        patch.destination_coords = bookingPlaceCoords(destination!);
      }
      driveAfter = needsRoute(origin!, destination!) ? editDriveMinutes(route, null) : routeMinutes(origin!.hub, destination!.hub) || null;
      if (driveAfter !== (b.drive_minutes ?? null)) patch.drive_minutes = driveAfter;
    }
  }

  const changes = listChanges(b, input, { origin: newOrigin, destination: newDestination });
  for (const c of changes) {
    if (c.field === "scheduled_at") patch.scheduled_at = c.after;
    if (c.field === "flight_or_hotel_notes") patch.flight_or_hotel_notes = c.after;
    if (c.field === "driver_notes") patch.driver_notes = c.after;
    if (c.field === "pickup_place") patch.pickup_place = c.after;
  }

  let price: PriceOption = { state: "unaffected" };
  if (affectsPrice(changes)) {
    try {
      const spec = specForBooking(b, input, origin, destination);
      if (!spec) throw new Error("This booking can't be priced automatically.");
      const priced = priceItem(spec, input.date, catalog, route);
      const line = editPromoLine(
        b,
        { kind: spec.kind, totalCents: priced.totalCents, passThroughCents: priced.passThroughCents, companyCostCents: priced.companyCostCents, boatCents: priced.boatCents },
        promoCode,
        catalog,
      );
      const before = currentMoney(b);
      const offer = hasAcceptedOffer(b);
      const update = newMoney(b, priced, line, catalog, false);
      const keep = offer ? newMoney(b, priced, line, catalog, true) : update;
      const same = (Object.keys(before) as (keyof Money)[]).every((k) => before[k] === keep[k]);
      price = same ? { state: "same" } : { state: "new", before, keep, update, line, offerAccepted: offer };
    } catch (e) {
      price = { state: "error", message: (e as Error).message || "This booking can't be priced automatically." };
    }
  }

  return { changes, patch, price, route, driveMinutes: { before: b.drive_minutes ?? null, after: driveAfter } };
}

/** The new pickup as stored (Costa Rica time). */
export function newPickupIso(input: BookingEditInput): string {
  return costaRicaTimestamp(input.date, input.time);
}

/**
 * Load what the "trip changed" messages need and return a function that sends them once and
 * records it in the history ('notified', kind booking_edit). Load during the request, send in
 * `after()`. The traveller's contact is read with the service role and never goes to the driver.
 */
export async function prepareEditNotices(a: {
  bookingId: string;
  actorId: string;
  changes: Change[];
  price: { before: number; after: number } | null;
  payout: { before: number | null; after: number | null } | null;
}): Promise<() => Promise<void>> {
  const db = createSupabaseAdminClient();
  if (!db || a.changes.length === 0) return async () => {};
  const { data: b } = await db
    .from("bookings")
    .select("booking_ref, service_type, catalog_item_id, origin, destination, scheduled_at, trip_id, assigned_driver_id")
    .eq("id", a.bookingId)
    .maybeSingle();
  if (!b) return async () => {};
  const [{ data: guest }, { data: who }] = await Promise.all([
    b.trip_id
      ? db.from("trips").select("guest_name, guest_email, access_token, language").eq("id", b.trip_id).maybeSingle()
      : Promise.resolve({ data: null }),
    b.assigned_driver_id
      ? db.from("profiles").select("full_name, email, app_lang").eq("id", b.assigned_driver_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  let tourName: { es: string; en: string } | null = null;
  if (b.service_type !== "transfer") {
    const catalog = await getCatalog();
    const name = (l: "en" | "es") => bookedItemName(localizeCatalog(catalog, l).dayTours, b.catalog_item_id, l) ?? b.catalog_item_id ?? "";
    tourName = { es: name("es"), en: name("en") };
  }
  const messages = bookingEditMessages({
    bookingId: a.bookingId,
    ref: String(b.booking_ref ?? ""),
    serviceType: b.service_type,
    tourName,
    origin: b.origin,
    destination: b.destination,
    scheduledAt: b.scheduled_at,
    changes: a.changes,
    price: a.price,
    payout: a.payout,
    driver: b.assigned_driver_id ? { id: b.assigned_driver_id, fullName: who?.full_name ?? null, email: who?.email ?? null, appLang: who?.app_lang ?? null } : null,
    guest: guest ? { name: guest.guest_name, email: guest.guest_email, accessToken: guest.access_token, language: guest.language } : null,
    siteUrl: SITE_URL,
  });
  return async () => {
    const sent = { traveller: false, driver: false, driver_push: false };
    for (const m of messages) {
      try {
        if (m.kind === "driver_push") sent.driver_push = (await sendPush([m.userId], m.message, "driver")) > 0;
        else if (m.kind === "traveller_email") sent.traveller = await sendEmail(m.email);
        else sent.driver = await sendEmail(m.email);
      } catch (e) {
        console.error("[booking edit notice]", m.kind, e);
      }
    }
    await logBookingEvent(a.bookingId, a.actorId, "notified", { kind: "booking_edit", ...sent });
  };
}
