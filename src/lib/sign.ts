/**
 * The name sign at the pickup (Jorge, 2026-11-11): the driver waits holding a sign, and the
 * traveller may choose what it says, when booking and later on the trip page, until the
 * driver sets off.
 *
 * What the sign says, in order (the database's pickup_sign(), migration 0040, is the rule the
 * driver's screens read; signShown() below is the same rule for the traveller's and the
 * team's screens):
 *   1. the traveller's own text (bookings.sign_text), if they wrote one;
 *   2. else, if they ticked "Don't show my name" (bookings.sign_hide_name): our brand name;
 *   3. else their first name + last initial ("Emily R."), or the brand name when the name
 *      they gave has no letters.
 *
 * Plain TypeScript without imports, so scripts/test-sign.mjs runs it with Node. The contact
 * check is passed in by the caller (hasContactDetails in ./preferences).
 */

/** Longest text a traveller may put on the sign (bookings_sign_text_shape, migration 0040). */
export const SIGN_MAX = 40;
/** Shown when the traveller chose "Don't show my name". Same words as pickup_sign() in the database. */
export const SIGN_BRAND = "Costa Rica Private Transfers";

export const SIGN_ERROR_CONTACT = "Please keep phone numbers, emails and links off the name sign.";
export const SIGN_ERROR_LONG = `The name on the sign can be up to ${SIGN_MAX} characters.`;

/** One line, single spaces, trimmed. Anything that isn't text becomes "". */
export function cleanSignText(v: unknown): string {
  // eslint-disable-next-line no-control-regex -- line breaks and tabs must not reach a one-line sign
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() : "";
}

/** Why a cleaned sign text can't be used, as a message for the traveller; null when it is fine (or empty). */
export function signTextProblem(clean: string, hasContactDetails: (t: string) => boolean): string | null {
  if (clean.length > SIGN_MAX) return SIGN_ERROR_LONG;
  if (clean && hasContactDetails(clean)) return SIGN_ERROR_CONTACT;
  return null;
}

/** "Emily Rose Smith" → "Emily S."; letters only. Mirrors public.passenger_short_name() (migration 0035). */
export function shortName(fullName: string | null | undefined): string | null {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const first = (words[0] ?? "").replace(/[^\p{L}'-]/gu, "");
  if (!first) return null;
  const initial = words.length > 1 ? words[words.length - 1].replace(/[^\p{L}]/gu, "").slice(0, 1) : "";
  return first.slice(0, 1).toUpperCase() + first.slice(1, 30) + (initial ? ` ${initial.toUpperCase()}.` : "");
}

/** What the driver's sign will say. Mirrors public.pickup_sign() (migration 0040). */
export function signShown(
  b: { sign_text?: string | null; sign_hide_name?: boolean | null },
  guestName: string | null | undefined,
): string {
  const own = cleanSignText(b.sign_text);
  if (own) return own;
  if (b.sign_hide_name) return SIGN_BRAND;
  return shortName(guestName) ?? SIGN_BRAND;
}

/** The traveller can change the sign until the driver has set off ("on my way") or the trip is over. Rides only. */
export function signEditable(b: { status: string; en_route_at?: string | null; service_type?: string }): boolean {
  return (
    (b.service_type ?? "transfer") === "transfer" &&
    !b.en_route_at &&
    ["pending_payment", "pending_bids", "confirmed"].includes(b.status)
  );
}
