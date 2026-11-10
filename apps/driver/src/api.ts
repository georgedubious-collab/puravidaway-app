import { SITE_URL } from "./config";
import { currentLang, tr } from "./i18n";
import { supabase } from "./supabase";

/**
 * Calls to the website's /api/v1 for what the server must do itself (emails,
 * push, rating requests, chat). The driver's Supabase session goes along as a
 * bearer token. Returns { ok, error } and never throws.
 */
export interface ApiResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

export async function api<T = unknown>(path: string, body?: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: tr("Vuelva a iniciar sesión.", "Please sign in again.") };
    const res = await fetch(SITE_URL + "/api/v1" + path, {
      method: body ? "POST" : "GET",
      // x-team-lang: the website answers driver actions in the app's language (English without it).
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "x-team-lang": currentLang() },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
    if (!json) return { ok: false, error: offline() };
    return json.ok ? { ok: true, data: json } : { ok: false, error: json.error ?? tr("Algo salió mal.", "Something went wrong.") };
  } catch {
    return { ok: false, error: offline() };
  }
}

const offline = () => tr("No pudimos conectar con el servidor. Revise su conexión.", "We couldn't reach the server. Check your connection.");
