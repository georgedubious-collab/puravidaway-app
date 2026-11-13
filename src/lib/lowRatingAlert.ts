import "server-only";
import { isLowRating } from "./automationRules";
import { lowRatingTeamEmail } from "./automationMessages";
import { teamAlertLang } from "./automationRules";
import { bookedItemName } from "./catalog";
import { localizeCatalog } from "./catalogEs";
import { getCatalog } from "./catalogSource";
import { formatScheduledAt } from "./dates";
import { ADMIN_EMAIL, SITE_URL } from "./email";
import { createSupabaseAdminClient } from "./supabase/admin";
import { adminBookingPath, sendTeamAlert, teamAlertsConfigured } from "./teamAlerts";
import { alertText } from "./teamAlertRules";

/**
 * A rating of 3 stars or less (docs/PROJECT.md §4.7): email our team at once (ADMIN_NOTIFY_EMAIL,
 * the same address as new requests and chat messages) with the booking, route, date, driver,
 * stars and comment, and a link to the booking in /admin; and push the team's phones (Web Push,
 * src/lib/teamAlerts.ts: stars, ref, route, driver; never the comment). Once per rating:
 * driver_reviews.team_alerted_at is set first, and only the call that set it sends.
 * The driver is never told. Never throws.
 */
export async function alertTeamOfLowRating(bookingId: string): Promise<boolean> {
  try {
    const db = createSupabaseAdminClient();
    if (!db || !teamAlertsConfigured()) return false;
    const { data: r } = await db.from("driver_reviews").select("id, stars, comment, driver_id, team_alerted_at").eq("booking_id", bookingId).maybeSingle();
    if (!r || r.team_alerted_at || !isLowRating(Number(r.stars))) return false;
    const claimed = await db
      .from("driver_reviews")
      .update({ team_alerted_at: new Date().toISOString() })
      .eq("id", r.id)
      .is("team_alerted_at", null)
      .select("id");
    if (!claimed.data?.length) return false;
    const [{ data: b }, { data: who }] = await Promise.all([
      db.from("bookings").select("booking_ref, service_type, catalog_item_id, origin, destination, scheduled_at").eq("id", bookingId).maybeSingle(),
      db.from("profiles").select("full_name").eq("id", r.driver_id).maybeSingle(),
    ]);
    // Spanish, unless the admin who gets this address uses the team pages / app in English.
    const { data: admin } = ADMIN_EMAIL
      ? await db
          .from("profiles")
          .select("app_lang")
          .ilike("email", ADMIN_EMAIL.trim().replace(/[%_\\]/g, "\\$&"))
          .eq("role", "admin")
          .limit(1)
          .maybeSingle()
      : { data: null };
    const lang = teamAlertLang(admin?.app_lang);
    const isTour = b?.service_type !== "transfer";
    const catalog = isTour ? await getCatalog() : null;
    const routeIn = (l: "en" | "es") =>
      isTour && catalog
        ? (bookedItemName(localizeCatalog(catalog, l).dayTours, b?.catalog_item_id, l) ?? "—")
        : `${b?.origin ?? "—"} → ${b?.destination ?? "—"}`;
    const push = alertText("low_rating", {
      ref: b?.booking_ref ?? "—",
      route: routeIn("es"),
      when: formatScheduledAt(b?.scheduled_at, "es"),
      driver: who?.full_name,
      stars: Number(r.stars),
    });
    const res = await sendTeamAlert("low_rating", {
      dedupeKey: r.id as string,
      push: { ...push, url: adminBookingPath(bookingId) },
      email: ADMIN_EMAIL
        ? {
            to: ADMIN_EMAIL,
            lang,
            ...lowRatingTeamEmail(lang, {
              ref: b?.booking_ref ?? "—",
              route: routeIn(lang),
              tour: isTour,
              when: formatScheduledAt(b?.scheduled_at, lang),
              driverName: who?.full_name ?? "—",
              stars: Number(r.stars),
              comment: r.comment,
              adminUrl: `${SITE_URL}/admin/bookings/${bookingId}`,
            }),
          }
        : null,
    });
    return res.emailed || res.pushed > 0;
  } catch (e) {
    console.error("[low rating alert]", e);
    return false;
  }
}

/**
 * Backstop, run with the hourly reminders: a low rating from the last 2 days whose alert didn't
 * go out at the moment it was saved (a deploy at that second, email briefly down) is sent now.
 * Older ratings are left alone.
 */
export async function sweepLowRatings(now = new Date()): Promise<number> {
  const db = createSupabaseAdminClient();
  if (!db || !teamAlertsConfigured()) return 0;
  const { data } = await db
    .from("driver_reviews")
    .select("booking_id")
    .lte("stars", 3)
    .is("team_alerted_at", null)
    .gte("created_at", new Date(now.getTime() - 48 * 3600 * 1000).toISOString())
    // Give the immediate alert a few minutes first.
    .lte("created_at", new Date(now.getTime() - 10 * 60 * 1000).toISOString())
    .limit(50);
  let sent = 0;
  for (const r of data ?? []) if (await alertTeamOfLowRating(r.booking_id as string)) sent++;
  return sent;
}
