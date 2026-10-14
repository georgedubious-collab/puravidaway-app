import "server-only";

/**
 * Transactional email through Resend (https://resend.com). Settings live in
 * Vercel, never in the code:
 *   RESEND_API_KEY      — the Resend API key (secret)
 *   EMAIL_FROM          — e.g. "PuraVidaWay <hello@yourdomain.com>" once the domain is
 *                         verified in Resend. Until then Resend only delivers from
 *                         onboarding@resend.dev to the Resend account's own address.
 *   ADMIN_NOTIFY_EMAIL  — where the team gets new requests and chat messages
 *   NEXT_PUBLIC_SITE_URL — the site's address, for links in emails
 * Without RESEND_API_KEY nothing is sent (logged instead), so the app works the same.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://puravidaway-app.vercel.app").replace(/\/$/, "");
export const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "";

export interface Email {
  to: string;
  subject: string;
  /** Plain paragraphs; the first link button is optional. */
  lines: string[];
  button?: { label: string; url: string };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function html(e: Email): string {
  const paras = e.lines.map((l) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#0f172a">${esc(l)}</p>`).join("");
  const btn = e.button
    ? `<p style="margin:22px 0"><a href="${esc(e.button.url)}" style="background:#022c22;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;display:inline-block">${esc(e.button.label)}</a></p>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:20px;font-weight:800;color:#022c22;margin:0 0 20px">PuraVidaWay</p>${paras}${btn}
<p style="font-size:12px;color:#64748b;margin-top:28px">PuraVidaWay · Private transfers and tours in Costa Rica</p></div>`;
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
        from: process.env.EMAIL_FROM || "PuraVidaWay <onboarding@resend.dev>",
        to: [e.to],
        subject: e.subject,
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
