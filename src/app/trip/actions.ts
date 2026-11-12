"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { localizeCatalog, placeNameFor } from "@/lib/catalogEs";
import { getCatalog } from "@/lib/catalogSource";
import { requireRole } from "@/lib/auth";
import { cashAllowed, itemPaymentMode, parsePaymentMode } from "@/lib/cart";
import { costaRicaTimestamp, todayInCostaRica } from "@/lib/dates";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "@/lib/email";
import { routeMinutes, stopTotalCents } from "@/lib/catalog";
import { resolveTransfer } from "@/lib/googleMaps";
import type { RidePlace, RideRoute } from "@/lib/places";
import { hasDriverPayout, splitPayout } from "@/lib/payout";
import { cashFeeCents, formatBpsPercent } from "@/lib/pricing";
import { parsePublicLang, type PublicLang } from "@/lib/publicLang";
import { clientLanguageNote, requestItemLine, requestPaymentLine, tripRequestEmail } from "@/lib/travellerMessages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  MAX_TRIP_ITEMS,
  itemTime,
  parseSpec,
  priceItem,
  retiredItemError,
  type ItemSpec,
} from "@/lib/tripRequest";

export interface TripRequestInput {
  items: { id: string; date: string; totalCents: number; spec: unknown }[];
  /** "deposit_20" may still arrive from a page opened before it was retired; it is treated as full_100. */
  mode: "full_100" | "cash_driver" | "deposit_20";
  /** The cash booking fee the traveller was shown (basis points), checked against the live value. */
  cashFeeBps?: number;
  name: string;
  email: string;
  phone: string;
  notes: string;
  /** Hidden field real people leave empty (spam trap). */
  website: string;
  /**
   * Language the traveller is booking in: "es" from /es and the customer app in Spanish.
   * Saved with the trip; the confirmation email and everything sent later follow it.
   * Anything else (or nothing, e.g. an older app build) is English.
   */
  lang?: PublicLang;
}

export type TripRequestResult =
  /** tripToken: the code in the traveller's private trip-page link. */
  | { ok: true; refs: string[]; tripToken: string | null; /** Booking ids, for a booking entered by the team. */ ids?: string[] }
  | { ok: false; error: string }
  /** Prices changed since the item was added: the cart shows the new totals and asks again. */
  | { ok: false; error: string; repriced: Record<string, number> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Save the traveller's trip as bookings (one per item, sharing a trip_id),
 * re-priced on the server from the live catalog. Payment comes later; the team
 * confirms availability on WhatsApp.
 */
export async function submitTripRequest(input: TripRequestInput): Promise<TripRequestResult> {
  return saveTripRequest(input, null);
}

/**
 * The team enters a booking that came by WhatsApp or phone (/admin/bookings/new): the same
 * checks, pricing and rows as a website request, without the spam trap and request limit,
 * no "new request" email to the team, the traveller's email only if asked, and a
 * "created_by_team" entry in the booking's change history. Admins only.
 */
export async function submitTripRequestAsTeam(input: TripRequestInput, emailTraveller: boolean): Promise<TripRequestResult> {
  const me = await requireRole("admin", "/admin/bookings/new");
  return saveTripRequest({ ...input, website: "" }, { actorId: me.id, emailTraveller: emailTraveller === true });
}

interface TeamEntry {
  actorId: string;
  emailTraveller: boolean;
}

async function saveTripRequest(input: TripRequestInput, team: TeamEntry | null): Promise<TripRequestResult> {
  try {
    if (input.website) return { ok: true, refs: [], tripToken: null }; // bot: pretend it worked
    const name = String(input.name ?? "").trim();
    const email = String(input.email ?? "").trim().toLowerCase();
    const phone = String(input.phone ?? "").trim();
    const notes = String(input.notes ?? "").trim().slice(0, 1000);
    const lang = parsePublicLang(input.lang);
    if (!name || name.length > 80) return { ok: false, error: "Please add your full name." };
    if (!EMAIL.test(email) || email.length > 120) return { ok: false, error: "Please check your email address." };
    if (phone.replace(/\D/g, "").length < 7 || phone.length > 30) {
      return { ok: false, error: "Please add a mobile number with country code, e.g. +1 555 123 4567." };
    }
    if (input.mode !== "full_100" && input.mode !== "cash_driver" && input.mode !== "deposit_20") {
      return { ok: false, error: "Pick how you'd like to pay." };
    }
    const mode = parsePaymentMode(input.mode);
    const items = Array.isArray(input.items) ? input.items : [];
    if (items.length === 0) return { ok: false, error: "Your trip is empty." };
    if (items.length > MAX_TRIP_ITEMS) return { ok: false, error: `Up to ${MAX_TRIP_ITEMS} items per request, please.` };
    // Things an older page or app build may still send, refused before anything is looked up:
    // multi-day trips (retired 2026-11-11) and a traveller's own offer on a ride ("name your
    // price"; travellers book at the fixed price only since 2026-11-11).
    const retired = retiredItemError(items);
    if (retired) return { ok: false, error: retired };

    const db = createSupabaseAdminClient();
    if (!db) return { ok: false, error: "Online requests aren't switched on yet. Please send your trip on WhatsApp." };

    const catalog = await getCatalog();
    const today = todayInCostaRica();
    const priced: {
      spec: ItemSpec;
      date: string;
      totalCents: number;
      passThroughCents: number;
      companyCostCents: number;
      nightCents: number;
      /** Rides: both ends as priced (typed places looked up again on the server) and the road route. */
      ride?: { origin: RidePlace; destination: RidePlace; route: RideRoute | null };
    }[] = [];
    const repriced: Record<string, number> = {};
    for (const item of items) {
      let spec = parseSpec(item.spec);
      if (!spec) return { ok: false, error: "One item was added on an older version of the site. Please remove it and add it again." };
      if (typeof item.date !== "string" || item.date < today) {
        return { ok: false, error: "One of the dates is in the past. Please change it." };
      }
      let p;
      let ride: (typeof priced)[number]["ride"];
      try {
        if (spec.kind === "transfer") {
          const r = await resolveTransfer(spec);
          spec = r.spec;
          ride = { origin: r.origin, destination: r.destination, route: r.route };
        }
        p = priceItem(spec, item.date, catalog, ride?.route);
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
      if (p.totalCents !== item.totalCents) repriced[item.id] = p.totalCents;
      priced.push({ spec, date: item.date, ...p, ride });
    }
    if (Object.keys(repriced).length) {
      return { ok: false, error: "Some prices have changed since you added them. Please check the new totals and send again.", repriced };
    }
    // Cash booking fee: always the live value from the database, never the browser's.
    const feeBps = catalog.cashFeeBps;
    const paysCash = mode === "cash_driver" && priced.some((p) => cashAllowed(p.spec.kind));
    if (paysCash && input.cashFeeBps !== feeBps) {
      return {
        ok: false,
        error: `The cash booking fee is now ${formatBpsPercent(feeBps)}. Please reload the page to see your new total, then send again.`,
      };
    }
    const feeFor = (spec: ItemSpec, totalCents: number) =>
      itemPaymentMode(spec.kind, mode) === "cash_driver" ? cashFeeCents(totalCents, feeBps) : 0;

    // Abuse limit (every request emails the address given): 5 an hour per network, 3 per email.
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
    // (The team entering a booking by hand is not limited.)
    const allowed = team ? { data: true, error: null } : await db.rpc("allow_trip_request", { p_ip: ip, p_email: email });
    if (allowed.error) throw allowed.error;
    if (allowed.data !== true) {
      return { ok: false, error: "We've received several requests from you already. Please wait a little, or message us on WhatsApp." };
    }

    const tripId = randomUUID();
    const tripToken = randomBytes(32).toString("hex");
    const tripRow = { id: tripId, access_token: tripToken, guest_name: name, guest_email: email, guest_phone: phone };
    let trip = await db.from("trips").insert({ ...tripRow, language: lang });
    // Safety net for the minutes between a deploy and its database update (migration 0033):
    // a request is never lost because the language column isn't there yet.
    if (trip.error && /language/.test(trip.error.message ?? "")) trip = await db.from("trips").insert(tripRow);
    if (trip.error) {
      console.error("[trip request]", trip.error);
      return { ok: false, error: "We couldn't save your request. Please try again or send it on WhatsApp." };
    }
    // Driver payout: the platform keeps its commission on the price minus pass-through costs (ferries).
    // and company-paid costs (entrances, lunch, activities) come off before the driver's share.
    const payoutFor = (kind: string, totalCents: number, passThroughCents: number, companyCostCents: number) =>
      hasDriverPayout(kind) ? splitPayout(totalCents, passThroughCents, catalog, companyCostCents) : null;
    const rows = priced.map(({ spec, date, totalCents, passThroughCents, companyCostCents, nightCents, ride }) => ({
      trip_id: tripId,
      service_type: spec.kind,
      catalog_item_id: spec.kind === "day_tour" ? spec.tourId : null,
      origin: ride ? placeText(ride.origin) : null,
      destination: ride ? placeText(ride.destination) : null,
      // Map point + the road route the price was made from (a later price change never alters it).
      origin_coords: ride ? { ...placeCoords(ride.origin), route: ride.route } : null,
      destination_coords: ride ? placeCoords(ride.destination) : null,
      sightseeing_stops:
        spec.kind === "transfer"
          ? spec.stopIds.map((id) => {
              const s = catalog.stops.find((x) => x.id === id);
              return { id, price: s ? stopTotalCents(s, spec.pax) / 100 : 0 };
            })
          : spec.kind === "day_tour" && spec.upgrade
            ? [{ id: "en_route_upgrade" }]
            : [],
      vehicle_class: spec.kind === "transfer" ? spec.vehicleId : null,
      lodging_tier: null,
      // Costa Rica time: the ride's pickup time, or the tour default until the team confirms.
      scheduled_at: costaRicaTimestamp(date, itemTime(spec)),
      passenger_count: spec.kind === "transfer" || spec.kind === "day_tour" ? spec.pax : null,
      flight_or_hotel_notes: spec.kind === "transfer" ? (spec.notes ?? null) : null,
      preferences: spec.kind === "transfer" && spec.prefs ? spec.prefs : {},
      driver_notes: spec.kind === "transfer" ? (spec.driverNotes ?? null) : null,
      // Bags, shown to the assigned driver: large suitcases (migration 0035) and carry-ons (0037).
      // Older app builds send one number: it is kept as the large suitcases, carry-ons unknown.
      luggage_count: spec.kind === "transfer" && spec.bags !== undefined ? spec.bags : null,
      carry_on_count: spec.kind === "transfer" && spec.carryOns !== undefined ? spec.carryOns : null,
      // Name sign (migration 0040): the traveller's own text, or "Don't show my name". Neither =
      // first name + last initial. Older app builds send neither.
      sign_text: spec.kind === "transfer" ? (spec.signText ?? null) : null,
      sign_hide_name: spec.kind === "transfer" && !spec.signText && spec.signHideName === true,
      // Door-to-door drive time for the driver's arrival estimate: Google's road route for typed
      // places, else our per-corridor table between two towns. Never a straight-line guess.
      drive_minutes: spec.kind === "transfer" ? driveMinutes(ride?.route ?? null, spec) : null,
      // Always the fixed price. "bid" stays in the schema only for rides booked as a traveller's
      // offer before 2026-11-11 (still shown as such in admin).
      pricing_mode: "fixed",
      total_price: totalCents / 100,
      // Night-pickup premium inside total_price (migration 0041); 0 by day. The driver's payout
      // below is a share of total_price, so it rises with the premium.
      night_premium: nightCents / 100,
      driver_payout: (payoutFor(spec.kind, totalCents, passThroughCents, companyCostCents)?.payoutCents ?? null) === null ? null : payoutFor(spec.kind, totalCents, passThroughCents, companyCostCents)!.payoutCents / 100,
      platform_fee: (payoutFor(spec.kind, totalCents, passThroughCents, companyCostCents)?.feeCents ?? null) === null ? null : payoutFor(spec.kind, totalCents, passThroughCents, companyCostCents)!.feeCents / 100,
      company_costs: hasDriverPayout(spec.kind) ? Math.min(companyCostCents, totalCents) / 100 : 0,
      currency: "USD",
      payment_mode: itemPaymentMode(spec.kind, mode),
      cash_fee: feeFor(spec, totalCents) / 100,
      // The team confirms, then posts the ride to the drivers' job board from the booking page.
      status: "pending_payment",
      client_notes: notes || null,
    }));

    let saved = await db.from("bookings").insert(rows).select("id, booking_ref, status");
    // Safety net for the minutes between a deploy and its database update (migration 0037):
    // a request is never lost because the carry-on column isn't there yet.
    if (saved.error && /carry_on_count/.test(saved.error.message ?? "")) {
      saved = await db
        .from("bookings")
        .insert(rows.map((row) => ({ ...row, carry_on_count: undefined })))
        .select("id, booking_ref, status");
    }
    // Same safety net for the name-sign columns (migration 0040).
    if (saved.error && /sign_text|sign_hide_name/.test(saved.error.message ?? "") && !/name sign/.test(saved.error.message ?? "")) {
      saved = await db
        .from("bookings")
        .insert(rows.map((row) => ({ ...row, sign_text: undefined, sign_hide_name: undefined })))
        .select("id, booking_ref, status");
    }
    // And for the night-premium snapshot (migration 0041); the price itself is already in total_price.
    if (saved.error && /night_premium/.test(saved.error.message ?? "")) {
      saved = await db
        .from("bookings")
        .insert(rows.map((row) => ({ ...row, night_premium: undefined })))
        .select("id, booking_ref, status");
    }
    const { data, error } = saved;
    if (error) {
      console.error("[trip request]", error);
      return { ok: false, error: "We couldn't save your request. Please try again or send it on WhatsApp." };
    }
    const refs = (data ?? []).map((r) => r.booking_ref as string);
    const ids = (data ?? []).map((r) => r.id as string);
    if (team) {
      // Change history (migration 0044): who entered it, and whether the traveller got the link.
      const events = ids.flatMap((id) => [
        { booking_id: id, actor_id: team.actorId, action: "created_by_team", after: { source: "WhatsApp / phone", mode } },
        ...(team.emailTraveller ? [{ booking_id: id, actor_id: team.actorId, action: "trip_link_emailed", after: {} }] : []),
      ]);
      const ev = await db.from("booking_events").insert(events);
      if (ev.error) console.error("[trip request] history", ev.error.message);
    }
    const feeTotalCents = priced.reduce((n, p) => n + feeFor(p.spec, p.totalCents), 0);
    const tripCents = priced.reduce((n, p) => n + p.totalCents, 0) + feeTotalCents;
    const total = tripCents / 100;
    const cashCents = priced.reduce(
      (n, p) => n + (itemPaymentMode(p.spec.kind, mode) === "cash_driver" ? p.totalCents + feeFor(p.spec, p.totalCents) : 0),
      0,
    );
    const onlineCents = tripCents - cashCents;
    const money = (c: number) => `$${(c / 100).toFixed(2)}`;
    const tripUrl = `${SITE_URL}/trip/${tripToken}`;
    // One line per item, e.g. "CRPT-10492 · 2026-11-22, 9:00 AM pickup · Ride: SJO Airport → Manuel Antonio".
    // The traveller's copy is in their language; the team's copy stays English.
    const itemLinesIn = (l: PublicLang) => {
      const names = localizeCatalog(catalog, l);
      return priced.map(({ spec, date, ride }, i) =>
        requestItemLine(l, {
          ref: refs[i],
          date,
          time: itemTime(spec),
          kind: spec.kind,
          what:
            spec.kind === "transfer"
              ? `${placeNameFor(ride?.origin.label ?? spec.origin, l)} → ${placeNameFor(ride?.destination.label ?? spec.destination, l)}`
              : (names.dayTours.find((t) => t.id === spec.tourId)?.name ?? spec.tourId),
        }),
      );
    };
    const itemLines = itemLinesIn("en");
    after(async () => {
      if (team && !team.emailTraveller) return; // entered by the team: the traveller gets the link only if asked
      await sendEmail({
        to: email,
        ...tripRequestEmail(lang, {
          guestName: name,
          refs,
          itemLines: lang === "en" ? itemLines : itemLinesIn(lang),
          paymentLine: requestPaymentLine(lang, { cashCents, onlineCents, feeTotalCents, feePercent: formatBpsPercent(feeBps) }),
          tripUrl,
          hasRide: priced.some((p) => p.spec.kind === "transfer"),
        }),
      });
      if (ADMIN_EMAIL && !team) {
        await sendEmail({
          to: ADMIN_EMAIL,
          subject: `New trip request ${refs.join(", ")} · $${total.toFixed(2)}`,
          lines: [
            `${name} (${email}, ${phone}) sent ${refs.length} item${refs.length > 1 ? "s" : ""} worth $${total.toFixed(2)}.`,
            cashCents > 0
              ? `Pays cash to the driver: ${money(cashCents)} (cash fee ${money(feeTotalCents)})${onlineCents > 0 ? `; online in full: ${money(onlineCents)}` : ""}.`
              : `Pays online in full: ${money(onlineCents)} (send the payment link once confirmed).`,
            ...itemLines,
            notes ? `Notes: ${notes}` : "",
            clientLanguageNote(lang),
          ].filter(Boolean),
          button: { label: "Open in Bookings", url: `${SITE_URL}/admin/bookings` },
        });
      }
    });
    return { ok: true, refs, tripToken, ...(team ? { ids } : {}) };
  } catch (e) {
    console.error("[trip request]", e);
    return { ok: false, error: "We couldn't save your request. Please try again or send it on WhatsApp." };
  }
}

/** Booking text for one end: "Arenas Del Mar Resort, Rd to Arenas Del Mar, Manuel Antonio…" or our town's name. */
function placeText(p: RidePlace): string {
  return p.address && p.address !== p.label ? `${p.label}, ${p.address}` : p.label;
}

function placeCoords(p: RidePlace) {
  return { lat: p.lat, lng: p.lng, place_id: p.id, town: p.hub };
}

/**
 * Door-to-door minutes for the driver's arrival estimate (bookings.drive_minutes): the Google
 * route the ride was priced with (incl. the Drake Bay boat), or ROUTE_MINUTES between two of our
 * towns. Null when neither applies, so the driver sees no estimate rather than a guess.
 */
function driveMinutes(route: RideRoute | null, spec: Extract<ItemSpec, { kind: "transfer" }>): number | null {
  const typed = Boolean(spec.originPlace || spec.destinationPlace);
  const min = typed ? (route?.totalMinutes ?? 0) : spec.origin === spec.destination ? 0 : routeMinutes(spec.origin, spec.destination);
  return min > 0 ? Math.min(1440, Math.round(min)) : null;
}
