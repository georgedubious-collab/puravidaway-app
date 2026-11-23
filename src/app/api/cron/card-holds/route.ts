import { NextResponse } from "next/server";
import { cronRefusal } from "@/lib/cronAuth";
import { settleTripHolds } from "@/lib/stripePayments";

/**
 * Card holds (src/lib/cardHold.ts): charge the ones whose rides all have a driver, or that are
 * 6 days old (a hold lasts 7), and release the ones whose bookings were all cancelled.
 * Called once an hour by the GitHub Action .github/workflows/eta-check.yml. Safe to call as often
 * as anyone likes. The caller must send "Authorization: Bearer <CRON_SECRET>".
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const refused = cronRefusal(req);
  if (refused) return refused;
  const out = await settleTripHolds();
  return NextResponse.json(out, { status: 200 });
}
