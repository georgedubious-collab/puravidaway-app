"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isValidYmd } from "@/lib/dates";
import { DOC_KEYS } from "@/lib/driverKyc";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* All writes run as the signed-in user, so row-level security and the
   guard_driver_kyc trigger decide what is allowed: a driver can never change
   their own status or the admin's review fields. */

function text(fd: FormData, name: string, max = 80): string | null {
  const v = String(fd.get(name) ?? "").trim();
  if (v.length > max) throw new InputError(`That entry is too long (max ${max} characters).`);
  return v || null;
}

function date(fd: FormData, name: string, label: string): string | null {
  const v = String(fd.get(name) ?? "").trim();
  if (!v) return null;
  if (!isValidYmd(v)) throw new InputError(`${label}: please pick a valid date.`);
  return v;
}

function int(fd: FormData, name: string, label: string, min: number, max: number): number | null {
  const v = String(fd.get(name) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new InputError(`${label}: enter a number from ${min} to ${max}.`);
  return n;
}

function driverDetails(fd: FormData) {
  return {
    cedula_number: text(fd, "cedula_number", 30),
    license_number: text(fd, "license_number", 30),
    license_expiry: date(fd, "license_expiry", "Licence expiry"),
    ict_permit_number: text(fd, "ict_permit_number", 40),
    ins_policy_number: text(fd, "ins_policy_number", 40),
    ins_insurance_expiry: date(fd, "ins_insurance_expiry", "Insurance expiry"),
    dekra_inspection_expiry: date(fd, "dekra_inspection_expiry", "Dekra expiry"),
    marchamo_year: int(fd, "marchamo_year", "Marchamo year", 2020, 2100),
    criminal_record_date: date(fd, "criminal_record_date", "Criminal record date"),
    vehicle_model: text(fd, "vehicle_model", 60),
    vehicle_year: int(fd, "vehicle_year", "Vehicle year", 1990, 2100),
    passenger_capacity: int(fd, "passenger_capacity", "Passenger seats", 1, 60),
  };
}

async function db() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new InputError("Driver sign-up isn't available yet.");
  return supabase;
}

/** First step: name + phone on the profile, then the KYC record (always "pending"). */
export async function applyAsDriver(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver");
    const full_name = text(fd, "full_name", 80);
    const phone = text(fd, "phone", 30);
    if (!full_name || !phone) throw new InputError("Please add your full name and WhatsApp number.");
    if (fd.get("agree") !== "on") throw new InputError("Please confirm the statement at the bottom.");
    const details = driverDetails(fd);

    const supabase = await db();
    const p = await supabase.from("profiles").update({ full_name, phone }).eq("id", me.id);
    if (p.error) throw p.error;
    const d = await supabase.from("drivers").insert({ id: me.id, ...details });
    if (d.error && d.error.code !== "23505") throw d.error; // 23505: already applied
    revalidatePath("/driver");
  }, "Couldn't send your application. Please try again.");
}

export async function saveDriverDetails(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver");
    const full_name = text(fd, "full_name", 80);
    const phone = text(fd, "phone", 30);
    if (!full_name || !phone) throw new InputError("Please keep your full name and WhatsApp number filled in.");
    const details = driverDetails(fd);

    const supabase = await db();
    const p = await supabase.from("profiles").update({ full_name, phone }).eq("id", me.id);
    if (p.error) throw p.error;
    const d = await supabase.from("drivers").update(details).eq("id", me.id).select("id");
    if (d.error) throw d.error;
    if (!d.data?.length) throw new InputError("We couldn't find your application. Reload the page.");
    revalidatePath("/driver");
  }, "Couldn't save your details. Please try again.");
}

/**
 * Called by the upload widget after the file is in storage: remember which
 * file belongs to which document.
 */
export async function attachDocument(key: string, path: string): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver");
    if (!DOC_KEYS.has(key)) throw new InputError("Unknown document type.");
    if (!path.startsWith(`${me.id}/`) || path.includes("..")) throw new InputError("Upload failed. Please try again.");

    const supabase = await db();
    const cur = await supabase.from("drivers").select("documents").eq("id", me.id).single();
    if (cur.error) throw cur.error;
    const documents = { ...((cur.data?.documents as Record<string, string>) ?? {}), [key]: path };
    const up = await supabase.from("drivers").update({ documents }).eq("id", me.id);
    if (up.error) throw up.error;
    revalidatePath("/driver");
  }, "The file uploaded but we couldn't link it to your application. Please try again.");
}
