import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "./supabase/server";

export type Role = "client" | "driver" | "admin";

export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

/** The logged-in user's profile, or null when logged out / Supabase not set up. */
export async function getCurrentProfile(): Promise<Profile | null> {
  // Always per request: who is logged in must never be baked in at build time.
  await connection();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, phone")
    .eq("id", user.id)
    .single();
  return (data as Profile | null) ?? null;
}

/**
 * Use at the top of every admin page and admin Server Action.
 * Logged out → login page. Logged in without the role → login page with a
 * "this account doesn't have access" message (so Jorge can switch accounts).
 */
export async function requireRole(role: Role, nextPath = "/admin"): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (profile.role !== role) redirect(`/login?denied=1&next=${encodeURIComponent(nextPath)}`);
  return profile;
}
