import { NextResponse } from "next/server";
import { cronRefusal } from "@/lib/cronAuth";
import { sendTripFollowups } from "@/lib/tripFollowup";

/**
 * The "book your return / a day tour" email (src/lib/tripFollowup.ts; rules in
 * src/lib/automationRules.ts): one per completed ride, from 7 AM Costa Rica time the morning
 * after, never at night, with an unsubscribe link.
 *
 * Called about once an hour by the GitHub Action .github/workflows/eta-check.yml and once a day
 * by Vercel Cron as a backstop (vercel.json). Safe to call as often as anyone likes: each
 * booking is marked before the email is sent. The caller must send
 * "Authorization: Bearer <CRON_SECRET>".
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const refused = cronRefusal(req);
  if (refused) return refused;
  const out = await sendTripFollowups();
  return NextResponse.json(out, { status: out.error ? 500 : 200 });
}
