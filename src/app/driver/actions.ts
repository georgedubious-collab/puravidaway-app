"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isValidYmd } from "@/lib/dates";
import { DRIVER_DOC_KEYS, MAX_VEHICLE_PHOTOS, RENEWABLE, VEHICLE_DOC_KEYS } from "@/lib/driverKyc";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { hasContactDetails } from "@/lib/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* All writes run as the signed-in user, so row-level security and the guard
   triggers decide what is allowed: a driver can never approve themselves or
   a vehicle, and file links must point into their own folder. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Only the fields present in the form, so a form without a field never blanks it. */
function pick(fd: FormData, readers: Record<string, () => string | number | null>) {
  const out: Record<string, string | number | null> = {};
  for (const [k, read] of Object.entries(readers)) if (fd.has(k)) out[k] = read();
  return out;
}

const driverFields = (fd: FormData) =>
  pick(fd, {
    cedula_number: () => text(fd, "cedula_number", 30),
    license_number: () => text(fd, "license_number", 30),
    license_expiry: () => date(fd, "license_expiry", "Licence expiry"),
    criminal_record_date: () => date(fd, "criminal_record_date", "Criminal record date"),
    ict_permit_number: () => text(fd, "ict_permit_number", 40),
  });

const vehicleBasics = (fd: FormData) =>
  pick(fd, {
    plate: () => text(fd, "plate", 12)?.toUpperCase() ?? null,
    make_model: () => text(fd, "make_model", 60),
    year: () => int(fd, "year", "Vehicle year", 1990, 2100),
    color: () => text(fd, "color", 30),
    passenger_capacity: () => int(fd, "passenger_capacity", "Passenger seats", 1, 60),
    ins_policy_number: () => text(fd, "ins_policy_number", 40),
    ins_insurance_expiry: () => date(fd, "ins_insurance_expiry", "Insurance valid until"),
    dekra_inspection_expiry: () => date(fd, "dekra_inspection_expiry", "Dekra valid until"),
    marchamo_year: () => int(fd, "marchamo_year", "Marchamo year", 2020, 2100),
  });

const vehicleFields = (fd: FormData): Record<string, string | number | boolean | null> => ({
  ...vehicleBasics(fd),
  // Checkboxes send nothing when unticked, so a hidden "features" marker says the form had them.
  ...(fd.has("features")
    ? {
        has_wifi: fd.get("has_wifi") === "on",
        stroller_space: fd.get("stroller_space") === "on",
        pet_friendly: fd.get("pet_friendly") === "on",
        child_seats: int(fd, "child_seats", "Child seats", 0, 6) ?? 0,
      }
    : {}),
});

async function db() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new InputError("Driver sign-up isn't available yet.");
  return supabase;
}

function friendly(e: { message?: string }): never {
  // Messages raised by our own database rules are written for people.
  const m = e.message ?? "";
  if (/^(Upload the|Only an admin|At most 12|Files must|Documents must|Please keep)/.test(m)) throw new InputError(m);
  throw e;
}

function renewedValue(key: string, raw: string | undefined) {
  const renew = RENEWABLE[key];
  if (!renew || raw === undefined) return null;
  const fd = new FormData();
  fd.set(renew.field, raw);
  const v = renew.kind === "year" ? int(fd, renew.field, "Marchamo year", 2020, 2100) : date(fd, renew.field, "Date");
  if (v === null) throw new InputError("Please enter the new date.");
  return { field: renew.field, value: v };
}

/* ------------------------------ the person ------------------------------ */

/** First step: name + WhatsApp on the profile, then the KYC record (always "pending"). */
export async function applyAsDriver(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver");
    const full_name = text(fd, "full_name", 80);
    const phone = text(fd, "phone", 30);
    if (!full_name || !phone) throw new InputError("Please add your full name and WhatsApp number.");
    if (fd.get("agree") !== "on") throw new InputError("Please confirm the statement at the bottom.");
    const details = driverFields(fd);

    const supabase = await db();
    const p = await supabase.from("profiles").update({ full_name, phone }).eq("id", me.id);
    if (p.error) throw p.error;
    const d = await supabase.from("drivers").insert({ id: me.id, ...details });
    if (d.error && d.error.code !== "23505") friendly(d.error); // 23505: already applied
    revalidatePath("/driver");
  }, "Couldn't send your application. Please try again.");
}

export async function saveDriverDetails(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver");
    const full_name = text(fd, "full_name", 80);
    const phone = text(fd, "phone", 30);
    if (!full_name || !phone) throw new InputError("Please keep your full name and WhatsApp number filled in.");
    const details = driverFields(fd);

    const supabase = await db();
    const p = await supabase.from("profiles").update({ full_name, phone }).eq("id", me.id);
    if (p.error) throw p.error;
    const d = await supabase.from("drivers").update(details).eq("id", me.id).select("id");
    if (d.error) friendly(d.error);
    if (!d.data?.length) throw new InputError("We couldn't find your application. Reload the page.");
    revalidatePath("/driver");
  }, "Couldn't save your details. Please try again.");
}

/** After an upload to storage: link the file to the driver record (with its new date for a renewal). */
export async function attachDriverDocument(key: string, path: string, renewed?: string): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver");
    if (!DRIVER_DOC_KEYS.has(key)) throw new InputError("Unknown document type.");
    if (!path.startsWith(`${me.id}/`) || path.includes("..")) throw new InputError("Upload failed. Please try again.");

    const supabase = await db();
    const cur = await supabase.from("drivers").select("documents").eq("id", me.id).single();
    if (cur.error) throw cur.error;
    const patch: Record<string, unknown> = {
      documents: { ...((cur.data?.documents as Record<string, string>) ?? {}), [key]: path },
    };
    const r = renewedValue(key, renewed);
    if (r) patch[r.field] = r.value;
    const up = await supabase.from("drivers").update(patch).eq("id", me.id);
    if (up.error) friendly(up.error);
    revalidatePath("/driver");
  }, "The file uploaded but we couldn't link it to your application. Please try again.");
}

/** Bio and English level, shown to travellers once the driver is assigned. */
export async function saveDriverProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver");
    const bio = text(fd, "bio", 600);
    const level = String(fd.get("english_level") ?? "");
    if (level !== "fluent" && level !== "basic") throw new InputError("Pick your English level.");
    if (bio && hasContactDetails(bio)) {
      throw new InputError("Please keep phone numbers, emails and links out of your bio. Travellers book through PuraVidaWay.");
    }
    const supabase = await db();
    const up = await supabase.from("drivers").update({ bio, english_level: level }).eq("id", me.id).select("id");
    if (up.error) friendly(up.error);
    if (!up.data?.length) throw new InputError("We couldn't find your application. Reload the page.");
    revalidatePath("/driver");
  }, "Couldn't save your profile. Please try again.");
}

/* ------------------------------ vehicles -------------------------------- */

export async function addVehicle(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver");
    const fields = vehicleFields(fd);
    if (!fields.plate || !fields.make_model) throw new InputError("Add at least the plate and the make and model.");
    const supabase = await db();
    const ins = await supabase.from("driver_vehicles").insert({ driver_id: me.id, ...fields });
    if (ins.error) friendly(ins.error);
    revalidatePath("/driver");
  }, "Couldn't add the vehicle. Please try again.");
}

export async function saveVehicle(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    await requireUser("/driver");
    const id = String(fd.get("vehicle_id") ?? "");
    if (!UUID.test(id)) throw new InputError("Vehicle not found.");
    const supabase = await db();
    const up = await supabase.from("driver_vehicles").update(vehicleFields(fd)).eq("id", id).select("id");
    if (up.error) friendly(up.error);
    if (!up.data?.length) throw new InputError("Vehicle not found. Reload the page.");
    revalidatePath("/driver");
  }, "Couldn't save the vehicle. Please try again.");
}

export async function removeVehicle(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    await requireUser("/driver");
    const id = String(fd.get("vehicle_id") ?? "");
    if (!UUID.test(id)) throw new InputError("Vehicle not found.");
    if (fd.get("confirm") !== "on") throw new InputError("Tick the box to confirm.");
    const supabase = await db();
    const del = await supabase.from("driver_vehicles").delete().eq("id", id).select("id");
    if (del.error) throw del.error;
    revalidatePath("/driver");
  }, "Couldn't remove the vehicle. Please try again.");
}

async function vehicleFor(meId: string, vehicleId: string, path: string) {
  if (!UUID.test(vehicleId)) throw new InputError("Vehicle not found.");
  if (!path.startsWith(`${meId}/vehicles/${vehicleId}/`) || path.includes("..")) {
    throw new InputError("Upload failed. Please try again.");
  }
  const supabase = await db();
  const cur = await supabase.from("driver_vehicles").select("documents, photos").eq("id", vehicleId).single();
  if (cur.error) throw new InputError("Vehicle not found. Reload the page.");
  return { supabase, documents: (cur.data.documents ?? {}) as Record<string, string>, photos: (cur.data.photos ?? []) as string[] };
}

export async function attachVehicleDocument(vehicleId: string, key: string, path: string, renewed?: string): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver");
    if (!VEHICLE_DOC_KEYS.has(key)) throw new InputError("Unknown document type.");
    const { supabase, documents } = await vehicleFor(me.id, vehicleId, path);
    const patch: Record<string, unknown> = { documents: { ...documents, [key]: path } };
    const r = renewedValue(key, renewed);
    if (r) patch[r.field] = r.value;
    const up = await supabase.from("driver_vehicles").update(patch).eq("id", vehicleId);
    if (up.error) friendly(up.error);
    revalidatePath("/driver");
  }, "The file uploaded but we couldn't link it to the vehicle. Please try again.");
}

export async function addVehiclePhoto(vehicleId: string, path: string): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver");
    const { supabase, photos } = await vehicleFor(me.id, vehicleId, path);
    if (photos.length >= MAX_VEHICLE_PHOTOS) throw new InputError(`At most ${MAX_VEHICLE_PHOTOS} photos per vehicle. Remove one first.`);
    const up = await supabase.from("driver_vehicles").update({ photos: [...photos, path] }).eq("id", vehicleId);
    if (up.error) friendly(up.error);
    revalidatePath("/driver");
  }, "The photo uploaded but we couldn't add it to the vehicle. Please try again.");
}

export async function removeVehiclePhoto(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await requireUser("/driver");
    const vehicleId = String(fd.get("vehicle_id") ?? "");
    const path = String(fd.get("path") ?? "");
    const { supabase, photos } = await vehicleFor(me.id, vehicleId, path);
    const up = await supabase.from("driver_vehicles").update({ photos: photos.filter((p) => p !== path) }).eq("id", vehicleId);
    if (up.error) friendly(up.error);
    revalidatePath("/driver");
  }, "Couldn't remove the photo. Please try again.");
}
