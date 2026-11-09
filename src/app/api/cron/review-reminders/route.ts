import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { SITE_URL, sendEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Daily job (vercel.json → 09:00 Costa Rica): travellers who were asked to rate
 * their driver 3+ days ago and haven't yet get one follow-up email, once.
 * Vercel calls it with "Authorization: Bearer <CRON_SECRET>"; nothing else can.
 */
export const dynamic = "force-dynamic";

const DAYS_BEFORE_REMINDER = 3;
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

  const cutoff = new Date(Date.now() - DAYS_BEFORE_REMINDER * 86400000).toISOString();
  const { data: due, error } = await db
    .from("bookings")
    .select("id, booking_ref, trip_id, service_type, origin, destination, assigned_driver_id")
    .eq("status", "completed")
    .lt("review_requested_at", cutoff)
    .is("review_reminded_at", null)
    .not("trip_id", "is", null)
    .not("assigned_driver_id", "is", null)
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ sent: 0 });

  // Skip the ones that were rated in the meantime.
  const { data: rated } = await db.from("driver_reviews").select("booking_id").in("booking_id", due.map((b) => b.id));
  const ratedIds = new Set((rated ?? []).map((r) => r.booking_id));
  const pending = due.filter((b) => !ratedIds.has(b.id));
  // Mark the rated ones too, so they never come up again.
  if (ratedIds.size) await db.from("bookings").update({ review_reminded_at: new Date().toISOString() }).in("id", [...ratedIds]);

  let sent = 0;
  for (const b of pending) {
    const [{ data: trip }, { data: who }] = await Promise.all([
      db.from("trips").select("guest_name, guest_email, access_token").eq("id", b.trip_id!).maybeSingle(),
      db.from("profiles").select("full_name").eq("id", b.assigned_driver_id!).maybeSingle(),
    ]);
    // Mark first so a failure never causes a second email later.
    await db.from("bookings").update({ review_reminded_at: new Date().toISOString() }).eq("id", b.id);
    if (!trip?.guest_email) continue;
    const first = (who?.full_name ?? "your driver").split(" ")[0];
    const ok = await sendEmail({
      to: trip.guest_email,
      subject: `A quick one: how was ${first}? (${b.booking_ref})`,
      lines: [
        `Hi ${(trip.guest_name ?? "").split(" ")[0] || "there"},`,
        `Just a gentle reminder in case it slipped by: could you rate ${first} for your ${
          b.service_type === "transfer" ? `ride ${b.origin ?? ""} → ${b.destination ?? ""}` : "trip"
        }? It takes 10 seconds. A few words help even more: our best-rated drivers get more trips.`,
        "This is the only reminder we'll send.",
      ],
      button: { label: `Rate ${first}`, url: `${SITE_URL}/trip/${trip.access_token}` },
    });
    if (ok) sent++;
  }
  return NextResponse.json({ sent, checked: due.length });
}
