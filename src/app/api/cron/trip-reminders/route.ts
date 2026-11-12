import { NextResponse } from "next/server";
import { cronRefusal } from "@/lib/cronAuth";
import { sendDayBeforeReminders } from "@/lib/dayBeforeReminders";
import { sweepLowRatings } from "@/lib/lowRatingAlert";

/**
 * The day-before reminders (src/lib/dayBeforeReminders.ts; rules in src/lib/automationRules.ts):
 * one to the traveller and one to the driver when a confirmed pickup is 20–28 hours away, never
 * between 9 PM and 7 AM Costa Rica time.
 *
 * Called about once an hour by the GitHub Action .github/workflows/eta-check.yml and once a day
 * by Vercel Cron as a backstop (vercel.json). Safe to call as often as anyone likes: each
 * reminder is marked before it is sent, and only the call that marked it sends. The caller must
 * send "Authorization: Bearer <CRON_SECRET>".
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const refused = cronRefusal(req);
  if (refused) return refused;
  const out = await sendDayBeforeReminders();
  // Backstop for the low-rating email to the team (normally sent the moment the rating is saved).
  const lowRatingAlerts = await sweepLowRatings();
  return NextResponse.json({ ...out, lowRatingAlerts }, { status: out.error ? 500 : 200 });
}
