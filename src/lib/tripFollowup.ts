import "server-only";
import {
  followupDue,
  followupExpired,
  followupSkipReason,
  returnRideHref,
  toursNear,
  townOf,
  type FollowupBooking,
  type FollowupSkip,
  type StoredCoords,
} from "./automationRules";
import { HUB_REGION } from "./catalog";
import { hubName, localizeCatalog, placeNameFor, regionName } from "./catalogEs";
import { getCatalog } from "./catalogSource";
import { SITE_URL } from "./email";
import { isOptedOut, sendPromotionalEmail, unsubscribeSecret } from "./promoEmail";
import { applyMultiplier, formatUSDWhole } from "./pricing";
import { localizedHref, parsePublicLang } from "./publicLang";
import { createSupabaseAdminClient } from "./supabase/admin";
import { followupEmail, followupUnsubscribeText } from "./travellerMessages";

/**
 * "Book your return / a day tour" (rules in src/lib/automationRules.ts, docs/PROJECT.md §4.7):
 * the morning after a completed ride, ONE email (no push) to the traveller, in the language
 * they booked in, with a link to the ride builder with the way back filled in and, where the
 * ride ended in a region with day tours, up to two of them with their live "from" price.
 *
 * Promotional: sent through sendPromotionalEmail() (unsubscribe list, signed unsubscribe link).
 * Skipped (and marked, so it is never looked at again) for day tours, drop-offs at the airport,
 * travellers who already booked the way back, who unsubscribed, or who rated the ride 3 stars
 * or less. bookings.followup_sent_at is set before sending, so it goes out once at most.
 */
const BATCH = 200;
/** Only rides from the last few days are looked at (older ones are past the follow-up window). */
const LOOKBACK_DAYS = 5;

const COLUMNS =
  "id, trip_id, status, service_type, origin, destination, origin_coords, destination_coords, scheduled_at, completed_at, review_requested_at, followup_sent_at";

interface Row {
  id: string;
  trip_id: string | null;
  status: string;
  service_type: string;
  origin: string | null;
  destination: string | null;
  origin_coords: StoredCoords | null;
  destination_coords: StoredCoords | null;
  scheduled_at: string | null;
  completed_at: string | null;
  review_requested_at: string | null;
  followup_sent_at: string | null;
}

const asBooking = (r: Pick<Row, "id" | "service_type" | "scheduled_at" | "origin" | "destination" | "origin_coords" | "destination_coords">): FollowupBooking => ({
  id: r.id,
  service_type: r.service_type,
  scheduled_at: r.scheduled_at,
  origin: { text: r.origin, coords: r.origin_coords },
  destination: { text: r.destination, coords: r.destination_coords },
});

export async function sendTripFollowups(now = new Date()): Promise<{ checked: number; sent: number; skipped: Partial<Record<FollowupSkip | "expired" | "failed", number>>; error?: string }> {
  const out = { checked: 0, sent: 0, skipped: {} as Partial<Record<FollowupSkip | "expired" | "failed", number>> };
  const db = createSupabaseAdminClient();
  if (!db) return { ...out, error: "Database not configured" };
  // Without a secret there is no unsubscribe link, so nothing promotional goes out (nothing is marked).
  if (!unsubscribeSecret()) return { ...out, error: "No UNSUBSCRIBE_SECRET or CRON_SECRET" };
  const { data, error } = await db
    .from("bookings")
    .select(COLUMNS)
    .eq("status", "completed")
    .is("followup_sent_at", null)
    .gte("scheduled_at", new Date(now.getTime() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(BATCH)
    .returns<Row[]>();
  if (error) return { ...out, error: error.message };
  const rows = data ?? [];
  out.checked = rows.length;
  const stamp = now.toISOString();
  const skip = (why: FollowupSkip | "expired" | "failed") => (out.skipped[why] = (out.skipped[why] ?? 0) + 1);
  const claim = async (id: string) => {
    const { data: marked } = await db.from("bookings").update({ followup_sent_at: stamp }).eq("id", id).is("followup_sent_at", null).select("id");
    return Boolean(marked?.length);
  };
  let catalog: Awaited<ReturnType<typeof getCatalog>> | null = null;

  for (const r of rows) {
    // When the ride ended: the driver's "completed", else when the rating request went out.
    const ended = r.completed_at ?? r.review_requested_at ?? r.scheduled_at;
    if (followupExpired(now, ended)) {
      if (await claim(r.id)) skip("expired");
      continue;
    }
    if (!followupDue(now, ended)) continue;
    try {
      const { data: trip } = r.trip_id
        ? await db.from("trips").select("guest_name, guest_email, language").eq("id", r.trip_id).maybeSingle()
        : { data: null };
      const email = trip?.guest_email ?? null;
      const b = asBooking(r);
      // The traveller's other bookings (any trip sent with the same email), to spot a return already booked.
      let others: (FollowupBooking & { status: string })[] = [];
      let stars: number | null = null;
      let optedOut = false;
      if (email && r.service_type === "transfer") {
        const { data: theirTrips } = await db.from("trips").select("id").ilike("guest_email", email.trim().replace(/[%_\\]/g, "\\$&")).limit(50);
        const ids = (theirTrips ?? []).map((x) => x.id as string);
        const [{ data: theirs }, { data: rating }, opted] = await Promise.all([
          ids.length
            ? db
                .from("bookings")
                .select("id, status, service_type, scheduled_at, origin, destination, origin_coords, destination_coords")
                .in("trip_id", ids)
                .neq("status", "cancelled")
                .returns<Row[]>()
            : Promise.resolve({ data: [] as Row[] }),
          db.from("driver_reviews").select("stars").eq("booking_id", r.id).maybeSingle(),
          isOptedOut(db, email),
        ]);
        others = (theirs ?? []).map((o) => ({ ...asBooking(o), status: o.status }));
        stars = rating?.stars ?? null;
        optedOut = opted;
      }
      const why = followupSkipReason(b, { email, optedOut, others, stars });
      if (why) {
        if (await claim(r.id)) skip(why);
        continue;
      }
      const lang = parsePublicLang(trip?.language);
      const returnPath = returnRideHref(b.origin, b.destination, lang === "es" ? "/es" : "/");
      if (!returnPath) {
        if (await claim(r.id)) skip("not_a_ride");
        continue;
      }
      if (!(await claim(r.id))) continue;
      catalog ??= await getCatalog();
      // The site's "From $X per person": the 4+ travellers rate in the default season, live from the catalog.
      const seasonBps = (catalog.seasons.find((s) => s.isDefault) ?? catalog.seasons[0])?.multiplierBps ?? 10000;
      const tours = toursNear(b.destination, localizeCatalog(catalog, lang).dayTours).map((x) => ({
        name: x.name,
        fromPrice: formatUSDWhole(applyMultiplier(x.perPerson.groupCents, seasonBps)),
        url: `${SITE_URL}${localizedHref("/?tab=tours", lang)}`,
      }));
      const town = townOf(b.destination);
      const region = town ? HUB_REGION[town] : undefined;
      const msg = followupEmail(lang, {
        guestName: trip?.guest_name,
        origin: placeNameFor(r.origin, lang),
        // The town ("Manuel Antonio"), not the hotel's full address.
        destination: town ? hubName(town, lang) : placeNameFor(r.destination, lang),
        returnUrl: `${SITE_URL}${returnPath}`,
        region: tours.length && region ? regionName(region, lang) : null,
        tours,
      });
      const result = await sendPromotionalEmail(db, { to: email!, ...msg }, followupUnsubscribeText(lang));
      if (result === "sent") out.sent++;
      else skip(result === "opted_out" ? "opted_out" : "failed");
    } catch (e) {
      console.error("[trip follow-up]", r.id, e);
    }
  }
  return out;
}
