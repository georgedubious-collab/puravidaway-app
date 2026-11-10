"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mark one flagged message as reviewed (it moves to "Reviewed"). Admins only (RLS too). */
export async function reviewFlag(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    const me = await requireRole("admin", "/admin/flagged");
    const id = String(fd.get("flag_id") ?? "");
    if (!UUID.test(id)) throw new InputError(t("Mensaje no encontrado.", "Message not found."));
    const supabase = (await createSupabaseServerClient())!;
    const { error } = await supabase
      .from("contact_flags")
      .update({ reviewed_at: new Date().toISOString(), reviewed_by: me.id })
      .eq("id", id)
      .is("reviewed_at", null);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/flagged");
  }, t("No se pudo marcar como revisado. Inténtelo de nuevo.", "Couldn't mark it reviewed. Please try again."));
}
