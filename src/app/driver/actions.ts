"use server";

import { AREA_IDS } from "@/lib/catalog";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isValidYmd } from "@/lib/dates";
import { DRIVER_DOC_KEYS, MAX_VEHICLE_PHOTOS, RENEWABLE, VEHICLE_DOC_KEYS } from "@/lib/driverKyc";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { hasContactDetails } from "@/lib/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

/* All writes run as the signed-in user, so row-level security and the guard
   triggers decide what is allowed: a driver can never approve themselves or
   a vehicle, and file links must point into their own folder. */

/** Picks the Spanish or English message (language of the driver portal / app request). */
type T = (es: string, en: string) => string;

async function lang(): Promise<T> {
  return makeT(await getTeamLang());
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(t: T, fd: FormData, name: string, max = 80): string | null {
  const v = String(fd.get(name) ?? "").trim();
  if (v.length > max)
    throw new InputError(t(`Ese dato es demasiado largo (máximo ${max} caracteres).`, `That entry is too long (max ${max} characters).`));
  return v || null;
}

function date(t: T, fd: FormData, name: string, label: string): string | null {
  const v = String(fd.get(name) ?? "").trim();
  if (!v) return null;
  if (!isValidYmd(v)) throw new InputError(t(`${label}: elija una fecha válida.`, `${label}: please pick a valid date.`));
  return v;
}

function int(t: T, fd: FormData, name: string, label: string, min: number, max: number): number | null {
  const v = String(fd.get(name) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new InputError(t(`${label}: escriba un número del ${min} al ${max}.`, `${label}: enter a number from ${min} to ${max}.`));
  return n;
}

/** Only the fields present in the form, so a form without a field never blanks it. */
function pick(fd: FormData, readers: Record<string, () => string | number | null>) {
  const out: Record<string, string | number | null> = {};
  for (const [k, read] of Object.entries(readers)) if (fd.has(k)) out[k] = read();
  return out;
}

const driverFields = (t: T, fd: FormData) =>
  pick(fd, {
    cedula_number: () => text(t, fd, "cedula_number", 30),
    license_number: () => text(t, fd, "license_number", 30),
    license_expiry: () => date(t, fd, "license_expiry", t("Vencimiento de la licencia", "Licence expiry")),
    criminal_record_date: () => date(t, fd, "criminal_record_date", t("Fecha de la hoja de delincuencia", "Criminal record date")),
    ict_permit_number: () => text(t, fd, "ict_permit_number", 40),
    home_hub: () => {
      const v = String(fd.get("home_hub") ?? "");
      return (AREA_IDS as readonly string[]).includes(v) ? v : null;
    },
  });

const vehicleBasics = (t: T, fd: FormData) =>
  pick(fd, {
    plate: () => text(t, fd, "plate", 12)?.toUpperCase() ?? null,
    make_model: () => text(t, fd, "make_model", 60),
    year: () => int(t, fd, "year", t("Año del vehículo", "Vehicle year"), 1990, 2100),
    color: () => text(t, fd, "color", 30),
    passenger_capacity: () => int(t, fd, "passenger_capacity", t("Asientos para pasajeros", "Passenger seats"), 1, 60),
    ins_policy_number: () => text(t, fd, "ins_policy_number", 40),
    ins_insurance_expiry: () => date(t, fd, "ins_insurance_expiry", t("Seguro vigente hasta", "Insurance valid until")),
    dekra_inspection_expiry: () => date(t, fd, "dekra_inspection_expiry", t("Dekra vigente hasta", "Dekra valid until")),
    marchamo_year: () => int(t, fd, "marchamo_year", t("Año del Marchamo", "Marchamo year"), 2020, 2100),
  });

const vehicleFields = (t: T, fd: FormData): Record<string, string | number | boolean | null> => ({
  ...vehicleBasics(t, fd),
  // Checkboxes send nothing when unticked, so a hidden "features" marker says the form had them.
  ...(fd.has("features")
    ? {
        has_wifi: fd.get("has_wifi") === "on",
        stroller_space: fd.get("stroller_space") === "on",
        pet_friendly: fd.get("pet_friendly") === "on",
        child_seats: int(t, fd, "child_seats", t("Asientos para niños", "Child seats"), 0, 6) ?? 0,
      }
    : {}),
});

async function db(t: T) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new InputError(t("El registro de conductores todavía no está disponible.", "Driver sign-up isn't available yet."));
  return supabase;
}

function friendly(e: { message?: string }): never {
  // Messages raised by our own database rules are written for people (in English).
  const m = e.message ?? "";
  if (/^(Upload the|Only an admin|At most 12|Files must|Documents must|Please keep)/.test(m)) throw new InputError(m);
  throw e;
}

function renewedValue(t: T, key: string, raw: string | undefined) {
  const renew = RENEWABLE[key];
  if (!renew || raw === undefined) return null;
  const fd = new FormData();
  fd.set(renew.field, raw);
  const v =
    renew.kind === "year"
      ? int(t, fd, renew.field, t("Año del Marchamo", "Marchamo year"), 2020, 2100)
      : date(t, fd, renew.field, t("Fecha", "Date"));
  if (v === null) throw new InputError(t("Escriba la nueva fecha.", "Please enter the new date."));
  return { field: renew.field, value: v };
}

const notFound = (t: T) => t("No encontramos su solicitud. Recargue la página.", "We couldn't find your application. Reload the page.");
const uploadFailed = (t: T) => t("La subida falló. Intente de nuevo.", "Upload failed. Please try again.");
const vehicleNotFound = (t: T) => t("No se encontró el vehículo.", "Vehicle not found.");
const vehicleNotFoundReload = (t: T) => t("No se encontró el vehículo. Recargue la página.", "Vehicle not found. Reload the page.");
const unknownDoc = (t: T) => t("Tipo de documento desconocido.", "Unknown document type.");

/* ------------------------------ the person ------------------------------ */

/** First step: name + WhatsApp on the profile, then the KYC record (always "pending"). */
export async function applyAsDriver(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = await lang();
  return runAction(async () => {
    const me = await requireUser("/driver");
    const full_name = text(t, fd, "full_name", 80);
    const phone = text(t, fd, "phone", 30);
    if (!full_name || !phone)
      throw new InputError(t("Agregue su nombre completo y su número de WhatsApp.", "Please add your full name and WhatsApp number."));
    if (fd.get("agree") !== "on")
      throw new InputError(t("Confirme la declaración al final del formulario.", "Please confirm the statement at the bottom."));
    const details = driverFields(t, fd);

    const supabase = await db(t);
    const p = await supabase.from("profiles").update({ full_name, phone }).eq("id", me.id);
    if (p.error) throw p.error;
    const d = await supabase.from("drivers").insert({ id: me.id, ...details });
    if (d.error && d.error.code !== "23505") friendly(d.error); // 23505: already applied
    revalidatePath("/driver");
  }, t("No se pudo enviar su solicitud. Intente de nuevo.", "Couldn't send your application. Please try again."));
}

export async function saveDriverDetails(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = await lang();
  return runAction(async () => {
    const me = await requireUser("/driver");
    const full_name = text(t, fd, "full_name", 80);
    const phone = text(t, fd, "phone", 30);
    if (!full_name || !phone)
      throw new InputError(t("Mantenga llenos su nombre completo y su número de WhatsApp.", "Please keep your full name and WhatsApp number filled in."));
    const details = driverFields(t, fd);

    const supabase = await db(t);
    const p = await supabase.from("profiles").update({ full_name, phone }).eq("id", me.id);
    if (p.error) throw p.error;
    const d = await supabase.from("drivers").update(details).eq("id", me.id).select("id");
    if (d.error) friendly(d.error);
    if (!d.data?.length) throw new InputError(notFound(t));
    revalidatePath("/driver");
  }, t("No se pudieron guardar sus datos. Intente de nuevo.", "Couldn't save your details. Please try again."));
}

/** After an upload to storage: link the file to the driver record (with its new date for a renewal). */
export async function attachDriverDocument(key: string, path: string, renewed?: string): Promise<FormState> {
  const t = await lang();
  return runAction(async () => {
    const me = await requireUser("/driver");
    if (!DRIVER_DOC_KEYS.has(key)) throw new InputError(unknownDoc(t));
    if (!path.startsWith(`${me.id}/`) || path.includes("..")) throw new InputError(uploadFailed(t));

    const supabase = await db(t);
    const cur = await supabase.from("drivers").select("documents").eq("id", me.id).single();
    if (cur.error) throw cur.error;
    const patch: Record<string, unknown> = {
      documents: { ...((cur.data?.documents as Record<string, string>) ?? {}), [key]: path },
    };
    const r = renewedValue(t, key, renewed);
    if (r) patch[r.field] = r.value;
    const up = await supabase.from("drivers").update(patch).eq("id", me.id);
    if (up.error) friendly(up.error);
    revalidatePath("/driver");
  }, t(
    "El archivo se subió, pero no pudimos vincularlo a su solicitud. Intente de nuevo.",
    "The file uploaded but we couldn't link it to your application. Please try again.",
  ));
}

/** Bio and English level, shown to travellers once the driver is assigned. */
export async function saveDriverProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = await lang();
  return runAction(async () => {
    const me = await requireUser("/driver");
    const bio = text(t, fd, "bio", 600);
    const level = String(fd.get("english_level") ?? "");
    if (level !== "fluent" && level !== "basic") throw new InputError(t("Elija su nivel de inglés.", "Pick your English level."));
    if (bio && hasContactDetails(bio)) {
      throw new InputError(
        t(
          "No incluya teléfonos, correos ni enlaces en su presentación. Los clientes reservan por medio de Costa Rica Private Transfers.",
          "Please keep phone numbers, emails and links out of your bio. Travellers book through Costa Rica Private Transfers.",
        ),
      );
    }
    const supabase = await db(t);
    const up = await supabase.from("drivers").update({ bio, english_level: level }).eq("id", me.id).select("id");
    if (up.error) friendly(up.error);
    if (!up.data?.length) throw new InputError(notFound(t));
    revalidatePath("/driver");
  }, t("No se pudo guardar su perfil. Intente de nuevo.", "Couldn't save your profile. Please try again."));
}

/* ------------------------------ vehicles -------------------------------- */

export async function addVehicle(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = await lang();
  return runAction(async () => {
    const me = await requireUser("/driver");
    const fields = vehicleFields(t, fd);
    if (!fields.plate || !fields.make_model)
      throw new InputError(t("Agregue al menos la placa y la marca y modelo.", "Add at least the plate and the make and model."));
    const supabase = await db(t);
    const ins = await supabase.from("driver_vehicles").insert({ driver_id: me.id, ...fields });
    if (ins.error) friendly(ins.error);
    revalidatePath("/driver");
  }, t("No se pudo agregar el vehículo. Intente de nuevo.", "Couldn't add the vehicle. Please try again."));
}

export async function saveVehicle(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = await lang();
  return runAction(async () => {
    await requireUser("/driver");
    const id = String(fd.get("vehicle_id") ?? "");
    if (!UUID.test(id)) throw new InputError(vehicleNotFound(t));
    const supabase = await db(t);
    const up = await supabase.from("driver_vehicles").update(vehicleFields(t, fd)).eq("id", id).select("id");
    if (up.error) friendly(up.error);
    if (!up.data?.length) throw new InputError(vehicleNotFoundReload(t));
    revalidatePath("/driver");
  }, t("No se pudo guardar el vehículo. Intente de nuevo.", "Couldn't save the vehicle. Please try again."));
}

export async function removeVehicle(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = await lang();
  return runAction(async () => {
    await requireUser("/driver");
    const id = String(fd.get("vehicle_id") ?? "");
    if (!UUID.test(id)) throw new InputError(vehicleNotFound(t));
    if (fd.get("confirm") !== "on") throw new InputError(t("Marque la casilla para confirmar.", "Tick the box to confirm."));
    const supabase = await db(t);
    const del = await supabase.from("driver_vehicles").delete().eq("id", id).select("id");
    if (del.error) throw del.error;
    revalidatePath("/driver");
  }, t("No se pudo eliminar el vehículo. Intente de nuevo.", "Couldn't remove the vehicle. Please try again."));
}

async function vehicleFor(t: T, meId: string, vehicleId: string, path: string) {
  if (!UUID.test(vehicleId)) throw new InputError(vehicleNotFound(t));
  if (!path.startsWith(`${meId}/vehicles/${vehicleId}/`) || path.includes("..")) {
    throw new InputError(uploadFailed(t));
  }
  const supabase = await db(t);
  const cur = await supabase.from("driver_vehicles").select("documents, photos").eq("id", vehicleId).single();
  if (cur.error) throw new InputError(vehicleNotFoundReload(t));
  return { supabase, documents: (cur.data.documents ?? {}) as Record<string, string>, photos: (cur.data.photos ?? []) as string[] };
}

export async function attachVehicleDocument(vehicleId: string, key: string, path: string, renewed?: string): Promise<FormState> {
  const t = await lang();
  return runAction(async () => {
    const me = await requireUser("/driver");
    if (!VEHICLE_DOC_KEYS.has(key)) throw new InputError(unknownDoc(t));
    const { supabase, documents } = await vehicleFor(t, me.id, vehicleId, path);
    const patch: Record<string, unknown> = { documents: { ...documents, [key]: path } };
    const r = renewedValue(t, key, renewed);
    if (r) patch[r.field] = r.value;
    const up = await supabase.from("driver_vehicles").update(patch).eq("id", vehicleId);
    if (up.error) friendly(up.error);
    revalidatePath("/driver");
  }, t(
    "El archivo se subió, pero no pudimos vincularlo al vehículo. Intente de nuevo.",
    "The file uploaded but we couldn't link it to the vehicle. Please try again.",
  ));
}

export async function addVehiclePhoto(vehicleId: string, path: string): Promise<FormState> {
  const t = await lang();
  return runAction(async () => {
    const me = await requireUser("/driver");
    const { supabase, photos } = await vehicleFor(t, me.id, vehicleId, path);
    if (photos.length >= MAX_VEHICLE_PHOTOS)
      throw new InputError(
        t(
          `Máximo ${MAX_VEHICLE_PHOTOS} fotos por vehículo. Elimine una primero.`,
          `At most ${MAX_VEHICLE_PHOTOS} photos per vehicle. Remove one first.`,
        ),
      );
    const up = await supabase.from("driver_vehicles").update({ photos: [...photos, path] }).eq("id", vehicleId);
    if (up.error) friendly(up.error);
    revalidatePath("/driver");
  }, t(
    "La foto se subió, pero no pudimos agregarla al vehículo. Intente de nuevo.",
    "The photo uploaded but we couldn't add it to the vehicle. Please try again.",
  ));
}

export async function removeVehiclePhoto(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = await lang();
  return runAction(async () => {
    const me = await requireUser("/driver");
    const vehicleId = String(fd.get("vehicle_id") ?? "");
    const path = String(fd.get("path") ?? "");
    const { supabase, photos } = await vehicleFor(t, me.id, vehicleId, path);
    const up = await supabase.from("driver_vehicles").update({ photos: photos.filter((p) => p !== path) }).eq("id", vehicleId);
    if (up.error) friendly(up.error);
    revalidatePath("/driver");
  }, t("No se pudo eliminar la foto. Intente de nuevo.", "Couldn't remove the photo. Please try again."));
}
