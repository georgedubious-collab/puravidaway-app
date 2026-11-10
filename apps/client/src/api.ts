import { SITE_URL } from "./config";
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
    if (!token) return { ok: false, error: "Please sign in again." };
    const res = await fetch(SITE_URL + "/api/v1" + path, {
      method: body ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
    if (!json) return { ok: false, error: "We couldn't reach the server. Check your connection." };
    return json.ok ? { ok: true, data: json } : { ok: false, error: json.error ?? "Something went wrong." };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Check your connection." };
  }
}
