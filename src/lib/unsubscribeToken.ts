/**
 * The signed unsubscribe link in promotional emails (docs/PROJECT.md §4.7). The token is the
 * email address plus a signature made with a server secret, so a link only works for the
 * address it was sent to and can't be changed into another address. It never expires (an old
 * email's link must keep working). Plain TypeScript without server-only imports so
 * scripts/test-automations.mjs runs it with Node; the secret is passed in by the caller
 * (src/lib/promoEmail.ts).
 *
 *   token = base64url(email) + "." + base64url(HMAC-SHA256(secret, "unsubscribe:v1:" + email))
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Secrets shorter than this are treated as missing (no promotional emails are sent then). */
export const MIN_SECRET_LENGTH = 16;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function sign(email: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`unsubscribe:v1:${email}`).digest();
}

export function makeUnsubscribeToken(email: string, secret: string): string {
  const clean = normalizeEmail(email);
  if (!clean || secret.length < MIN_SECRET_LENGTH) throw new Error("Unsubscribe links need an email and a secret.");
  return `${Buffer.from(clean).toString("base64url")}.${sign(clean, secret).toString("base64url")}`;
}

/** The email address a token was made for, or null when the token is missing, malformed or altered. */
export function readUnsubscribeToken(token: unknown, secret: string): string | null {
  if (typeof token !== "string" || token.length > 1200 || secret.length < MIN_SECRET_LENGTH) return null;
  const m = /^([A-Za-z0-9_-]{2,800})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m) return null;
  const email = Buffer.from(m[1], "base64url").toString("utf8");
  // Only what makeUnsubscribeToken could have produced.
  if (email !== normalizeEmail(email) || !/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 320) return null;
  const given = Buffer.from(m[2], "base64url");
  const expected = sign(email, secret);
  return given.length === expected.length && timingSafeEqual(given, expected) ? email : null;
}
