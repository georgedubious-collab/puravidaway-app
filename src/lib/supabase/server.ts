import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * The Supabase session token sent by the mobile apps ("Authorization: Bearer <JWT>"),
 * or null for a browser request (which uses cookies). Only real JWTs match, so the
 * shared secrets used by the cron and revalidate routes are never mistaken for one.
 */
export async function bearerToken(): Promise<string | null> {
  const auth = (await headers()).get("authorization") ?? "";
  return auth.match(/^Bearer (eyJ[\w-]+\.[\w-]+\.[\w-]+)$/)?.[1] ?? null;
}

/**
 * Supabase client for Server Components, Server Actions and Route Handlers,
 * acting as the logged-in user (row-level security applies). Browsers are
 * identified by their session cookies, the mobile apps by their bearer token
 * (the same Supabase session, sent as a header on /api/v1 calls).
 */
export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured) return null;
  const token = await bearerToken();
  if (token) {
    return createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // The proxy (src/proxy.ts) refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Logged-out client for public data (catalog). No cookies, so pages that use
 * it can still be cached.
 */
export function createSupabasePublicClient() {
  if (!isSupabaseConfigured) return null;
  return createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
