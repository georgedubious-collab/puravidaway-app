"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { NOTE_MAX, cleanTags, customerHref, parseCustomerKey } from "@/lib/customers";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

/**
 * Save a customer's tags and private team note (customer_notes, admins only by RLS). Who changed it
 * and when are set by the database, and each change is kept in customer_note_events.
 */
export async function saveCustomerNote(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    await requireRole("admin", "/admin/customers");
    const key = parseCustomerKey(String(fd.get("key") ?? ""));
    if (!key) throw new InputError(t("No se encontró el cliente.", "Customer not found."));
    const tags = cleanTags(String(fd.get("tags") ?? ""));
    if (fd.get("vip") === "on" && !tags.some((x) => x.toLowerCase() === "vip")) tags.unshift("VIP");
    const finalTags = fd.get("vip") === "on" ? tags : tags.filter((x) => x.toLowerCase() !== "vip");
    const note = String(fd.get("note") ?? "").trim();
    if (note.length > NOTE_MAX) throw new InputError(t(`La nota puede tener hasta ${NOTE_MAX} caracteres.`, `The note can be up to ${NOTE_MAX} characters.`));
    const db = (await createSupabaseServerClient())!;
    const { error } = await db.from("customer_notes").upsert({ customer_key: key, tags: finalTags.slice(0, 12), note });
    if (error) throw error;
    revalidatePath(customerHref(key));
    revalidatePath("/admin/customers/[key]", "page");
    revalidatePath("/admin/customers");
  }, t("No se pudo guardar. Inténtelo de nuevo.", "Couldn't save. Please try again."));
}
