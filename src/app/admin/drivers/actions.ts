"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DECISIONS = ["approve", "reject", "suspend", "checked"] as const;
type Decision = (typeof DECISIONS)[number];

/**
 * Approve / reject / suspend a driver, or mark recent changes as checked.
 * Approving also gives the account the "driver" role, so the admin never has
 * to visit Users & roles for it.
 */
export async function reviewDriver(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireRole("admin", "/admin/drivers");
    const id = String(fd.get("id") ?? "");
    const decision = String(fd.get("decision") ?? "") as Decision;
    const note = String(fd.get("note") ?? "").trim().slice(0, 500) || null;
    if (!id || !DECISIONS.includes(decision)) throw new InputError("Pick a decision.");
    if ((decision === "reject" || decision === "suspend") && !note) {
      throw new InputError("Add a short message for the driver explaining why.");
    }

    const supabase = (await createSupabaseServerClient())!;
    const review = { needs_review: false, reviewed_at: new Date().toISOString(), reviewed_by: me.id };
    const patch =
      decision === "checked"
        ? review
        : {
            ...review,
            kyc_status: decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "suspended",
            kyc_note: note,
          };

    const d = await supabase.from("drivers").update(patch).eq("id", id).select("id");
    if (d.error) throw d.error;
    if (!d.data?.length) throw new InputError("Driver not found.");

    if (decision === "approve") {
      // Admins keep their admin role; everyone else becomes a driver.
      const p = await supabase.from("profiles").update({ role: "driver" }).eq("id", id).neq("role", "admin");
      if (p.error) throw p.error;
    }
    revalidatePath("/admin/drivers");
    revalidatePath(`/admin/drivers/${id}`);
    revalidatePath("/admin");
  }, "Couldn't save the decision. Please try again.");
}
