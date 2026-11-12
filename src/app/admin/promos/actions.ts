"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { parsePromoInput } from "@/lib/promo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = ["code", "description", "discount_type", "value", "applies_to", "min_order", "valid_from", "valid_to", "max_uses", "max_uses_per_email"];

/**
 * Create a promo code, or change one (`id` set). Saved with the admin's own session, so the
 * database's admin-only rule applies (migration 0052); who created it comes from the session.
 */
export async function savePromo(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    await requireRole("admin", "/admin/promos");
    const values = Object.fromEntries(FIELDS.map((f) => [f, String(fd.get(f) ?? "")]));
    const parsed = parsePromoInput(values);
    if (!parsed.ok) throw new InputError(t(parsed.es, parsed.en));
    const id = String(fd.get("id") ?? "");
    if (id && !UUID.test(id)) throw new InputError(t("Ese código ya no existe. Recargue la página.", "That code no longer exists. Reload the page."));
    const db = (await createSupabaseServerClient())!;
    const res = id
      ? await db.from("promo_codes").update(parsed.row).eq("id", id).select("id")
      : await db.from("promo_codes").insert({ ...parsed.row, active: true }).select("id");
    if (res.error) {
      if (res.error.code === "23505") throw new InputError(t(`Ya existe el código ${parsed.row.code}.`, `The code ${parsed.row.code} already exists.`));
      throw new Error(res.error.message);
    }
    if (!res.data?.length) throw new InputError(t("Ese código ya no existe. Recargue la página.", "That code no longer exists. Reload the page."));
    revalidatePath("/admin/promos");
  }, t("No se pudo guardar el código. Inténtelo de nuevo.", "Couldn't save the code. Please try again."));
}

/** Switch a code off (travellers can no longer use it; bookings that used it keep their discount) or back on. */
export async function setPromoActive(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    await requireRole("admin", "/admin/promos");
    const id = String(fd.get("id") ?? "");
    if (!UUID.test(id)) throw new InputError(t("Ese código ya no existe. Recargue la página.", "That code no longer exists. Reload the page."));
    const active = fd.get("active") === "true";
    const db = (await createSupabaseServerClient())!;
    const { data, error } = await db.from("promo_codes").update({ active }).eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new InputError(t("Ese código ya no existe. Recargue la página.", "That code no longer exists. Reload the page."));
    revalidatePath("/admin/promos");
  }, t("No se pudo cambiar el código. Inténtelo de nuevo.", "Couldn't change the code. Please try again."));
}
