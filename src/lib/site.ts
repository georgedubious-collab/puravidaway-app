/**
 * Site-wide settings for search engines and link previews.
 *
 * - NEXT_PUBLIC_SITE_URL: the public address (no trailing slash), used for
 *   canonical links, the sitemap and link-preview images.
 * - NEXT_PUBLIC_SITE_INDEXABLE: pre-launch switch. Search engines are told to
 *   stay away unless this is exactly "true". Set it only on Production in Vercel.
 */
const DEFAULT_SITE_URL = "https://www.costaricaprivatetransfers.com";

function resolveSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^\s/]+/.test(raw) ? raw : DEFAULT_SITE_URL;
}

export const SITE_URL = resolveSiteUrl();
export const SITE_INDEXABLE = process.env.NEXT_PUBLIC_SITE_INDEXABLE === "true";

export const SITE_NAME = "Costa Rica Private Transfers";
export const SITE_TITLE = "Costa Rica Private Transfers — Airport Transfers, Sightseeing & Tours";
export const SITE_TAGLINE = "Private Costa Rica transfers with sightseeing stops";
export const SITE_DESCRIPTION =
  "Private door-to-door transfers with sightseeing stops, driver bidding and 1-day private tours across Costa Rica.";

/** Private areas that search engines should never crawl. */
export const PRIVATE_PATHS = ["/admin", "/driver", "/trip", "/login", "/auth", "/api"];

/** Public legal pages (added in a separate PR; listed here so the sitemap includes them). */
export const LEGAL_PATHS = ["/terms", "/privacy", "/cancellation"];

/** Public contact address shown on the site and in structured data. Never a personal address. */
export const CONTACT_EMAIL = "hello@costaricaprivatetransfers.com";

/** Public info pages in English (each also has a Spanish version, see src/lib/publicLang.ts). */
export const INFO_PATHS = ["/about", "/how-it-works", "/our-drivers", "/faq", "/contact"];
