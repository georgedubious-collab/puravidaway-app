/**
 * The team edits where a trip starts and ends (Jorge, 2026-11-12; docs/PROJECT.md §4.2):
 * pickup and drop-off (the website's place search), the pickup date and time, the flight / hotel
 * and pickup details, the message for the driver, and a day tour's pickup place.
 *
 * Rules (assumptions listed in docs/PROJECT.md §9 #24):
 *   - Never on a cancelled or completed booking.
 *   - The price never changes by itself: the team sees the new route's price and picks "keep the
 *     price" (default) or "use the new price". The new price is made exactly like the website's
 *     (priceItem: season, vehicle, stops, night premium, ferries), then the promo code (50/50) and
 *     the driver's payout (commission after pass-throughs and company costs). An accepted offer's
 *     amount stays as the payout unless the team ticks "update the driver's payout too".
 *   - The history (booking_events) gets the change from the database trigger (migration 0056).
 *   - Messages: the traveller (their booking language) and the assigned driver (Spanish unless
 *     their app is in English; push + email) — the driver's never hold the traveller's contact
 *     details or price.
 *
 * Pure (no database, no Google, no sending) so `npm run test:crm` can check it;
 * src/lib/bookingEditServer.ts loads, looks places up and sends.
 */
import { usd } from "./bookings";
import { placeNameFor } from "./catalogEs";
import type { CatalogData } from "./catalogModel";
import { costaRicaTimestamp, formatScheduledAt, formatScheduledAtFor, isValidYmd, scheduledParts } from "./dates";
import type { Email } from "./emailHtml";
import { hasDriverPayout, splitPayout } from "./payout";
import { cleanPlaceLabel, hubOfPlaceId, isGooglePlaceId, isHubPlace, type RidePlace, type RideRoute } from "./places";
import { hasContactDetails, type RidePrefs } from "./preferences";
import { cashFeeCents } from "./pricing";
import { applyPromo, maxDiscountCents, splitDiscount, type PromoCodeRow, type PromoItemInput, type PromoLine } from "./promo";
import type { PublicLang } from "./publicLang";
import { cleanPickupPlace, pickupPlaceProblem, type ItemSpec, type PricedItem } from "./tripRequest";

/** A message for the team in both languages (the action picks one). */
export type Bi = { es: string; en: string };

/** Longest flight / hotel notes and message for the driver (same as the booking form). */
export const EDIT_NOTES_MAX = 500;

/** Statuses whose places can no longer be changed. */
export const LOCKED_STATUSES = ["cancelled", "completed"] as const;

export function canEditPlaces(status: string | null | undefined): boolean {
  return !(LOCKED_STATUSES as readonly string[]).includes(String(status ?? ""));
}

export const NOT_EDITABLE: Bi = {
  es: "Esta reserva ya está cancelada o completada: no se puede cambiar.",
  en: "This booking is cancelled or completed: it can't be changed.",
};

/** One end of a ride as the form sends it: "hub:SJO" or a Google place id + its name. */
export interface EditPlace {
  id: string;
  label: string;
}

export interface BookingEditInput {
  /** Rides only. */
  origin?: EditPlace;
  destination?: EditPlace;
  /** Costa Rica date and time of the pickup. */
  date: string;
  time: string;
  /** Rides: flight number, hotel, where exactly (lobby, gate, room). */
  notes: string;
  /** Rides: message for the driver. */
  driverNotes: string;
  /** Day tours: hotel or address. */
  pickupPlace: string;
}

/** "HH:MM" (any minute: a time the team set earlier off the quarter hours stays valid). */
const HHMM_ANY = /^([01]\d|2[0-3]):[0-5]\d$/;

const oneLine = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");

function parsePlace(v: unknown): EditPlace | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!hubOfPlaceId(id) && !isGooglePlaceId(id)) return null;
  const label = cleanPlaceLabel(o.label);
  return { id, label: label || id };
}

/** Check what the form sent. `today` = Costa Rica date. */
export function parseEditInput(raw: unknown, kind: string, today: string): { ok: true; input: BookingEditInput } | { ok: false; error: Bi } {
  if (!raw || typeof raw !== "object") return { ok: false, error: { es: "Faltan datos.", en: "Something is missing." } };
  const o = raw as Record<string, unknown>;
  const date = typeof o.date === "string" ? o.date : "";
  const time = typeof o.time === "string" ? o.time : "";
  if (!isValidYmd(date) || !HHMM_ANY.test(time)) return { ok: false, error: { es: "Elija la fecha y la hora de recogida.", en: "Pick the pickup date and time." } };
  if (date < today) return { ok: false, error: { es: "La fecha de recogida ya pasó.", en: "The pickup date is in the past." } };
  const input: BookingEditInput = { date, time, notes: "", driverNotes: "", pickupPlace: "" };
  if (kind === "transfer") {
    const origin = parsePlace(o.origin);
    const destination = parsePlace(o.destination);
    if (!origin || !destination) return { ok: false, error: { es: "Elija la recogida y el destino de la lista.", en: "Pick the pickup and drop-off from the list." } };
    if (origin.id === destination.id) return { ok: false, error: { es: "La recogida y el destino son el mismo lugar.", en: "Pickup and drop-off are the same place." } };
    input.origin = origin;
    input.destination = destination;
    input.notes = oneLine(o.notes, EDIT_NOTES_MAX);
    input.driverNotes = oneLine(o.driverNotes, EDIT_NOTES_MAX);
    if (input.notes.length > EDIT_NOTES_MAX || input.driverNotes.length > EDIT_NOTES_MAX)
      return { ok: false, error: { es: `Hasta ${EDIT_NOTES_MAX} caracteres por nota.`, en: `Up to ${EDIT_NOTES_MAX} characters per note.` } };
    if (hasContactDetails(input.notes) || hasContactDetails(input.driverNotes))
      return {
        ok: false,
        error: { es: "Sin teléfonos, correos ni enlaces en las notas (el conductor las ve).", en: "No phone numbers, emails or links in the notes (the driver sees them)." },
      };
  } else {
    input.pickupPlace = cleanPickupPlace(o.pickupPlace);
    const problem = pickupPlaceProblem(input.pickupPlace);
    if (problem)
      return {
        ok: false,
        error:
          input.pickupPlace.length > 120
            ? { es: "El lugar de recogida puede tener hasta 120 caracteres.", en: "The pickup place can be up to 120 characters." }
            : { es: "Sin teléfonos, correos ni enlaces en el lugar de recogida.", en: "No phone numbers, emails or links in the pickup place." },
      };
  }
  return { ok: true, input };
}

/** What the edit needs from the booking row. */
export interface EditableBooking {
  id: string;
  booking_ref: string;
  status: string;
  service_type: string;
  catalog_item_id: string | null;
  origin: string | null;
  destination: string | null;
  origin_coords: Record<string, unknown> | null;
  destination_coords: Record<string, unknown> | null;
  sightseeing_stops: { id: string }[] | null;
  vehicle_class: string | null;
  scheduled_at: string | null;
  passenger_count: number | null;
  flight_or_hotel_notes: string | null;
  driver_notes: string | null;
  pickup_place: string | null;
  preferences: Partial<RidePrefs> | null;
  sign_text: string | null;
  sign_hide_name: boolean | null;
  drive_minutes: number | null;
  total_price: number | string;
  night_premium: number | string | null;
  driver_payout: number | string | null;
  platform_fee: number | string | null;
  company_costs: number | string | null;
  pass_through: number | string | null;
  cash_fee: number | string | null;
  payment_mode: string | null;
  promo_code: string | null;
  promo_discount: number | string | null;
  claimed_at: string | null;
  assigned_driver_id: string | null;
  amount_paid: number | string | null;
}

export const EDITABLE_BOOKING_COLS =
  "id, booking_ref, status, service_type, catalog_item_id, origin, destination, origin_coords, destination_coords, sightseeing_stops, vehicle_class, scheduled_at, passenger_count, flight_or_hotel_notes, driver_notes, pickup_place, preferences, sign_text, sign_hide_name, drive_minutes, total_price, night_premium, driver_payout, platform_fee, company_costs, pass_through, cash_fee, payment_mode, promo_code, promo_discount, claimed_at, assigned_driver_id, amount_paid";

export type ChangeField = "origin" | "destination" | "scheduled_at" | "pickup_place" | "flight_or_hotel_notes" | "driver_notes";

export interface Change {
  field: ChangeField;
  before: string | null;
  after: string | null;
}

/** Which ends of the ride the team changed (compared by place id; a ride without a map point counts as changed). */
export function changedEnds(b: Pick<EditableBooking, "origin_coords" | "destination_coords">, input: BookingEditInput): { origin: boolean; destination: boolean } {
  const idOf = (c: Record<string, unknown> | null) => (c && typeof c.place_id === "string" ? c.place_id : null);
  return {
    origin: Boolean(input.origin) && input.origin!.id !== idOf(b.origin_coords),
    destination: Boolean(input.destination) && input.destination!.id !== idOf(b.destination_coords),
  };
}

const orNull = (s: string | null | undefined) => (s && s.trim() ? s : null);

/**
 * The fields that change, old → new (text as stored), for the page, the messages and the tests.
 * `origin` / `destination` are the new places once looked up (null = that end unchanged).
 */
export function listChanges(
  b: EditableBooking,
  input: BookingEditInput,
  places: { origin: { text: string } | null; destination: { text: string } | null },
): Change[] {
  const out: Change[] = [];
  if (places.origin) out.push({ field: "origin", before: b.origin, after: places.origin.text });
  if (places.destination) out.push({ field: "destination", before: b.destination, after: places.destination.text });
  const when = costaRicaTimestamp(input.date, input.time);
  const old = scheduledParts(b.scheduled_at);
  if (!old || old.ymd !== input.date || old.time !== input.time) out.push({ field: "scheduled_at", before: b.scheduled_at, after: when });
  if (b.service_type === "transfer") {
    if (orNull(input.notes) !== orNull(b.flight_or_hotel_notes)) out.push({ field: "flight_or_hotel_notes", before: b.flight_or_hotel_notes, after: orNull(input.notes) });
    if (orNull(input.driverNotes) !== orNull(b.driver_notes)) out.push({ field: "driver_notes", before: b.driver_notes, after: orNull(input.driverNotes) });
  } else if (orNull(input.pickupPlace) !== orNull(b.pickup_place)) {
    out.push({ field: "pickup_place", before: b.pickup_place, after: orNull(input.pickupPlace) });
  }
  return out;
}

/** Changes that can move the price: a new place, or another day / time (season, night premium). */
export function affectsPrice(changes: Change[]): boolean {
  return changes.some((c) => c.field === "origin" || c.field === "destination" || c.field === "scheduled_at");
}

/** The booking as a website item, to price it again with priceItem (src/lib/tripRequest.ts). */
export function specForBooking(b: EditableBooking, input: BookingEditInput, origin: RidePlace | null, destination: RidePlace | null): ItemSpec | null {
  const pax = Math.max(1, Number(b.passenger_count ?? 1) || 1);
  const stops = (b.sightseeing_stops ?? []).map((s) => s.id);
  if (b.service_type === "day_tour") {
    if (!b.catalog_item_id) return null;
    return { kind: "day_tour", tourId: b.catalog_item_id, upgrade: stops.includes("en_route_upgrade"), pax };
  }
  if (b.service_type !== "transfer" || !origin || !destination || !b.vehicle_class) return null;
  return {
    kind: "transfer",
    origin: origin.hub,
    destination: destination.hub,
    ...(isHubPlace(origin) ? {} : { originPlace: { id: origin.id, label: cleanPlaceLabel(origin.label) || origin.id } }),
    ...(isHubPlace(destination) ? {} : { destinationPlace: { id: destination.id, label: cleanPlaceLabel(destination.label) || destination.id } }),
    vehicleId: b.vehicle_class,
    stopIds: stops.filter((s) => s !== "en_route_upgrade"),
    pax,
    pickupTime: input.time,
    ...(b.preferences && Object.keys(b.preferences).length ? { prefs: b.preferences as RidePrefs } : {}),
    ...(orNull(input.driverNotes) ? { driverNotes: input.driverNotes } : {}),
    ...(b.sign_text ? { signText: b.sign_text } : {}),
  };
}

/** Door-to-door minutes for a re-routed ride (same rule as a new booking): the Google route, else null. */
export function editDriveMinutes(route: RideRoute | null, fallback: number | null): number | null {
  if (route) return route.totalMinutes > 0 ? Math.min(1440, Math.round(route.totalMinutes)) : null;
  return fallback;
}

/** The money columns of a booking (USD numbers as stored). */
export interface Money {
  total_price: number;
  night_premium: number;
  driver_payout: number | null;
  platform_fee: number | null;
  company_costs: number;
  pass_through: number;
  promo_discount: number;
  cash_fee: number;
}

const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const dollars = (c: number) => Math.round(c) / 100;

export function currentMoney(b: EditableBooking): Money {
  return {
    total_price: dollars(cents(b.total_price)),
    night_premium: dollars(cents(b.night_premium)),
    driver_payout: b.driver_payout == null ? null : dollars(cents(b.driver_payout)),
    platform_fee: b.platform_fee == null ? null : dollars(cents(b.platform_fee)),
    company_costs: dollars(cents(b.company_costs)),
    pass_through: dollars(cents(b.pass_through)),
    promo_discount: dollars(cents(b.promo_discount)),
    cash_fee: dollars(cents(b.cash_fee)),
  };
}

/**
 * The promo discount on the new price: the code's own rule (percent of the new price, or its fixed
 * amount) when the code still exists, else the discount the booking had, never above what the
 * code may take off the new price. No code: nothing.
 */
export function editPromoLine(
  b: Pick<EditableBooking, "promo_code" | "promo_discount">,
  item: PromoItemInput,
  code: Pick<PromoCodeRow, "discount_type" | "value" | "applies_to"> | null,
  catalog?: Pick<CatalogData, "driverCommissionBps">,
): PromoLine {
  if (!b.promo_code) return { discountCents: 0, driverCents: 0, platformCents: 0 };
  if (code) return applyPromo(code, [item], catalog).lines[0];
  const d = Math.max(0, Math.min(cents(b.promo_discount), maxDiscountCents(item, catalog)));
  return { discountCents: d, ...splitDiscount(d) };
}

/**
 * The booking's money at the new price: same order as a new booking (price → promo 50/50 →
 * payout split → cash fee). `keepOfferPayout`: an accepted offer's amount stays the driver's
 * payout (our share takes the difference).
 */
export function newMoney(
  b: EditableBooking,
  priced: PricedItem,
  line: PromoLine,
  catalog: Pick<CatalogData, "driverCommissionBps" | "cashFeeBps">,
  keepOfferPayout: boolean,
): Money {
  const kind = b.service_type;
  const list = priced.totalCents;
  const total = Math.max(0, list - line.discountCents);
  let payout: number | null = null;
  let fee: number | null = null;
  if (hasDriverPayout(kind)) {
    const split = splitPayout(list, priced.passThroughCents, catalog, priced.companyCostCents);
    payout = split.payoutCents - line.driverCents;
    fee = split.feeCents - line.platformCents;
    if (keepOfferPayout && b.driver_payout != null) {
      payout = cents(b.driver_payout);
      fee = total - payout;
    }
  }
  return {
    total_price: dollars(total),
    night_premium: dollars(priced.nightCents),
    driver_payout: payout === null ? null : dollars(payout),
    platform_fee: fee === null ? null : dollars(fee),
    company_costs: hasDriverPayout(kind) ? dollars(Math.min(priced.companyCostCents, list)) : 0,
    pass_through: dollars(priced.passThroughCents),
    promo_discount: dollars(line.discountCents),
    cash_fee: b.payment_mode === "cash_driver" ? dollars(cashFeeCents(total, catalog.cashFeeBps)) : 0,
  };
}

/** The accepted offer stays the payout unless the team asks to update it (Jorge's rule). */
export function hasAcceptedOffer(b: Pick<EditableBooking, "claimed_at" | "driver_payout">): boolean {
  return Boolean(b.claimed_at) && b.driver_payout != null;
}

/** Only the money columns that differ (for the update and the page). */
export function moneyPatch(before: Money, after: Money): Partial<Money> {
  const out: Partial<Money> = {};
  for (const k of Object.keys(after) as (keyof Money)[]) {
    if (before[k] !== after[k]) (out as Record<string, unknown>)[k] = after[k];
  }
  return out;
}

/**
 * Day-before reminders go out again for the new time when the pickup moved and is still more than
 * 28 hours away (their window is 20–28 h before); a late-driver alert is cleared for the new time.
 */
export function scheduleResets(changes: Change[], newPickupIso: string, nowMs: number): Record<string, null> {
  if (!changes.some((c) => c.field === "scheduled_at")) return {};
  const hoursAway = (Date.parse(newPickupIso) - nowMs) / 3_600_000;
  return { late_alert_at: null, ...(hoursAway > 28 ? { reminder_traveller_at: null, reminder_driver_at: null } : {}) };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const LABELS: Record<ChangeField, Bi> = {
  origin: { es: "Recogida", en: "Pickup" },
  destination: { es: "Destino", en: "Drop-off" },
  scheduled_at: { es: "Fecha y hora de recogida", en: "Pickup date and time" },
  pickup_place: { es: "Lugar de recogida", en: "Pickup place" },
  flight_or_hotel_notes: { es: "Vuelo, hotel o detalles de la recogida", en: "Flight, hotel or pickup details" },
  driver_notes: { es: "Mensaje para el conductor", en: "Message for the driver" },
};

export function changeLabel(f: ChangeField, lang: PublicLang): string {
  return LABELS[f][lang];
}

/** One value in words: places in the reader's language, times in Costa Rica time. */
export function changeValue(c: Change, which: "before" | "after", lang: PublicLang, forTeam = false): string {
  const v = c[which];
  if (!v) return lang === "es" ? "(nada)" : "(none)";
  if (c.field === "scheduled_at") return forTeam ? formatScheduledAt(v, lang) : formatScheduledAtFor(v, lang);
  if (c.field === "origin" || c.field === "destination") return placeNameFor(v, lang);
  return v;
}

/** "Recogida: Hotel X (antes: Aeropuerto SJO)". */
export function changeLine(c: Change, lang: PublicLang, forTeam = false): string {
  const was = lang === "es" ? "antes" : "was";
  return `${changeLabel(c.field, lang)}: ${changeValue(c, "after", lang, forTeam)} (${was}: ${changeValue(c, "before", lang, forTeam)})`;
}

export interface EditNoticeContext {
  bookingId: string;
  ref: string;
  serviceType: string;
  /** The tour's name in each language (day tours); rides use the new places. */
  tourName: Bi | null;
  /** Places and pickup after the edit. */
  origin: string | null;
  destination: string | null;
  scheduledAt: string | null;
  changes: Change[];
  /** The traveller's price, only when it changed. */
  price: { before: number; after: number } | null;
  /** The driver's payout, only when it changed. */
  payout: { before: number | null; after: number | null } | null;
  driver: { id: string; fullName: string | null; email: string | null; appLang: string | null } | null;
  guest: { name: string | null; email: string | null; accessToken: string | null; language: string | null } | null;
  siteUrl: string;
}

type Push = { title: string; body: string; data?: Record<string, string> };

export type EditOutgoing =
  | { kind: "traveller_email"; email: Email }
  | { kind: "driver_push"; userId: string; message: Push }
  | { kind: "driver_email"; email: Email };

const langOf = (v: string | null | undefined): PublicLang => (v === "es" ? "es" : "en");
const first = (n: string | null | undefined) => (n ?? "").trim().split(/\s+/)[0] ?? "";

function whatFor(c: EditNoticeContext, lang: PublicLang): string {
  if (c.serviceType === "transfer") return `${placeNameFor(c.origin, lang)} → ${placeNameFor(c.destination, lang)}`;
  return c.tourName ? c.tourName[lang] : "";
}

/**
 * Every message for one saved edit, in the order they are sent: the traveller's email, then the
 * assigned driver's push and email. Nothing when nothing changed. The driver's never hold the
 * traveller's name, phone, email or price; the traveller's never name the driver's payout.
 */
export function bookingEditMessages(c: EditNoticeContext): EditOutgoing[] {
  const out: EditOutgoing[] = [];
  if (c.changes.length === 0) return out;

  const g = c.guest;
  if (g?.email) {
    const gl = langOf(g.language);
    const es = gl === "es";
    const n = first(g.name);
    out.push({
      kind: "traveller_email",
      email: {
        to: g.email,
        lang: gl,
        subject: es ? `Actualizamos su reserva ${c.ref}` : `Your booking ${c.ref} has been updated`,
        lines: [
          es ? (n ? `Hola ${n},` : "Hola,") : `Hi ${n || "there"},`,
          es
            ? `Nuestro equipo actualizó su reserva ${c.ref} (${whatFor(c, gl)}). Así queda:`
            : `Our team updated your booking ${c.ref} (${whatFor(c, gl)}). Here is what changed:`,
          ...c.changes.map((x) => changeLine(x, gl)),
          c.price
            ? es
              ? `Precio: ${usd(c.price.after)} (antes: ${usd(c.price.before)}). Si hay una diferencia con lo que ya pagó, le escribiremos.`
              : `Price: ${usd(c.price.after)} (was: ${usd(c.price.before)}). If this differs from what you've already paid, we'll be in touch.`
            : "",
          es
            ? "Si algo no está bien, responda a este correo o escríbanos en el chat de su viaje."
            : "If anything isn't right, reply to this email or message us in your trip chat.",
        ].filter(Boolean),
        button: g.accessToken ? { label: es ? "Ver mi viaje" : "See my trip", url: `${c.siteUrl}/trip/${g.accessToken}` } : undefined,
      },
    });
  }

  const d = c.driver;
  if (d) {
    const es = d.appLang !== "en";
    const dl: PublicLang = es ? "es" : "en";
    const when = c.scheduledAt ? formatScheduledAt(c.scheduledAt, dl) : "";
    const payoutLine =
      c.payout && c.payout.after != null
        ? es
          ? `Su pago: ${usd(c.payout.after)} (antes: ${c.payout.before == null ? "—" : usd(c.payout.before)}).`
          : `Your payout: ${usd(c.payout.after)} (was: ${c.payout.before == null ? "—" : usd(c.payout.before)}).`
        : "";
    const summary = c.changes.map((x) => `${changeLabel(x.field, dl)}: ${changeValue(x, "after", dl, true)}`).join(" · ");
    out.push({
      kind: "driver_push",
      userId: d.id,
      message: {
        title: es ? `Cambio en el viaje ${c.ref}` : `Ride ${c.ref} changed`,
        body: summary.length > 170 ? `${summary.slice(0, 169)}…` : summary,
        data: { screen: "trip", id: c.bookingId },
      },
    });
    if (d.email) {
      const n = first(d.fullName);
      out.push({
        kind: "driver_email",
        email: {
          to: d.email,
          lang: dl,
          subject: es ? `Cambio en el viaje ${c.ref} · ${when}` : `Ride ${c.ref} changed · ${when}`,
          lines: [
            es ? (n ? `Hola ${n},` : "Hola,") : `Hi ${n || "there"},`,
            es
              ? `Nuestro equipo cambió el viaje ${c.ref} (${whatFor(c, dl)}, recogida ${when}, hora de Costa Rica):`
              : `Our team changed the ride ${c.ref} (${whatFor(c, dl)}, pickup ${when}, Costa Rica time):`,
            ...c.changes.map((x) => changeLine(x, dl, true)),
            payoutLine,
            es ? "Abra el viaje para ver el lugar exacto y el camino." : "Open the trip for the exact place and directions.",
          ].filter(Boolean),
          button: { label: es ? "Abrir el viaje" : "Open the trip", url: `${c.siteUrl}/driver/trips/${c.bookingId}` },
        },
      });
    }
  }
  return out;
}
