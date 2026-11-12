"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { todayInCostaRica } from "@/lib/dates";
import { CRIMINAL_RECORD_MAX_AGE_DAYS, criminalRecordTooOld, docLabel, missingDriverDocs } from "@/lib/driverKyc";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { categoryLabel, isVehicleCategory } from "@/lib/vehicleEligibility";
import { driverDecisionNotice, firstCategoryNotice, vehicleDecisionNotice } from "@/lib/driverReviewNotices";
import { notifyDriver } from "@/lib/driverReviewSend";

/** "Toyota Hiace (ABC-123)" for the driver's own notice. */
function vehicleText(v: { make_model?: string | null; plate?: string | null } | null): string {
  const name = (v?.make_model ?? "").trim();
  const plate = (v?.plate ?? "").trim();
  return name ? (plate ? `${name} (${plate})` : name) : plate || "—";
}

const DECISIONS = ["approve", "reject", "suspend", "checked"] as const;
type Decision = (typeof DECISIONS)[number];

/**
 * Approve / reject / suspend a driver, or mark recent changes as checked.
 * Approving also gives the account the "driver" role, so the admin never has
 * to visit Users & roles for it.
 */
export async function reviewDriver(_prev: FormState, fd: FormData): Promise<FormState> {
  const lang = await getTeamLang();
  const t = makeT(lang);
  return runAction(async () => {
    const me = await requireRole("admin", "/admin/drivers");
    const id = String(fd.get("id") ?? "");
    const decision = String(fd.get("decision") ?? "") as Decision;
    const note = String(fd.get("note") ?? "").trim().slice(0, 500) || null;
    if (!id || !DECISIONS.includes(decision)) throw new InputError(t("Elija una decisión.", "Pick a decision."));
    if ((decision === "reject" || decision === "suspend") && !note) {
      throw new InputError(t("Agregue un mensaje corto para el conductor explicando el motivo.", "Add a short message for the driver explaining why."));
    }

    const supabase = (await createSupabaseServerClient())!;
    // Status before the decision: the driver is told only when it actually changes.
    const { data: prior } = await supabase.from("drivers").select("kyc_status").eq("id", id).maybeSingle();

    if (decision === "approve") {
      const cur = await supabase
        .from("drivers")
        .select("kyc_status, criminal_record_date, license_expiry, documents")
        .eq("id", id)
        .single();
      if (cur.error) throw new InputError(t("No se encontró el conductor.", "Driver not found."));
      const today = todayInCostaRica();
      const missing = missingDriverDocs({ documents: (cur.data.documents ?? {}) as Record<string, string> });
      if (missing.length)
        throw new InputError(`${t("Todavía falta", "Still missing")}: ${missing.map((m) => docLabel(m, lang)).join(", ")}.`);
      if (!cur.data.license_expiry || cur.data.license_expiry < today) {
        throw new InputError(t("Falta la licencia de conducir o está vencida.", "The driver's licence is missing or expired."));
      }
      // First approval: the hoja de delincuencia must be recent.
      if (cur.data.kyc_status !== "approved" && cur.data.kyc_status !== "suspended") {
        const issued = cur.data.criminal_record_date as string | null;
        if (!issued || criminalRecordTooOld(issued, today)) {
          throw new InputError(
            t(
              `La hoja de delincuencia debe tener como máximo ${CRIMINAL_RECORD_MAX_AGE_DAYS} días de emitida. Pídale una nueva al conductor.`,
              `The criminal record certificate must be issued no more than ${CRIMINAL_RECORD_MAX_AGE_DAYS} days ago. Ask the driver for a new one.`,
            ),
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
    if (!d.data?.length) throw new InputError(t("No se encontró el conductor.", "Driver not found."));

    if (decision === "approve") {
      // Admins keep their admin role; everyone else becomes a driver.
      const p = await supabase.from("profiles").update({ role: "driver" }).eq("id", id).neq("role", "admin");
      if (p.error) throw p.error;
    }
    await notifyDriver(supabase, id, driverDecisionNotice((prior?.kyc_status as string | undefined) ?? null, decision, note));
    revalidatePath("/admin/drivers");
    revalidatePath(`/admin/drivers/${id}`);
    revalidatePath("/admin");
  }, t("No se pudo guardar la decisión. Intente de nuevo.", "Couldn't save the decision. Please try again."));
}

/** Approve / reject / suspend one vehicle, or mark its recent changes as checked. */
export async function reviewVehicle(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    const me = await requireRole("admin", "/admin/drivers");
    const id = String(fd.get("vehicle_id") ?? "");
    const decision = String(fd.get("decision") ?? "") as Decision;
    const note = String(fd.get("note") ?? "").trim().slice(0, 500) || null;
    if (!id || !DECISIONS.includes(decision)) throw new InputError(t("Elija una decisión.", "Pick a decision."));
    if ((decision === "reject" || decision === "suspend") && !note) {
      throw new InputError(t("Agregue un mensaje corto para el conductor explicando el motivo.", "Add a short message for the driver explaining why."));
    }
    const supabase = (await createSupabaseServerClient())!;
    const { data: prior } = await supabase.from("driver_vehicles").select("status, make_model, plate").eq("id", id).maybeSingle();
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
    if (!v.data?.length) throw new InputError(t("No se encontró el vehículo.", "Vehicle not found."));
    await notifyDriver(
      supabase,
      v.data[0].driver_id as string,
      vehicleDecisionNotice((prior?.status as string | undefined) ?? null, decision, vehicleText(prior), note),
    );
    revalidatePath("/admin/drivers");
    revalidatePath(`/admin/drivers/${v.data[0].driver_id}`);
    revalidatePath("/admin");
  }, t("No se pudo guardar la decisión. Intente de nuevo.", "Couldn't save the decision. Please try again."));
}

/**
 * Set (or clear) a vehicle's category: it decides which jobs the driver receives
 * (src/lib/vehicleEligibility.ts). Only the team can; the database ignores a
 * driver's own attempt (migration 0038). Does not change the approval.
 * The same form carries the "electric vehicle" mark (migration 0042): not a
 * category and no price change, only a badge and a match for the free request.
 */
export async function setVehicleCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    await requireRole("admin", "/admin/drivers");
    const id = String(fd.get("vehicle_id") ?? "");
    const raw = String(fd.get("vehicle_class") ?? "");
    if (!id || (raw !== "" && !isVehicleCategory(raw))) throw new InputError(t("Elija una categoría.", "Pick a category."));
    const supabase = (await createSupabaseServerClient())!;
    const vehicle_class = raw === "" ? null : raw;
    const { data: prior } = await supabase.from("driver_vehicles").select("vehicle_class, make_model, plate").eq("id", id).maybeSingle();
    let v = await supabase
      .from("driver_vehicles")
      .update({ vehicle_class, is_electric: fd.get("is_electric") === "on" })
      .eq("id", id)
      .select("driver_id");
    // Safety net for the minutes between a deploy and its database update (migration 0042):
    // the category still saves while the electric mark's column isn't there yet.
    if (v.error && /is_electric/.test(v.error.message))
      v = await supabase.from("driver_vehicles").update({ vehicle_class }).eq("id", id).select("driver_id");
    if (v.error) throw v.error;
    if (!v.data?.length) throw new InputError(t("No se encontró el vehículo.", "Vehicle not found."));
    // First time the vehicle gets a category: the driver hears which jobs it now receives.
    const driverId = v.data[0].driver_id as string;
    if (prior && !isVehicleCategory(prior.vehicle_class) && vehicle_class) {
      const { data: who } = await supabase.from("profiles").select("app_lang").eq("id", driverId).maybeSingle();
      const label = categoryLabel(vehicle_class, who?.app_lang === "en" ? "en" : "es");
      await notifyDriver(supabase, driverId, firstCategoryNotice(false, vehicle_class, vehicleText(prior), label));
    }
    revalidatePath("/admin/drivers");
    revalidatePath(`/admin/drivers/${v.data[0].driver_id}`);
    revalidatePath("/admin");
  }, t("No se pudo guardar la categoría. Intente de nuevo.", "Couldn't save the category. Please try again."));
}
