/**
 * Language of the team pages (/admin) and the driver portal (/driver):
 * Spanish by default, English on request (Jorge, 2026-11-09). The public
 * website, emails and legal pages stay in English.
 *
 * This file has no server-only imports, so client components can use it too.
 * The server reads the choice with getTeamLang() in src/lib/teamLangServer.ts.
 */

export type TeamLang = "es" | "en";

export const TEAM_LANG_COOKIE = "team_lang";
export const DEFAULT_TEAM_LANG: TeamLang = "es";

export function parseTeamLang(v: string | null | undefined): TeamLang | null {
  return v === "es" || v === "en" ? v : null;
}

/** Pick the Spanish or English text. */
export function tr(lang: TeamLang, es: string, en: string): string {
  return lang === "en" ? en : es;
}

/** `const t = makeT(lang); t("Guardar", "Save")`. */
export function makeT(lang: TeamLang): (es: string, en: string) => string {
  return (es, en) => (lang === "en" ? en : es);
}

/** Locale for dates and numbers on these pages. */
export function teamLocale(lang: TeamLang): string {
  return lang === "en" ? "en-US" : "es-CR";
}
