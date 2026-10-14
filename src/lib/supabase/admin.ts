import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Server-only client with the service role ("secret") key. It skips row-level
 * security, so use it only for writes that must never come from the browser
 * (saving a priced booking). The key lives in Vercel as SUPABASE_SERVICE_ROLE_KEY
 * and is never sent to the browser (no NEXT_PUBLIC_ prefix).
 * Returns null until that key is set; callers fall back to WhatsApp.
 */
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
