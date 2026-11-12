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
    // Prices and tours are public, so a traveller who isn't signed in can still plan a trip;
    // the server refuses the calls that need a signed-in email.
    const token = data.session?.access_token;
    const res = await fetch(SITE_URL + "/api/v1" + path, {
      method: body ? "POST" : "GET",
      headers: { ...(token ? { Authorization: "Bearer " + token } : {}), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
    if (!json) return { ok: false, error: "We couldn't reach the server. Check your connection." };
    // A refusal keeps its other fields too (e.g. promoInvalid on a trip request).
    return json.ok ? { ok: true, data: json } : { ok: false, error: json.error ?? "Something went wrong.", data: json };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Check your connection." };
  }
}
