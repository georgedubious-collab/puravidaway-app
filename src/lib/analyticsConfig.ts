/**
 * Marketing measurement settings (docs/SEO.md §7). Everything is OFF unless its
 * variable is set in Vercel (Production only), so previews and local builds stay clean.
 *
 * - NEXT_PUBLIC_GA_ID               Google Analytics 4 measurement id, "G-XXXXXXXXXX"
 * - NEXT_PUBLIC_CLARITY_ID          Microsoft Clarity project id (optional)
 * - NEXT_PUBLIC_GOOGLE_ADS_ID       Google Ads tag id, "AW-123456789" (optional, for later ads)
 * - NEXT_PUBLIC_META_PIXEL_ID       Meta (Facebook / Instagram) pixel id (optional, for later ads)
 * - NEXT_PUBLIC_GSC_VERIFICATION    Google Search Console "HTML tag" token (fallback to DNS)
 * - NEXT_PUBLIC_BING_VERIFICATION   Bing Webmaster Tools "msvalidate.01" token
 *
 * These ids are public by nature (they appear in every page of any site that
 * uses them), but they still come from the environment, never from the code.
 * A value in the wrong format is ignored instead of being put into a script.
 *
 * This file has no browser code: the server (page metadata) and the browser
 * (src/lib/analytics.ts) both read it.
 */
import { PRIVATE_PATHS } from "./site";

function clean(value: string | undefined, format: RegExp): string | null {
  const v = (value ?? "").trim();
  return format.test(v) ? v : null;
}

// Each variable must be written out in full: Next.js only passes NEXT_PUBLIC_
// values to the browser when it can see the exact name in the code.
export const GA_ID = clean(process.env.NEXT_PUBLIC_GA_ID, /^G-[A-Z0-9]{6,16}$/);
export const CLARITY_ID = clean(process.env.NEXT_PUBLIC_CLARITY_ID, /^[a-z0-9]{8,16}$/);
export const GOOGLE_ADS_ID = clean(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID, /^AW-[0-9]{8,14}$/);
export const META_PIXEL_ID = clean(process.env.NEXT_PUBLIC_META_PIXEL_ID, /^[0-9]{10,20}$/);
export const GSC_VERIFICATION = clean(process.env.NEXT_PUBLIC_GSC_VERIFICATION, /^[A-Za-z0-9_-]{20,100}$/);
export const BING_VERIFICATION = clean(process.env.NEXT_PUBLIC_BING_VERIFICATION, /^[A-Fa-f0-9]{32}$/);

/** Tools in the "Analytics" group of the cookie banner. */
export const HAS_ANALYTICS_TOOLS = Boolean(GA_ID || CLARITY_ID);
/** Tools in the "Advertising" group; the banner shows that row only when one is set. */
export const HAS_ADS_TOOLS = Boolean(GOOGLE_ADS_ID || META_PIXEL_ID);
/** No banner, no footer link and no scripts at all unless at least one tool is set. */
export const HAS_CONSENT_TOOLS = HAS_ANALYTICS_TOOLS || HAS_ADS_TOOLS;

/**
 * Private areas (admin, driver portal, the traveller's trip page with its secret
 * link, sign-in): never a cookie banner and never an analytics script there.
 */
const NO_TRACKING_PATHS = [...PRIVATE_PATHS, "/account", "/chat"];

export function isPrivatePath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return NO_TRACKING_PATHS.some((base) => p === base || p.startsWith(`${base}/`));
}

/** How long a cookie choice is remembered before we ask again. */
export const CONSENT_MAX_AGE_DAYS = 183;
