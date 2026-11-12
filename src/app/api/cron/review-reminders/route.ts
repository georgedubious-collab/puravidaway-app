import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { placeNameFor } from "@/lib/catalogEs";
import { SITE_URL, sendEmail } from "@/lib/email";
import { parsePublicLang } from "@/lib/publicLang";
import { sendPushToEmail } from "@/lib/push";
import { planReviewReminders, reminderCutoff } from "@/lib/reviewReminder";
import { driverFirstName, reviewReminderEmail, reviewReminderPush } from "@/lib/travellerMessages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * The single rating reminder (rules in src/lib/reviewReminder.ts): travellers who
 * were asked to rate their driver 24+ hours ago and haven't yet get ONE push
 * (if they have the app) and ONE email, never a second time, and never between
 * 9 PM and 7 AM Costa Rica time (a reminder due at night goes out with the first
 * check after 7 AM).
 *
 * Called about once an hour by the GitHub Action .github/workflows/eta-check.yml
 * and once a day by Vercel Cron as a backstop (vercel.json, 09:00 Costa Rica).
 * Safe to call as often as anyone likes: each booking is marked
 * (bookings.review_reminded_at) before anything is sent, and only the call that
 * marked it sends. The caller must send "Authorization: Bearer <CRON_SECRET>".
 */
export const dynamic = "force-dynamic";

const BATCH = 100;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const now = new Date();
  const { data: due, error } = await db
    .from("bookings")
    .select("id, status, booking_ref, trip_id, service_type, origin, destination, assigned_driver_id, review_requested_at, review_reminded_at")
    .eq("status", "completed")
    .lte("review_requested_at", reminderCutoff(now).toISOString())
    .is("review_reminded_at", null)
    .not("trip_id", "is", null)
    .not("assigned_driver_id", "is", null)
    .order("review_requested_at", { ascending: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ sent: 0, checked: 0 });

  const { data: rated } = await db.from("driver_reviews").select("booking_id").in("booking_id", due.map((b) => b.id));
  const plan = planReviewReminders(now, due, (rated ?? []).map((r) => r.booking_id as string));
  const stamp = now.toISOString();
  // Rated in the meantime: mark them so they never come up again. Nothing is sent.
  if (plan.markOnly.length) await db.from("bookings").update({ review_reminded_at: stamp }).in("id", plan.markOnly).is("review_reminded_at", null);
  // Night in Costa Rica: leave the rest untouched for the first check after 7 AM.
  if (plan.quiet) return NextResponse.json({ sent: 0, checked: due.length, quiet: true });

  let sent = 0;
  for (const b of due.filter((x) => plan.remind.includes(x.id))) {
    // Mark first, and only go on if this call was the one that marked it: a failure, or
    // another check running at the same moment, can never cause a second reminder.
    const marked = await db.from("bookings").update({ review_reminded_at: stamp }).eq("id", b.id).is("review_reminded_at", null).select("id");
    if (!marked.data?.length) continue;
    const [{ data: trip }, { data: who }] = await Promise.all([
      db.from("trips").select("guest_name, guest_email, access_token, language").eq("id", b.trip_id!).maybeSingle(),
      db.from("profiles").select("full_name").eq("id", b.assigned_driver_id!).maybeSingle(),
    ]);
    if (!trip?.guest_email) continue;
    // In the language the traveller booked in.
    const lang = parsePublicLang(trip.language);
    const driver = driverFirstName(lang, who?.full_name, false);
    const ride = b.service_type === "transfer";
    try {
      // To the app, if they have it; tapping it opens the trip with the rating panel.
      await sendPushToEmail(trip.guest_email, { ...reviewReminderPush(lang, { driver, ride }), data: { screen: "trip", id: b.id, rate: "1" } });
      const ok = await sendEmail({
        to: trip.guest_email,
        ...reviewReminderEmail(lang, {
          guestName: trip.guest_name,
          driver,
          ref: b.booking_ref,
          ride,
          origin: placeNameFor(b.origin, lang),
          destination: placeNameFor(b.destination, lang),
          tripUrl: `${SITE_URL}/trip/${trip.access_token}`,
        }),
      });
      if (ok) sent++;
    } catch (e) {
      console.error("[review reminder]", e);
    }
  }
  return NextResponse.json({ sent, checked: due.length });
}
