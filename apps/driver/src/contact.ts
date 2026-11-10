/**
 * Same check as the website (src/lib/preferences.ts hasContactDetails): used to warn
 * before sending a chat message. The server hides contact details itself
 * (src/lib/contactFilter.ts); this only warns early.
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
