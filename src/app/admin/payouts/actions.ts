"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mark a driver's listed completed trips as settled (paid out, or cash balance received). */
export async function settleDriver(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    await requireRole("admin", "/admin/payouts");
    const driverId = String(fd.get("driver_id") ?? "");
    const ids = String(fd.get("booking_ids") ?? "").split(",").filter((x) => UUID.test(x));
    if (!UUID.test(driverId) || ids.length === 0) throw new InputError(t("No hay nada que liquidar.", "Nothing to settle."));
    if (fd.get("confirm") !== "on")
      throw new InputError(
        t("Marque la casilla para confirmar que el dinero ya se entregó.", "Tick the box to confirm the money has changed hands."),
      );
    const supabase = (await createSupabaseServerClient())!;
    const { data, error } = await supabase
      .from("bookings")
      .update({ driver_settled_at: new Date().toISOString() })
      .in("id", ids)
      .eq("assigned_driver_id", driverId)
      .eq("status", "completed")
      .is("driver_settled_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length)
      throw new InputError(t("Esos viajes ya estaban liquidados. Recargue la página.", "Those trips were already settled. Reload the page."));
    revalidatePath("/admin/payouts");
  }, t("No se pudieron marcar los viajes como liquidados. Inténtelo de nuevo.", "Couldn't mark the trips settled. Please try again."));
}
