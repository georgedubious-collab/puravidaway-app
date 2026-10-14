"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { todayInCostaRica } from "@/lib/dates";
import { CRIMINAL_RECORD_MAX_AGE_DAYS, criminalRecordTooOld, missingDriverDocs } from "@/lib/driverKyc";
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

    if (decision === "approve") {
      const cur = await supabase
        .from("drivers")
        .select("kyc_status, criminal_record_date, license_expiry, documents")
        .eq("id", id)
        .single();
      if (cur.error) throw new InputError("Driver not found.");
      const today = todayInCostaRica();
      const missing = missingDriverDocs({ documents: (cur.data.documents ?? {}) as Record<string, string> });
      if (missing.length) throw new InputError(`Still missing: ${missing.map((m) => m.label).join(", ")}.`);
      if (!cur.data.license_expiry || cur.data.license_expiry < today) {
        throw new InputError("The driver's licence is missing or expired.");
      }
      // First approval: the hoja de delincuencia must be recent.
      if (cur.data.kyc_status !== "approved" && cur.data.kyc_status !== "suspended") {
        const issued = cur.data.criminal_record_date as string | null;
        if (!issued || criminalRecordTooOld(issued, today)) {
          throw new InputError(
            `The criminal record certificate must be issued no more than ${CRIMINAL_RECORD_MAX_AGE_DAYS} days ago. Ask the driver for a new one.`,
          );
        }
      }
    }

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

/** Approve / reject / suspend one vehicle, or mark its recent changes as checked. */
export async function reviewVehicle(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireRole("admin", "/admin/drivers");
    const id = String(fd.get("vehicle_id") ?? "");
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
            status: decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "suspended",
            note,
          };
    const v = await supabase.from("driver_vehicles").update(patch).eq("id", id).select("driver_id");
    if (v.error) throw v.error;
    if (!v.data?.length) throw new InputError("Vehicle not found.");
    revalidatePath("/admin/drivers");
    revalidatePath(`/admin/drivers/${v.data[0].driver_id}`);
    revalidatePath("/admin");
  }, "Couldn't save the decision. Please try again.");
}
