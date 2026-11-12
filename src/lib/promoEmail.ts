import "server-only";
import { SITE_URL, sendEmail, type Email } from "./email";
import { MIN_SECRET_LENGTH, makeUnsubscribeToken, normalizeEmail, readUnsubscribeToken } from "./unsubscribeToken";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * Promotional emails (docs/PROJECT.md §4.7): anything that suggests a new booking, as opposed
 * to the emails about a booking the traveller already made (confirmations, reminders, rating
 * requests, chat), which always go out. Every promotional email goes through
 * sendPromotionalEmail(), which:
 *   - sends nothing to an address on the unsubscribe list (email_optouts);
 *   - adds the signed unsubscribe link at the bottom and the List-Unsubscribe headers, so the
 *     mail app's own "Unsubscribe" button works in one click;
 *   - sends nothing if there is no secret to sign the link with.
 * The link is signed with UNSUBSCRIBE_SECRET (Vercel), or CRON_SECRET when that isn't set.
 * Changing the secret makes older unsubscribe links stop working, so set it once and keep it.
 */

type Db = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

export function unsubscribeSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
  return s.length >= MIN_SECRET_LENGTH ? s : "";
}

/** The email address an unsubscribe token was made for, or null if it isn't valid. */
export function emailFromUnsubscribeToken(token: unknown): string | null {
  const secret = unsubscribeSecret();
  return secret ? readUnsubscribeToken(token, secret) : null;
}

export async function isOptedOut(db: Db, email: string): Promise<boolean> {
  const clean = normalizeEmail(email);
  if (!clean) return true;
  const { data, error } = await db.from("email_optouts").select("email").eq("email", clean).maybeSingle();
  // If the list can't be read, treat the address as unsubscribed: never send a promotion by mistake.
  if (error) return true;
  return Boolean(data);
}

/** Put an address on the unsubscribe list (again is fine). */
export async function optOut(email: string, source: "link" | "one_click"): Promise<boolean> {
  const db = createSupabaseAdminClient();
  const clean = normalizeEmail(email);
  if (!db || !clean) return false;
  const { error } = await db.from("email_optouts").upsert({ email: clean, source }, { onConflict: "email", ignoreDuplicates: true });
  if (error) console.error("[unsubscribe]", error.message);
  return !error;
}

/** Take an address off the list ("I unsubscribed by mistake"). */
export async function optBackIn(email: string): Promise<boolean> {
  const db = createSupabaseAdminClient();
  const clean = normalizeEmail(email);
  if (!db || !clean) return false;
  const { error } = await db.from("email_optouts").delete().eq("email", clean);
  return !error;
}

export type PromoResult = "sent" | "failed" | "opted_out" | "no_secret";

/**
 * Send one promotional email, unless the address unsubscribed. `unsubscribeText` is the small
 * line at the bottom and the link's words, in the traveller's language.
 */
export async function sendPromotionalEmail(
  db: Db,
  e: Omit<Email, "unsubscribe">,
  unsubscribeText: { note: string; label: string },
): Promise<PromoResult> {
  const secret = unsubscribeSecret();
  if (!secret) return "no_secret";
  if (await isOptedOut(db, e.to)) return "opted_out";
  const token = makeUnsubscribeToken(e.to, secret);
  const lang = e.lang === "es" ? "&lang=es" : "";
  const ok = await sendEmail({
    ...e,
    unsubscribe: {
      ...unsubscribeText,
      pageUrl: `${SITE_URL}/unsubscribe?t=${token}${lang}`,
      oneClickUrl: `${SITE_URL}/api/unsubscribe?t=${token}${lang}`,
    },
  });
  return ok ? "sent" : "failed";
}
