"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendTeamAlert } from "@/lib/teamAlerts";
import { alertText, parsePrefsForm } from "@/lib/teamAlertRules";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { vapidFromEnv } from "@/lib/webPush";

/**
 * Team alerts on this phone (/admin/alerts). Each call checks the admin role again, and the
 * database checks it once more (register_admin_push / admin_alert_prefs RLS, migration 0053).
 */

const B64U = /^[A-Za-z0-9_-]+={0,2}$/;

export interface SubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  label: string;
}

export type PushActionResult = { ok: true; pushed?: number } | { ok: false; error: string };

/** Switch alerts on for this phone (or refresh its keys). */
export async function saveSubscription(sub: SubscriptionInput): Promise<PushActionResult> {
  const t = makeT(await getTeamLang());
  await requireRole("admin", "/admin/alerts");
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.p256dh ?? "");
  const auth = String(sub?.auth ?? "");
  let https = false;
  try {
    https = new URL(endpoint).protocol === "https:";
  } catch {
    https = false;
  }
  if (!https || endpoint.length > 1000 || !B64U.test(p256dh) || p256dh.length < 80 || p256dh.length > 100 || !B64U.test(auth) || auth.length < 16 || auth.length > 50) {
    return { ok: false, error: t("Este navegador devolvió una suscripción no válida.", "This browser returned an invalid subscription.") };
  }
  const label = String(sub?.label ?? "").replace(/[^\p{L}\p{N} ·.,()/-]/gu, "").slice(0, 80);
  const supabase = (await createSupabaseServerClient())!;
  const { error } = await supabase.rpc("register_admin_push", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_label: label });
  if (error) {
    console.error("[alerts] register", error.message);
    return { ok: false, error: t("No se pudo activar. Inténtelo de nuevo.", "Couldn't switch on. Please try again.") };
  }
  revalidatePath("/admin/alerts");
  return { ok: true };
}

/** Switch alerts off for this phone. */
export async function removeSubscription(endpoint: string): Promise<PushActionResult> {
  await requireRole("admin", "/admin/alerts");
  const supabase = (await createSupabaseServerClient())!;
  const { error } = await supabase.rpc("unregister_admin_push", { p_endpoint: String(endpoint ?? "").slice(0, 1000) });
  if (error) console.error("[alerts] unregister", error.message);
  revalidatePath("/admin/alerts");
  return { ok: true };
}

/** "Send a test": a push to the phones of the admin who pressed it, and nobody else. */
export async function sendTestAlert(): Promise<PushActionResult> {
  const t = makeT(await getTeamLang());
  const me = await requireRole("admin", "/admin/alerts");
  if (!vapidFromEnv()) {
    return { ok: false, error: t("Las alertas al teléfono aún no están configuradas (faltan las claves VAPID en Vercel).", "Phone alerts aren't set up yet (the VAPID keys are missing in Vercel).") };
  }
  const text = alertText("test", { ref: "", route: "", when: "" });
  const r = await sendTeamAlert("test", { push: { ...text, url: "/admin/alerts" }, onlyAdminId: me.id });
  if (!r.pushed) {
    return { ok: false, error: t("No llegó a ningún teléfono. Active las alertas en este teléfono primero.", "It didn't reach any phone. Switch alerts on for this phone first.") };
  }
  return { ok: true, pushed: r.pushed };
}

/** Which alerts this admin wants, and quiet hours. */
export async function saveAlertPrefs(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    const me = await requireRole("admin", "/admin/alerts");
    const p = parsePrefsForm(fd);
    const qs = String(fd.get("quiet_start") ?? "");
    const qe = String(fd.get("quiet_end") ?? "");
    if ((qs || qe) && p.quiet_start === null) {
      throw new InputError(t("Elija la hora de inicio y la de fin (distintas), o deje las dos vacías.", "Pick a start and an end hour (different), or leave both empty."));
    }
    const supabase = (await createSupabaseServerClient())!;
    const { error } = await supabase
      .from("admin_alert_prefs")
      .upsert({ admin_id: me.id, ...p, updated_at: new Date().toISOString() }, { onConflict: "admin_id" });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/alerts");
  }, t("No se pudo guardar. Inténtelo de nuevo.", "Couldn't save. Please try again."));
}
