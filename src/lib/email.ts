import "server-only";
import { emailHeaders, emailHtml, emailText, type Email } from "./emailHtml";

/**
 * Transactional email through Resend (https://resend.com). Settings live in
 * Vercel, never in the code:
 *   RESEND_API_KEY      — the Resend API key (secret)
 *   EMAIL_FROM          — e.g. "Costa Rica Private Transfers <hello@yourdomain.com>" once the domain is
 *                         verified in Resend. Until then Resend only delivers from
 *                         onboarding@resend.dev to the Resend account's own address.
 *   ADMIN_NOTIFY_EMAIL  — where the team gets new requests and chat messages
 *   NEXT_PUBLIC_SITE_URL — the site's address, for links in emails
 * Without RESEND_API_KEY nothing is sent (logged instead), so the app works the same.
 * The email's look (HTML) is built in ./emailHtml. Promotional emails go through
 * src/lib/promoEmail.ts, which checks the unsubscribe list first.
 */

export { EMAIL_LOGO_URL, SITE_URL, type Email } from "./emailHtml";
export const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "";

/** Send one email. Never throws: a failed email must not break a booking or a chat message. */
export async function sendEmail(e: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !e.to) {
    console.info("[email] not sent (no RESEND_API_KEY or recipient):", e.subject);
    return false;
  }
  try {
    const headers = emailHeaders(e);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Costa Rica Private Transfers <onboarding@resend.dev>",
        to: [e.to],
        subject: e.subject,
        ...(e.replyTo ? { reply_to: e.replyTo } : {}),
        ...(headers ? { headers } : {}),
        html: emailHtml(e),
        text: emailText(e),
      }),
    });
    if (!res.ok) console.error("[email] Resend error", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[email] failed", err);
    return false;
  }
}
