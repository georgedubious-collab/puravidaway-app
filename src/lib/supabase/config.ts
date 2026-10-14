/**
 * Supabase connection settings. Until Jorge adds the keys in Vercel
 * (docs/SETUP-SUPABASE.md), the storefront uses the built-in catalog and
 * /login and /admin show a "not connected yet" notice instead of crashing.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
