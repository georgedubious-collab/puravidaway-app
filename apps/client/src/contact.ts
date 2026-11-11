/**
 * Same check as the website (src/lib/preferences.ts hasContactDetails): the message
 * for the driver may not carry phone numbers, emails or links. The server checks
 * again; this only warns early.
 */
export function hasContactDetails(t: string): boolean {
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) return true;
  if (/(https?:\/\/|www\.|\.com\b|\.cr\b|wa\.me|\bdot\s+com\b)/i.test(t)) return true;
  if (/\b(gmail|hotmail|yahoo|outlook|icloud|proton)\b/i.test(t)) return true;
  if (/(^|\s)@[a-z0-9_.]{3,}/i.test(t)) return true;
  const cleaned = t
    .replace(/(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}/g, "")
    .replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/g, "")
    .replace(/(?<=\d)[ ().+_/,-]+(?=\d)/g, "");
  return /\d{8,}/.test(cleaned);
}

/** Longest text for the driver's name sign (same as the website, src/lib/sign.ts). */
export const SIGN_MAX = 40;

/** One line, single spaces, trimmed: how the sign text is sent and stored. */
export function cleanSignText(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

/** True when the sign text can't be used: too long, or it carries a phone number, email or link. The server checks again. */
export function signBlocked(v: string): boolean {
  const clean = cleanSignText(v);
  return clean.length > SIGN_MAX || (clean !== "" && hasContactDetails(clean));
}
