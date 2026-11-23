import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/stripePayments";

/**
 * Stripe calls this when a checkout finishes or a card hold is released (src/lib/stripePayments.ts).
 * Stripe signs every call; one without a valid signature (STRIPE_WEBHOOK_SECRET) is refused.
 * Set up in Stripe → Developers → Webhooks: endpoint https://www.costaricaprivatetransfers.com/api/stripe/webhook,
 * events checkout.session.completed and payment_intent.canceled.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const ok = await handleStripeWebhook(body, req.headers.get("stripe-signature") ?? "");
  return NextResponse.json({ received: ok }, { status: ok ? 200 : 400 });
}
