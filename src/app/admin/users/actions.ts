"use server";

import { revalidatePath } from "next/cache";
import { requireRole, type Role } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ROLES: Role[] = ["client", "driver", "admin"];

export async function setUserRole(formData: FormData): Promise<void> {
  const me = await requireRole("admin", "/admin/users");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  if (!ROLES.includes(role) || !userId) return;
  // Don't let the last admin lock themselves out by accident.
  if (userId === me.id && role !== "admin") return;

  const supabase = (await createSupabaseServerClient())!;
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);

  if (role === "driver") {
    // New drivers get an empty KYC record in "pending" until their documents are checked.
    await supabase.from("drivers").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
  }
  revalidatePath("/admin/users");
}
