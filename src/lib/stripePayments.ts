import "server-only";
import Stripe from "stripe";
import { decideHold, holdMetadata, onlineDueCents, parseHoldMetadata, type HeldLine } from "./cardHold";
import { sendHeldNotices } from "./requestNotices";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * Card payments with Stripe (Jorge, 2026-11-22; PROJECT.md §6.4). Server only: the secret key
 * (STRIPE_SECRET_KEY) never reaches a browser or the apps, and card numbers never touch our
 * servers or database — the traveller types them on Stripe's own page (Stripe Checkout).
 *
 * The flow:
 *   1. startTripCheckout: a Stripe page for everything still to pay online on the trip. The card
 *      is only HELD (capture_method = manual).
 *   2. recordCheckout: back on the trip page (and from Stripe's webhook), one payment row per
 *      booking, status 'authorized', and bookings.amount_held goes up.
 *   3. settleTripHolds: charge or release by the rules in src/lib/cardHold.ts — after the team
 *      assigns or cancels, and every hour from the GitHub Action (day-6 deadline).
 * Stripe TEST mode payments are stored with provider 'test' (no real money, "PRUEBA" chip).
 */

export const STRIPE_ENABLED = Boolean(process.env.STRIPE_SECRET_KEY);

let client: Stripe | null = null;
function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

type Db = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

const SERVICE_NAME: Record<string, [string, string]> = {
  transfer: ["Private transfer", "Traslado privado"],
  day_tour: ["Day tour", "Tour de un día"],
};

export type StartResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * A Stripe payment page for what is still to pay online on this trip. `origin` is the site the
 * traveller is on (the preview or the live site): Stripe sends them back to its trip page.
 */
export async function startTripCheckout(tripToken: string, origin: string): Promise<StartResult> {
  const s = stripe();
  const db = createSupabaseAdminClient();
  if (!s || !db) return { ok: false, error: "Online payment isn't switched on yet. Please message us on WhatsApp." };
  const { data: trip } = await db.from("trips").select("id, guest_email, language").eq("access_token", tripToken).maybeSingle();
  if (!trip) return { ok: false, error: "We couldn't find that trip." };
  const { data: rows } = await db
    .from("bookings")
    .select("id, booking_ref, service_type, origin, destination, status, payment_mode, total_price, amount_paid, amount_held")
    .eq("trip_id", trip.id)
    .order("scheduled_at", { ascending: true });
  const due = (rows ?? []).map((b) => ({ b, cents: onlineDueCents(b) })).filter((x) => x.cents > 0);
  if (due.length === 0) return { ok: false, error: "There's nothing left to pay online on this trip." };
  const es = trip.language === "es";
  const refs = due.map((x) => x.b.booking_ref).join(", ");
  const meta = { trip_id: trip.id as string, ...holdMetadata(due.map((x) => ({ bookingId: x.b.id as string, cents: x.cents }))) };
  try {
    const session = await s.checkout.sessions.create({
      mode: "payment",
      // Cards only (Jorge, 2026-11-22): Apple Pay and Google Pay come with "card". Bank transfers,
      // Klarna, Cash App, Amazon Pay etc. stay off even if switched on in Stripe's dashboard: they
      // don't all support a card hold, are US-only, or cost more.
      allowed_payment_method_types: ["card"],
      locale: es ? "es" : "en",
      customer_email: trip.guest_email ?? undefined,
      line_items: due.map(({ b, cents }) => {
        const kind = SERVICE_NAME[b.service_type as string] ?? ["Trip", "Viaje"];
        const route = b.service_type === "transfer" && b.origin && b.destination ? ` · ${b.origin} → ${b.destination}` : "";
        return {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents,
            product_data: { name: `${kind[es ? 1 : 0]} ${b.booking_ref}${route}`.slice(0, 250) },
          },
        };
      }),
      payment_intent_data: {
        capture_method: "manual",
        description: `Costa Rica Private Transfers · ${refs}`.slice(0, 500),
        metadata: meta,
      },
      metadata: meta,
      // Short-lived page: an old tab can't hold the card a second time after a newer payment.
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${origin}/trip/${tripToken}?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/trip/${tripToken}?pay=cancelled`,
    });
    if (!session.url) return { ok: false, error: "We couldn't open the payment page. Please try again." };
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("[stripe] checkout create failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "We couldn't open the payment page. Please try again." };
  }
}

export type RecordResult = { state: "held" | "paid" | "none"; tripId?: string };

/**
 * Save a finished Stripe checkout: one payment row per booking ('authorized' while the card is
 * held), and the booking's held amount. Safe to call more than once (the return page and the
 * webhook both do): a payment already saved adds nothing. `tripId` = only accept that trip's.
 */
export async function recordCheckout(sessionId: string, tripId?: string): Promise<RecordResult> {
  const s = stripe();
  const db = createSupabaseAdminClient();
  if (!s || !db || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) return { state: "none" };
  let session: Stripe.Checkout.Session;
  try {
    session = await s.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  } catch {
    return { state: "none" };
  }
  const forTrip = session.metadata?.trip_id;
  if (!forTrip || (tripId && forTrip !== tripId)) return { state: "none" };
  const pi = session.payment_intent;
  if (!pi || typeof pi === "string") return { state: "none" };
  if (pi.status !== "requires_capture" && pi.status !== "succeeded") return { state: "none", tripId: forTrip };

  const lines = parseHoldMetadata(session.metadata);
  const held = pi.status === "requires_capture";
  for (const l of lines) {
    const ins = await db
      .from("payments")
      .insert({
        booking_id: l.bookingId,
        provider: pi.livemode ? "stripe" : "test",
        provider_ref: pi.id,
        amount: l.cents / 100,
        type: "full",
        status: held ? "authorized" : "succeeded",
        raw_payload: { checkout_session: session.id, livemode: pi.livemode, card_hold: held },
      })
      .select("id");
    if (ins.error) {
      if (ins.error.code === "23505") continue; // already saved
      console.error("[stripe] payment row failed", ins.error.message);
      continue;
    }
    await addToBooking(db, l.bookingId, held ? { held: l.cents } : { paid: l.cents });
  }
  // The "new trip request" messages that waited for the card (src/lib/requestNotices.ts), once.
  await sendHeldNotices(forTrip);
  if (held) await settleTripHolds(forTrip);
  return { state: held ? "held" : "paid", tripId: forTrip };
}

/** Move money on the booking row: held up/down, paid up. Cents in, dollars stored. */
async function addToBooking(db: Db, bookingId: string, d: { held?: number; paid?: number }) {
  const { data: b } = await db.from("bookings").select("amount_held, amount_paid").eq("id", bookingId).maybeSingle();
  if (!b) return;
  const held = Math.max(0, Math.round(Number(b.amount_held ?? 0) * 100) + (d.held ?? 0));
  const paid = Math.round(Number(b.amount_paid ?? 0) * 100) + (d.paid ?? 0);
  await db.from("bookings").update({ amount_held: held / 100, amount_paid: paid / 100 }).eq("id", bookingId);
}

/** Mark one held payment row charged or released; the booking's amounts follow. Once only. */
async function closeRow(db: Db, paymentId: string, to: "succeeded" | "released") {
  const { data } = await db
    .from("payments")
    .update({ status: to })
    .eq("id", paymentId)
    .eq("status", "authorized")
    .select("booking_id, amount");
  const row = data?.[0];
  if (!row) return; // someone else closed it already
  const cents = Math.round(Number(row.amount) * 100);
  await addToBooking(db, row.booking_id as string, to === "succeeded" ? { held: -cents, paid: cents } : { held: -cents });
}

/**
 * Charge or release the card holds on one trip (or on every trip with a hold, when no trip is
 * given: the hourly job). Rules: src/lib/cardHold.ts. Errors are logged, never thrown, so the
 * team's save never fails because of Stripe; the next hourly run tries again.
 */
export async function settleTripHolds(tripId?: string, now = new Date()): Promise<{ charged: number; released: number; errors: number }> {
  const out = { charged: 0, released: 0, errors: 0 };
  const s = stripe();
  const db = createSupabaseAdminClient();
  if (!s || !db) return out;
  let q = db
    .from("payments")
    .select("id, booking_id, amount, provider_ref, created_at, bookings!inner(trip_id, status, assigned_driver_id)")
    .eq("status", "authorized")
    .like("provider_ref", "pi\\_%");
  if (tripId) q = q.eq("bookings.trip_id", tripId);
  const { data, error } = await q.limit(1000);
  if (error) {
    console.error("[stripe] holds query failed", error.message);
    return { ...out, errors: 1 };
  }
  const byIntent = new Map<string, { lines: HeldLine[]; heldAt: Date }>();
  for (const r of data ?? []) {
    const b = (Array.isArray(r.bookings) ? r.bookings[0] : r.bookings) as { status: string; assigned_driver_id: string | null } | null;
    const key = r.provider_ref as string;
    const g = byIntent.get(key) ?? { lines: [], heldAt: new Date(r.created_at as string) };
    const at = new Date(r.created_at as string);
    if (at < g.heldAt) g.heldAt = at;
    g.lines.push({
      paymentId: r.id as string,
      bookingId: r.booking_id as string,
      amountCents: Math.round(Number(r.amount) * 100),
      bookingStatus: b?.status ?? "cancelled",
      hasDriver: Boolean(b?.assigned_driver_id),
    });
    byIntent.set(key, g);
  }
  for (const [intentId, g] of byIntent) {
    const d = decideHold(g.lines, g.heldAt, now);
    if (d.action === "wait") continue;
    try {
      if (d.action === "release") {
        await s.paymentIntents.cancel(intentId).catch(async (e) => {
          // Already released (expired, or by hand in Stripe): fine, record it.
          const pi = await s.paymentIntents.retrieve(intentId);
          if (pi.status !== "canceled") throw e;
        });
        for (const l of g.lines) await closeRow(db, l.paymentId, "released");
        out.released++;
      } else {
        const pi = await s.paymentIntents.retrieve(intentId);
        if (pi.status === "requires_capture") await s.paymentIntents.capture(intentId, { amount_to_capture: d.chargeCents });
        else if (pi.status === "canceled") {
          // The hold ran out before it could be charged: the trip shows "to pay" again.
          console.error("[stripe] hold expired before charge", intentId);
          for (const l of g.lines) await closeRow(db, l.paymentId, "released");
          out.errors++;
          continue;
        }
        for (const id of d.charge) await closeRow(db, id, "succeeded");
        for (const id of d.release) await closeRow(db, id, "released");
        out.charged++;
      }
    } catch (e) {
      console.error("[stripe] settle failed", intentId, e instanceof Error ? e.message : e);
      out.errors++;
    }
  }
  return out;
}

/**
 * Stripe's webhook (/api/stripe/webhook): a finished checkout is saved even if the traveller
 * closed the page before coming back. Needs STRIPE_WEBHOOK_SECRET. Returns false for a bad signature.
 */
export async function handleStripeWebhook(body: string, signature: string): Promise<boolean> {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!s || !secret) return false;
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(body, signature, secret);
  } catch {
    return false;
  }
  if (event.type === "checkout.session.completed") {
    await recordCheckout(event.data.object.id);
  } else if (event.type === "payment_intent.canceled") {
    // A hold released in Stripe's dashboard or expired: the rows follow.
    const db = createSupabaseAdminClient();
    if (db) {
      const { data } = await db.from("payments").select("id").eq("provider_ref", event.data.object.id).eq("status", "authorized");
      for (const r of data ?? []) await closeRow(db, r.id as string, "released");
    }
  }
  return true;
}
