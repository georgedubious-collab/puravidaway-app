import "server-only";

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
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.costaricaprivatetransfers.com").replace(/\/$/, "");
export const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "";
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
  /** Where replies go (e.g. the traveller who used the contact form). */
  replyTo?: string;
  /** "es" for emails to travellers who booked in Spanish (footer line); everything else is English. */
  lang?: "en" | "es";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function html(e: Email): string {
  const paras = e.lines.map((l) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#0f172a">${esc(l)}</p>`).join("");
  const btn = e.button
    ? `<p style="margin:22px 0"><a href="${esc(e.button.url)}" style="background:#022c22;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;display:inline-block">${esc(e.button.label)}</a></p>`
    : "";
  const tagline = e.lang === "es" ? "Traslados, tours y expediciones" : "Transfers, tours and expeditions";
  return `<div${e.lang === "es" ? ' lang="es"' : ""} style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px">
<p style="margin:0 0 20px"><a href="${SITE_URL}/" style="text-decoration:none"><img src="${EMAIL_LOGO_URL}" width="280" height="60" alt="Costa Rica Private Transfers" style="display:block;border:0;outline:none;height:60px;width:280px;max-width:100%;font-size:20px;font-weight:800;color:#022c22"></a></p>${paras}${btn}
<p style="font-size:12px;color:#64748b;margin-top:28px">Costa Rica Private Transfers · ${tagline}</p></div>`;
}

/** Send one email. Never throws: a failed email must not break a booking or a chat message. */
export async function sendEmail(e: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !e.to) {
    console.info("[email] not sent (no RESEND_API_KEY or recipient):", e.subject);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Costa Rica Private Transfers <onboarding@resend.dev>",
        to: [e.to],
        subject: e.subject,
        ...(e.replyTo ? { reply_to: e.replyTo } : {}),
        html: html(e),
        text: [...e.lines, e.button ? `${e.button.label}: ${e.button.url}` : ""].filter(Boolean).join("\n\n"),
      }),
    });
    if (!res.ok) console.error("[email] Resend error", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[email] failed", err);
    return false;
  }
}
