"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { getCatalog } from "@/lib/catalogSource";
import { cashAllowed, itemPaymentMode, parsePaymentMode } from "@/lib/cart";
import { costaRicaTimestamp, formatTime12h, todayInCostaRica } from "@/lib/dates";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "@/lib/email";
import { resolveTransfer } from "@/lib/googleMaps";
import type { RidePlace, RideRoute } from "@/lib/places";
import { hasDriverPayout, splitPayout } from "@/lib/payout";
import { cashFeeCents, formatBpsPercent } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MAX_TRIP_ITEMS, itemTime, parseSpec, priceItem, type ItemSpec } from "@/lib/tripRequest";

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
}

export type TripRequestResult =
  /** tripToken: the code in the traveller's private trip-page link. */
  | { ok: true; refs: string[]; tripToken: string | null }
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
  try {
    if (input.website) return { ok: true, refs: [], tripToken: null }; // bot: pretend it worked
    const name = String(input.name ?? "").trim();
    const email = String(input.email ?? "").trim().toLowerCase();
    const phone = String(input.phone ?? "").trim();
    const notes = String(input.notes ?? "").trim().slice(0, 1000);
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

    const db = createSupabaseAdminClient();
    if (!db) return { ok: false, error: "Online requests aren't switched on yet. Please send your trip on WhatsApp." };

    const catalog = await getCatalog();
    const today = todayInCostaRica();
    const priced: {
      spec: ItemSpec;
      date: string;
      totalCents: number;
      referenceCents: number;
      passThroughCents: number;
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
    const allowed = await db.rpc("allow_trip_request", { p_ip: ip, p_email: email });
    if (allowed.error) throw allowed.error;
    if (allowed.data !== true) {
      return { ok: false, error: "We've received several requests from you already. Please wait a little, or message us on WhatsApp." };
    }

    const tripId = randomUUID();
    const tripToken = randomBytes(32).toString("hex");
    const trip = await db
      .from("trips")
      .insert({ id: tripId, access_token: tripToken, guest_name: name, guest_email: email, guest_phone: phone });
    if (trip.error) {
      console.error("[trip request]", trip.error);
      return { ok: false, error: "We couldn't save your request. Please try again or send it on WhatsApp." };
    }
    // Driver payout: the platform keeps its commission on the price minus pass-through costs (ferries).
    const payoutFor = (kind: string, totalCents: number, passThroughCents: number) =>
      hasDriverPayout(kind) ? splitPayout(totalCents, passThroughCents, catalog) : null;
    const rows = priced.map(({ spec, date, totalCents, referenceCents, passThroughCents, ride }) => ({
      trip_id: tripId,
      service_type: spec.kind,
      catalog_item_id: spec.kind === "day_tour" ? spec.tourId : spec.kind === "expedition" ? spec.expeditionId : null,
      origin: ride ? placeText(ride.origin) : null,
      destination: ride ? placeText(ride.destination) : null,
      // Map point + the road route the price was made from (a later price change never alters it).
      origin_coords: ride ? { ...placeCoords(ride.origin), route: ride.route } : null,
      destination_coords: ride ? placeCoords(ride.destination) : null,
      sightseeing_stops:
        spec.kind === "transfer"
          ? spec.stopIds.map((id) => ({ id, price: (catalog.stops.find((s) => s.id === id)?.priceCents ?? 0) / 100 }))
          : spec.kind === "day_tour" && spec.upgrade
            ? [{ id: "en_route_upgrade" }]
            : [],
      vehicle_class: spec.kind === "transfer" ? spec.vehicleId : null,
      lodging_tier: spec.kind === "expedition" ? spec.tierId : null,
      // Costa Rica time: the ride's pickup time, or the tour / expedition default until the team confirms.
      scheduled_at: costaRicaTimestamp(date, itemTime(spec)),
      passenger_count: spec.kind === "transfer" ? spec.pax : null,
      flight_or_hotel_notes: spec.kind === "transfer" ? (spec.notes ?? null) : null,
      preferences: spec.kind === "transfer" && spec.prefs ? spec.prefs : {},
      driver_notes: spec.kind === "transfer" ? (spec.driverNotes ?? null) : null,
      pricing_mode: spec.kind === "transfer" && spec.pricing === "bid" ? "bid" : "fixed",
      total_price: totalCents / 100,
      driver_payout: payoutFor(spec.kind, totalCents, passThroughCents)?.payoutCents != null ? payoutFor(spec.kind, totalCents, passThroughCents)!.payoutCents / 100 : null,
      platform_fee: payoutFor(spec.kind, totalCents, passThroughCents)?.feeCents != null ? payoutFor(spec.kind, totalCents, passThroughCents)!.feeCents / 100 : null,
      currency: "USD",
      payment_mode: itemPaymentMode(spec.kind, mode),
      cash_fee: feeFor(spec, totalCents) / 100,
      status: "pending_payment",
      client_notes:
        [notes, spec.kind === "transfer" && spec.pricing === "bid" ? `Offer; fixed price was $${(referenceCents / 100).toFixed(2)}` : ""]
          .filter(Boolean)
          .join(" · ") || null,
    }));

    const { data, error } = await db.from("bookings").insert(rows).select("booking_ref");
    if (error) {
      console.error("[trip request]", error);
      return { ok: false, error: "We couldn't save your request. Please try again or send it on WhatsApp." };
    }
    const refs = (data ?? []).map((r) => r.booking_ref as string);
    const feeTotalCents = priced.reduce((n, p) => n + feeFor(p.spec, p.totalCents), 0);
    const tripCents = priced.reduce((n, p) => n + p.totalCents, 0) + feeTotalCents;
    const total = tripCents / 100;
    const cashCents = priced.reduce(
      (n, p) => n + (itemPaymentMode(p.spec.kind, mode) === "cash_driver" ? p.totalCents + feeFor(p.spec, p.totalCents) : 0),
      0,
    );
    const onlineCents = tripCents - cashCents;
    const money = (c: number) => `$${(c / 100).toFixed(2)}`;
    const paymentLine =
      cashCents > 0
        ? `Payment: cash to your driver, ${money(cashCents)} (includes a ${formatBpsPercent(feeBps)} cash booking fee of ${money(feeTotalCents)})${
            onlineCents > 0 ? `; ${money(onlineCents)} online in full for the expedition, by secure link once confirmed` : ""
          }.`
        : `Payment: online in full, ${money(onlineCents)}. We send you a secure payment link once your trip is confirmed.`;
    const tripUrl = `${SITE_URL}/trip/${tripToken}`;
    // One line per item, e.g. "PVW-10492 · 2026-11-22, 9:00 AM pickup · Ride: SJO Airport → Manuel Antonio".
    const itemLines = priced.map(({ spec, date, ride }, i) => {
      const what =
        spec.kind === "transfer"
          ? `Ride: ${ride?.origin.label ?? spec.origin} → ${ride?.destination.label ?? spec.destination}`
          : spec.kind === "day_tour"
            ? `Day tour: ${catalog.dayTours.find((t) => t.id === spec.tourId)?.name ?? spec.tourId}`
            : `Expedition: ${catalog.expeditions.find((x) => x.id === spec.expeditionId)?.name ?? spec.expeditionId}`;
      const when = `${date}, ${formatTime12h(itemTime(spec))} ${spec.kind === "transfer" ? "pickup" : "start (to confirm)"}`;
      return [refs[i], when, what].filter(Boolean).join(" · ");
    });
    after(async () => {
      await sendEmail({
        to: email,
        subject: `We got your trip request (${refs.join(", ")})`,
        lines: [
          `Hi ${name.split(" ")[0]},`,
          `Thanks for your request! Our team is checking availability and will confirm your pickup times. Nothing has been charged.`,
          `Your booking reference${refs.length > 1 ? "s" : ""}: ${refs.join(", ")}.`,
          ...itemLines,
          paymentLine,
          "Times are Costa Rica time. Your trip page has your bookings and a chat with our team. Your driver's profile and car photos appear there once confirmed.",
        ],
        button: { label: "Open your trip page", url: tripUrl },
      });
      if (ADMIN_EMAIL) {
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
          ].filter(Boolean),
          button: { label: "Open in Bookings", url: `${SITE_URL}/admin/bookings` },
        });
      }
    });
    return { ok: true, refs, tripToken };
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
