/**
 * The HTML and plain-text body of every email we send (src/lib/email.ts sends them). Kept
 * without server-only imports so scripts can render a message to a file and look at it
 * (scripts/test-automations.mjs writes the new emails out).
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.costaricaprivatetransfers.com").replace(/\/$/, "");
/**
 * The logo in every email's header: a PNG served by the site (public/brand/logo-email.png,
 * 560 × 120 shown at 280 × 60), because Gmail and Outlook don't show SVG. If a mail
 * app blocks images, the alt text shows the name in the same dark green.
 */
export const EMAIL_LOGO_URL = `${SITE_URL}/brand/logo-email.png`;

export interface Email {
  to: string;
  subject: string;
  /** Plain paragraphs; the first link button is optional. */
  lines: string[];
  button?: { label: string; url: string };
  /** More links under the button, one per line (e.g. day tours in the follow-up email). */
  links?: { label: string; url: string }[];
  /** Where replies go (e.g. the traveller who used the contact form). */
  replyTo?: string;
  /** "es" for emails to travellers who booked in Spanish (footer line); everything else is English. */
  lang?: "en" | "es";
  /**
   * Promotional emails only (src/lib/promoEmail.ts): the small line at the bottom with the
   * unsubscribe link, and the one-click address for the mail app's own "Unsubscribe" button
   * (List-Unsubscribe headers). Booking emails never have it.
   */
  unsubscribe?: { note: string; label: string; pageUrl: string; oneClickUrl: string };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function emailHtml(e: Email): string {
  const paras = e.lines.map((l) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#0f172a">${esc(l)}</p>`).join("");
  const btn = e.button
    ? `<p style="margin:22px 0"><a href="${esc(e.button.url)}" style="background:#022c22;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;display:inline-block">${esc(e.button.label)}</a></p>`
    : "";
  const links = (e.links ?? [])
    .map((l) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.5"><a href="${esc(l.url)}" style="color:#047857;font-weight:700">${esc(l.label)}</a></p>`)
    .join("");
  const tagline = e.lang === "es" ? "Traslados y tours" : "Transfers and tours";
  const unsub = e.unsubscribe
    ? `<p style="font-size:12px;color:#64748b;margin:8px 0 0">${esc(e.unsubscribe.note)} <a href="${esc(e.unsubscribe.pageUrl)}" style="color:#64748b">${esc(e.unsubscribe.label)}</a></p>`
    : "";
  return `<div${e.lang === "es" ? ' lang="es"' : ""} style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px">
<p style="margin:0 0 20px"><a href="${SITE_URL}/" style="text-decoration:none"><img src="${EMAIL_LOGO_URL}" width="280" height="60" alt="Costa Rica Private Transfers" style="display:block;border:0;outline:none;height:60px;width:280px;max-width:100%;font-size:20px;font-weight:800;color:#022c22"></a></p>${paras}${btn}${links}
<p style="font-size:12px;color:#64748b;margin-top:28px">Costa Rica Private Transfers · ${tagline}</p>${unsub}</div>`;
}

export function emailText(e: Email): string {
  return [
    ...e.lines,
    e.button ? `${e.button.label}: ${e.button.url}` : "",
    ...(e.links ?? []).map((l) => `${l.label}: ${l.url}`),
    e.unsubscribe ? `${e.unsubscribe.note} ${e.unsubscribe.label}: ${e.unsubscribe.pageUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The mail app's own unsubscribe button (RFC 8058 one-click), for promotional emails only. */
export function emailHeaders(e: Email): Record<string, string> | undefined {
  if (!e.unsubscribe) return undefined;
  return {
    "List-Unsubscribe": `<${e.unsubscribe.oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
