/**
 * Where the cookie banner is shown (docs/SEO.md §7.1, Jorge 2026-11-11): only to visitors in
 * the European Economic Area, the United Kingdom and Switzerland, where the law asks for a yes
 * before analytics cookies. Everyone else gets the measurement tools on by default and can
 * switch them off with "Cookie settings" in the footer.
 *
 * The country comes from Vercel's `x-vercel-ip-country` request header, read in src/proxy.ts,
 * which stores the result in a small first-party cookie so the pages themselves stay static.
 * No country (local runs, header missing) or an unreadable one counts as "consent": the safe
 * side. No browser or server-only code here: the proxy, the browser and the test read it.
 */

/** First-party cookie written by src/proxy.ts and read by the cookie banner. */
export const REGION_COOKIE = "crpt-region";
/** How long the region cookie lasts; it is refreshed whenever the answer changes. */
export const REGION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** "consent" = ask first (banner, nothing loads before Accept); "open" = on by default, opt-out. */
export type ConsentRegion = "consent" | "open";

/** ISO 3166-1 alpha-2 codes where consent is asked first. */
export const CONSENT_COUNTRIES: ReadonlySet<string> = new Set([
  // European Union (27)
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV",
  "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // Rest of the European Economic Area
  "IS", "LI", "NO",
  // United Kingdom and Switzerland
  "GB", "CH",
  // Parts of the EU that have their own country code (French overseas regions, Åland), and
  // places under UK-style data protection law (Gibraltar, Jersey, Guernsey, Isle of Man).
  // Kept on the safe side: they see the banner too.
  "GF", "GP", "MQ", "RE", "YT", "MF", "AX", "GI", "JE", "GG", "IM",
]);

/** Placeholder codes some geo databases use for "unknown", Tor, proxies or "somewhere in Europe". */
const NOT_A_COUNTRY = new Set(["XX", "ZZ", "T1", "A1", "A2", "O1", "EU", "AP"]);

/** The region for a country code from Vercel's header; unknown or missing → "consent". */
export function regionForCountry(country: string | null | undefined): ConsentRegion {
  const code = (country ?? "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]$/.test(code) || NOT_A_COUNTRY.has(code)) return "consent";
  return CONSENT_COUNTRIES.has(code) ? "consent" : "open";
}

/** A region cookie value as the banner reads it: anything but exactly "open" is "consent". */
export function parseRegion(value: string | null | undefined): ConsentRegion {
  return value === "open" ? "open" : "consent";
}
