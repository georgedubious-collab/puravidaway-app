import "server-only";
import { headers } from "next/headers";
import { SITE_URL } from "./site";

/**
 * The site the visitor is on (a Vercel preview, the live site, or localhost), so Stripe sends
 * them back to the same one after paying. Anything odd falls back to the live site.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return SITE_URL;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto === "http" ? "http" : "https"}://${host}`;
}
