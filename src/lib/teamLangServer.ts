import { cookies, headers } from "next/headers";
import { DEFAULT_TEAM_LANG, TEAM_LANG_COOKIE, parseTeamLang, type TeamLang } from "@/lib/teamLang";

/**
 * The team / driver language for this request (server only).
 *
 * - Website: the `team_lang` cookie set by the ES | EN switch; Spanish when unset.
 * - Mobile apps (/api/v1, bearer token, no cookie): the `x-team-lang` header if the
 *   app sends one, otherwise English, so messages the apps already show don't change.
 */
export async function getTeamLang(): Promise<TeamLang> {
  const fromCookie = parseTeamLang((await cookies()).get(TEAM_LANG_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  const h = await headers();
  const fromHeader = parseTeamLang(h.get("x-team-lang"));
  if (fromHeader) return fromHeader;
  if (/^Bearer /.test(h.get("authorization") ?? "")) return "en";
  return DEFAULT_TEAM_LANG;
}
