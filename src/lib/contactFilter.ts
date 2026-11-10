/**
 * "Hide and flag" filter for the trip chat (Jorge, 2026-11-10).
 *
 * Travellers and drivers talk through our chat, never directly: before a message is
 * stored, the server replaces every phone number, email, link / domain and social
 * handle with HIDDEN. The original text is kept for admins only (contact_flags) and
 * the sender sees a polite notice. The database applies a simpler copy of these rules
 * as a backstop (public.hide_contact_details(), migration 0034).
 *
 * Plain TypeScript with no imports, so the tests in scripts/test-contact-filter.mjs
 * can run it directly with Node.
 *
 * Deliberately left alone: dates ("2026-11-22", "22/11/2026"), times ("9:30"),
 * prices ("$1,250"), flight numbers ("AA 1234"), booking refs ("CRPT-10492") and
 * passenger counts, so normal trip talk is never mangled.
 */

/** Stored in the database; shown as "[oculto]" to Spanish readers (displayHidden()). */
export const HIDDEN = "[hidden]";
export const HIDDEN_ES = "[oculto]";

export type ContactKind = "phone" | "email" | "link" | "handle";

export interface Filtered {
  /** The text with contact details replaced by HIDDEN. */
  text: string;
  /** What was hidden (one entry per kind, in the order found); empty when nothing was. */
  kinds: ContactKind[];
}

// Not "line", "face" or "signal": too common in normal trip talk ("the line: long").
const PLATFORMS = "whats\\s?app|whatsap|watsapp|wsp|wpp|wapp|telegram|insta(?:gram)?|facebook|fb|messenger|snap(?:chat)?|tik\\s?tok|twitter|viber|skype";

const TLDS =
  "com|net|org|cr|io|me|co|info|biz|app|us|ca|uk|es|de|fr|nl|ly|gl|link|site|online|travel|tours|store|shop|xyz|ws|tv|club";

const DIGIT_WORDS =
  "zero|oh|one|two|three|four|five|six|seven|eight|nine|cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve";

/** Emails and links go first, then phone numbers (below), then handles. Each match becomes HIDDEN. */
const FIRST: { kind: ContactKind; re: RegExp }[] = [
  // Emails, also "juan at gmail dot com", "juan (arroba) gmail (punto) com".
  { kind: "email", re: /[a-z0-9._%+-]+\s*(?:@|\(\s*at\s*\)|\[\s*at\s*\]|\bat\b|\barroba\b)\s*[a-z0-9-]+(?:\s*(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\bdot\b|\bpunto\b)\s*[a-z0-9-]+)*\s*(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\bdot\b|\bpunto\b)\s*(?:com|net|org|cr|es|co|io|me|us|ca|uk|de|fr)\b/gi },
  { kind: "email", re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi },
  // Email providers named on their own ("my gmail is juan.perez").
  { kind: "email", re: /\b(?:gmail|hotmail|yahoo|outlook|icloud|proton(?:mail)?|live\.com)\b(?:\s+(?:is|es|:|-)?\s*[a-z0-9._%+-]{3,})?/gi },
  // Links and bare domains: https://…, www.…, wa.me/…, t.me/…, something.com/…
  { kind: "link", re: /\b(?:https?:\/\/|www\.)\S+/gi },
  { kind: "link", re: /\b(?:wa\.me|t\.me|m\.me|bit\.ly|linktr\.ee)\/?\S*/gi },
  { kind: "link", re: new RegExp(`\\b[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})\\b(?:\\/\\S*)?`, "gi") },
  { kind: "link", re: /\b[a-z0-9-]+\s+(?:dot|punto)\s+(?:com|net|org|cr)\b/gi },
];
const AFTER_PHONES: { kind: ContactKind; re: RegExp }[] = [
  // "WhatsApp me: juan_cr", "mi insta es pura.vida.tours", "Telegram @juan", "fb: juanito".
  {
    kind: "handle",
    re: new RegExp(
      `\\b(?:${PLATFORMS})\\b[\\s:,-]*(?:(?:me|my|mi|is|es|at|en|al|on|as|como|user(?:name)?|usuario|handle|account|cuenta|name|nombre|id)\\b[\\s:,-]*){0,3}(?:@?[a-z0-9_]*[0-9_.][a-z0-9_.]{2,}|@[a-z0-9_.]{2,}|:\\s*[a-z0-9_.]{3,})`,
      "gi",
    ),
  },
  // @handles anywhere ("@juan.cr"), but not an email (already gone) or a lone "@".
  { kind: "handle", re: /(^|[\s(["'])@[a-z0-9_.]{2,}/gi },
];

// Runs of digits joined by spaces, dots, dashes, brackets, slashes, underscores or commas.
const DIGIT_RUN = /\+?\(?\d(?:[\s().\-_/,]*\d)+/g;
// Runs of digits mixed with written digits ("ocho ocho 8 8 …", "eight eight eight …").
const WORD_RUN = new RegExp(`(?:\\b(?:${DIGIT_WORDS})\\b|\\d+)(?:[\\s,.\\-/]+(?:\\b(?:${DIGIT_WORDS})\\b|\\d+))+`, "gi");

const DATE = /^\s*(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*$/;
const YEAR_RANGE = /^\s*(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\s*$/;

/** Hide phone-like digit runs (8+ digits once separators are removed), keeping dates and year ranges. */
function hidePhones(t: string, found: Set<ContactKind>): string {
  return t.replace(DIGIT_RUN, (run) => {
    const digits = run.replace(/\D/g, "");
    if (digits.length < 8) return run;
    if (DATE.test(run) || YEAR_RANGE.test(run)) return run;
    // Two dates side by side ("2026-11-22 2026-11-25") are not a phone either.
    const parts = run.trim().split(/\s+/);
    if (parts.length > 1 && parts.every((p) => DATE.test(p))) return run;
    found.add("phone");
    // Keep the space before the run so "call 8888 8888" reads "call [hidden]".
    return (/^\s/.test(run) ? " " : "") + HIDDEN;
  });
}

function hideWrittenPhones(t: string, found: Set<ContactKind>): string {
  return t.replace(WORD_RUN, (run) => {
    const tokens = run.split(/[\s,.\-/]+/).filter(Boolean);
    const words = tokens.filter((x) => !/^\d+$/.test(x)).length;
    const digits = tokens.reduce((n, x) => n + (/^\d+$/.test(x) ? x.length : 1), 0);
    // At least two written digits, so "2 adults, 1 child, 3 bags" style text is never touched.
    if (words < 2 || digits < 8) return run;
    found.add("phone");
    return HIDDEN;
  });
}

/** Replace contact details with HIDDEN. Safe on any input; never throws. */
export function hideContactDetails(raw: string): Filtered {
  const found = new Set<ContactKind>();
  const apply = (text: string, rules: { kind: ContactKind; re: RegExp }[]) =>
    rules.reduce(
      (acc, { kind, re }) =>
        acc.replace(re, (m: string, lead?: unknown) => {
          found.add(kind);
          // The @handle rule captures the character before the "@"; keep it.
          return (typeof lead === "string" && lead.length <= 1 && m.startsWith(lead) ? lead : "") + HIDDEN;
        }),
      text,
    );
  let t = apply(String(raw ?? ""), FIRST);
  t = hidePhones(t, found);
  t = apply(t, AFTER_PHONES);
  t = hideWrittenPhones(t, found);
  // "[hidden] [hidden]" → "[hidden]".
  const twice = new RegExp(`${escape(HIDDEN)}(?:[\\s,.;:/-]*${escape(HIDDEN)})+`, "g");
  t = t.replace(twice, HIDDEN);
  return { text: t, kinds: [...found] };
}

/** How a stored message reads for someone reading in Spanish. */
export function displayHidden(text: string, lang: "en" | "es"): string {
  return lang === "es" ? text.split(HIDDEN).join(HIDDEN_ES) : text;
}

/** The notice the sender sees when something was hidden. */
export function hiddenNotice(lang: "en" | "es"): string {
  return lang === "es"
    ? "Por su seguridad, los datos de contacto se ocultan. Use este chat o llame a nuestro equipo."
    : "For your safety, contact details are hidden. Use this chat or call our team.";
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
