"use server";

import { cookies } from "next/headers";
import { TEAM_LANG_COOKIE, parseTeamLang } from "@/lib/teamLang";

/** Remember the ES | EN choice for the team pages and driver portal for a year. */
export async function setTeamLang(fd: FormData): Promise<void> {
  const lang = parseTeamLang(String(fd.get("lang") ?? ""));
  if (!lang) return;
  (await cookies()).set(TEAM_LANG_COOKIE, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
}
