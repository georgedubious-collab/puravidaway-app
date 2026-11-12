"use server";

import { redirect } from "next/navigation";
import { emailFromUnsubscribeToken, optBackIn, optOut } from "@/lib/promoEmail";

/**
 * The two buttons on /unsubscribe. The signed token (src/lib/unsubscribeToken.ts) proves which
 * address it is; nothing else is accepted. Only promotional emails stop; booking emails don't.
 */
function back(token: string, lang: string, state: "out" | "in" | "error"): never {
  const q = new URLSearchParams({ t: token, done: state });
  if (lang === "es") q.set("lang", "es");
  redirect(`/unsubscribe?${q.toString()}`);
}

export async function unsubscribe(fd: FormData): Promise<void> {
  const token = String(fd.get("t") ?? "");
  const lang = String(fd.get("lang") ?? "");
  const email = emailFromUnsubscribeToken(token);
  if (!email) back("", lang, "error");
  back(token, lang, (await optOut(email, "link")) ? "out" : "error");
}

export async function resubscribe(fd: FormData): Promise<void> {
  const token = String(fd.get("t") ?? "");
  const lang = String(fd.get("lang") ?? "");
  const email = emailFromUnsubscribeToken(token);
  if (!email) back("", lang, "error");
  back(token, lang, (await optBackIn(email)) ? "in" : "error");
}
