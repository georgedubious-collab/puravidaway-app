import { TRIP_TOKEN } from "@/lib/bookings";
import { SITE_URL } from "@/lib/site";
import { STRIPE_ENABLED, startTripCheckout } from "@/lib/stripePayments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, signedIn } from "../../shared";

/**
 * POST { trip } → { ok, url }: the Stripe payment page for what is still to pay online on the
 * signed-in traveller's trip (the card is held, src/lib/stripePayments.ts). The app opens it in
 * an in-app browser; Stripe sends the traveller back to the trip page, which saves the payment.
 */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  if (!STRIPE_ENABLED) return json({ ok: false, error: "Online payment isn't switched on yet." }, 400);
  const b = ((await req.json().catch(() => ({}))) ?? {}) as { trip?: unknown };
  if (typeof b.trip !== "string" || !TRIP_TOKEN.test(b.trip)) return json({ ok: false, error: "We couldn't find that trip." }, 400);
  const db = createSupabaseAdminClient();
  const { data: trip } = db ? await db.from("trips").select("guest_email").eq("access_token", b.trip).maybeSingle() : { data: null };
  // The trip must belong to the signed-in email.
  if (!trip || (trip.guest_email ?? "").toLowerCase() !== (me.email ?? "").trim().toLowerCase())
    return json({ ok: false, error: "We couldn't find that trip." }, 400);
  const res = await startTripCheckout(b.trip, SITE_URL);
  return json(res, res.ok ? 200 : 400);
}
