import "server-only";
import { displayHidden } from "./contactFilter";
import { SITE_URL, sendEmail } from "./email";
import { parsePublicLang } from "./publicLang";
import { createSupabaseAdminClient } from "./supabase/admin";
import { chatMessageEmail } from "./travellerMessages";

/** Messages to a traveller must stay unread this long before we email them. */
const UNREAD_DELAY = "10 minutes";

/**
 * Travellers without the customer app (most book on the website): one email when
 * messages from their driver or our team have stayed unread for 10 minutes, in the
 * trip's language, linking to their private trip page. Then nothing more until they
 * read the chat (claim_unread_chat_emails(), migration 0034), so a burst of messages
 * is one email. Travellers with the app get a push for each message instead.
 * Run every 5 minutes by the GitHub Action (/api/cron/chat-unread).
 */
export async function emailUnreadChats(): Promise<{ claimed: number; emailed: number; skippedApp: number }> {
  const out = { claimed: 0, emailed: 0, skippedApp: 0 };
  const db = createSupabaseAdminClient();
  if (!db) return out;
  const { data, error } = await db.rpc("claim_unread_chat_emails", { p_delay: UNREAD_DELAY });
  if (error) {
    console.error("[chat emails]", error.message);
    return out;
  }
  const rows = (data ?? []) as { booking_id: string; unread: number; last_message: string; last_role: string }[];
  out.claimed = rows.length;
  for (const r of rows) {
    const { data: b } = await db.from("bookings").select("booking_ref, trip_id").eq("id", r.booking_id).maybeSingle();
    if (!b?.trip_id) continue;
    const { data: trip } = await db.from("trips").select("guest_name, guest_email, access_token, language").eq("id", b.trip_id).maybeSingle();
    if (!trip?.guest_email) continue;
    if (await hasClientApp(db, trip.guest_email)) {
      out.skippedApp++;
      continue;
    }
    const lang = parsePublicLang(trip.language);
    const text = r.last_message.length > 300 ? `${r.last_message.slice(0, 300)}…` : r.last_message;
    const sent = await sendEmail({
      to: trip.guest_email,
      ...chatMessageEmail(lang, {
        guestName: trip.guest_name,
        ref: b.booking_ref,
        from: r.last_role === "admin" ? "team" : "driver",
        snippet: displayHidden(text, lang),
        chatUrl: `${SITE_URL}/trip/${trip.access_token}#chat-${r.booking_id}`,
        count: r.unread,
      }),
    });
    if (sent) out.emailed++;
  }
  return out;
}

/** Does someone who signed in with this email have the customer app with push switched on? */
async function hasClientApp(db: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, email: string): Promise<boolean> {
  const clean = email.trim().toLowerCase().replace(/[%_\\]/g, "\\$&");
  const { data: people } = await db.from("profiles").select("id").ilike("email", clean).limit(5);
  const ids = (people ?? []).map((p) => p.id as string);
  if (!ids.length) return false;
  const { count } = await db.from("device_tokens").select("token", { count: "exact", head: true }).in("user_id", ids).eq("app", "client");
  return (count ?? 0) > 0;
}
