"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { getCatalog } from "@/lib/catalogSource";
import { HUBS } from "@/lib/catalog";
import { todayInCostaRica } from "@/lib/dates";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MAX_TRIP_ITEMS, parseSpec, priceItem, type ItemSpec } from "@/lib/tripRequest";

export interface TripRequestInput {
  items: { id: string; date: string; totalCents: number; spec: unknown }[];
  mode: "full_100" | "deposit_20";
  name: string;
  email: string;
  phone: string;
  notes: string;
  /** Hidden field real people leave empty (spam trap). */
  website: string;
}

export type TripRequestResult =
  | { ok: true; refs: string[]; tripId: string | null }
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
    if (input.website) return { ok: true, refs: [], tripId: null }; // bot: pretend it worked
    const name = String(input.name ?? "").trim();
    const email = String(input.email ?? "").trim().toLowerCase();
    const phone = String(input.phone ?? "").trim();
    const notes = String(input.notes ?? "").trim().slice(0, 1000);
    if (!name || name.length > 80) return { ok: false, error: "Please add your full name." };
    if (!EMAIL.test(email) || email.length > 120) return { ok: false, error: "Please check your email address." };
    if (phone.replace(/\D/g, "").length < 7 || phone.length > 30) {
      return { ok: false, error: "Please add a mobile number with country code, e.g. +1 555 123 4567." };
    }
    if (input.mode !== "full_100" && input.mode !== "deposit_20") return { ok: false, error: "Pick how you'd like to pay." };
    const items = Array.isArray(input.items) ? input.items : [];
    if (items.length === 0) return { ok: false, error: "Your trip is empty." };
    if (items.length > MAX_TRIP_ITEMS) return { ok: false, error: `Up to ${MAX_TRIP_ITEMS} items per request, please.` };

    const db = createSupabaseAdminClient();
    if (!db) return { ok: false, error: "Online requests aren't switched on yet. Please send your trip on WhatsApp." };

    const catalog = await getCatalog();
    const today = todayInCostaRica();
    const priced: { spec: ItemSpec; date: string; totalCents: number; referenceCents: number }[] = [];
    const repriced: Record<string, number> = {};
    for (const item of items) {
      const spec = parseSpec(item.spec);
      if (!spec) return { ok: false, error: "One item was added on an older version of the site. Please remove it and add it again." };
      if (typeof item.date !== "string" || item.date < today) {
        return { ok: false, error: "One of the dates is in the past. Please change it." };
      }
      let p;
      try {
        p = priceItem(spec, item.date, catalog);
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
      if (p.totalCents !== item.totalCents) repriced[item.id] = p.totalCents;
      priced.push({ spec, date: item.date, ...p });
    }
    if (Object.keys(repriced).length) {
      return { ok: false, error: "Some prices have changed since you added them. Please check the new totals and send again.", repriced };
    }

    const tripId = randomUUID();
    const rows = priced.map(({ spec, date, totalCents, referenceCents }) => ({
      trip_id: tripId,
      service_type: spec.kind,
      catalog_item_id: spec.kind === "day_tour" ? spec.tourId : spec.kind === "expedition" ? spec.expeditionId : null,
      origin: spec.kind === "transfer" ? hubName(spec.origin) : null,
      destination: spec.kind === "transfer" ? hubName(spec.destination) : null,
      sightseeing_stops:
        spec.kind === "transfer"
          ? spec.stopIds.map((id) => ({ id, price: (catalog.stops.find((s) => s.id === id)?.priceCents ?? 0) / 100 }))
          : spec.kind === "day_tour" && spec.upgrade
            ? [{ id: "en_route_upgrade" }]
            : [],
      vehicle_class: spec.kind === "transfer" ? spec.vehicleId : null,
      lodging_tier: spec.kind === "expedition" ? spec.tierId : null,
      scheduled_at: `${date}T12:00:00-06:00`, // date only for now; pickup time is agreed on WhatsApp
      passenger_count: spec.kind === "transfer" ? spec.pax : null,
      flight_or_hotel_notes: spec.kind === "transfer" ? (spec.notes ?? null) : null,
      preferences: spec.kind === "transfer" && spec.prefs ? spec.prefs : {},
      driver_notes: spec.kind === "transfer" ? (spec.driverNotes ?? null) : null,
      pricing_mode: spec.kind === "transfer" && spec.pricing === "bid" ? "bid" : "fixed",
      total_price: totalCents / 100,
      currency: "USD",
      payment_mode: input.mode,
      status: "pending_payment",
      guest_name: name,
      guest_email: email,
      guest_phone: phone,
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
    const total = priced.reduce((n, p) => n + p.totalCents, 0) / 100;
    const tripUrl = `${SITE_URL}/trip/${tripId}`;
    after(async () => {
      await sendEmail({
        to: email,
        subject: `We got your trip request (${refs.join(", ")})`,
        lines: [
          `Hi ${name.split(" ")[0]},`,
          `Thanks for your request! Our team is checking availability and will confirm your pickup times. Nothing has been charged.`,
          `Your booking reference${refs.length > 1 ? "s" : ""}: ${refs.join(", ")}.`,
          "Your trip page has your bookings and a chat with our team. Your driver's profile and car photos appear there once confirmed.",
        ],
        button: { label: "Open your trip page", url: tripUrl },
      });
      if (ADMIN_EMAIL) {
        await sendEmail({
          to: ADMIN_EMAIL,
          subject: `New trip request ${refs.join(", ")} · $${total.toFixed(2)}`,
          lines: [
            `${name} (${email}, ${phone}) sent ${refs.length} item${refs.length > 1 ? "s" : ""} worth $${total.toFixed(2)}, ${input.mode === "deposit_20" ? "20% deposit" : "paying in full"}.`,
            notes ? `Notes: ${notes}` : "",
          ].filter(Boolean),
          button: { label: "Open in Bookings", url: `${SITE_URL}/admin/bookings` },
        });
      }
    });
    return { ok: true, refs, tripId };
  } catch (e) {
    console.error("[trip request]", e);
    return { ok: false, error: "We couldn't save your request. Please try again or send it on WhatsApp." };
  }
}

function hubName(id: string): string {
  return HUBS.find((h) => h.id === id)?.name ?? id;
}
