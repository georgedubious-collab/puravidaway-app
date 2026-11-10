import "server-only";
import { SITE_INDEXABLE } from "./site";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * TEST checkout (Jorge, 2026-11-09: "dummy checkout for now"). Stands in for
 * Green Pay until it is connected: no card is asked for and no money moves.
 * It records the online-payable bookings of a trip as paid with a payment row
 * marked provider = 'test', so the rest of the flow (dispatch, payouts) can be
 * tried end to end.
 *
 * It only works while the site is in its pre-launch state (not indexable). The
 * day NEXT_PUBLIC_SITE_INDEXABLE is set to true for launch, this switches itself
 * off; real payments must be in place by then (PROJECT.md §6.4).
 */
export const TEST_CHECKOUT_ENABLED = !SITE_INDEXABLE;

export interface TestPayResult {
  ok: boolean;
  error?: string;
  paidUsd?: number;
}

export async function payTripForTesting(tripToken: string, email: string): Promise<TestPayResult> {
  if (!TEST_CHECKOUT_ENABLED) return { ok: false, error: "Online payment isn't available in the app yet. We'll send you a secure payment link." };
  const db = createSupabaseAdminClient();
  if (!db) return { ok: false, error: "Payments aren't switched on." };
  const { data: trip } = await db.from("trips").select("id, guest_email").eq("access_token", tripToken).maybeSingle();
  // The trip must belong to the signed-in email.
  if (!trip || (trip.guest_email ?? "").toLowerCase() !== email.trim().toLowerCase()) return { ok: false, error: "We couldn't find that trip." };
  const { data: bookings } = await db
    .from("bookings")
    .select("id, total_price, amount_paid, payment_mode, status")
    .eq("trip_id", trip.id)
    .neq("status", "cancelled");
  let paid = 0;
  for (const b of bookings ?? []) {
    if (b.payment_mode === "cash_driver") continue;
    const due = Math.round((Number(b.total_price) - Number(b.amount_paid ?? 0)) * 100) / 100;
    if (due <= 0) continue;
    const pay = await db.from("payments").insert({
      booking_id: b.id,
      provider: "test",
      provider_ref: `test-${Date.now()}`,
      amount: due,
      type: "full",
      status: "succeeded",
      raw_payload: { note: "Test checkout from the traveller app. No money was charged." },
    });
    if (pay.error) return { ok: false, error: "The test payment couldn't be recorded." };
    await db.from("bookings").update({ amount_paid: Number(b.total_price) }).eq("id", b.id);
    paid += due;
  }
  return { ok: true, paidUsd: Math.round(paid * 100) / 100 };
}
