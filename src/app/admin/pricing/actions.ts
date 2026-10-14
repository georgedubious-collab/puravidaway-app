"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { HUBS } from "@/lib/catalog";
import { CATALOG_TAG } from "@/lib/catalogSource";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Pricing manager actions. Each one: checks the admin role, validates the
 * form, writes as the logged-in admin (the database re-checks the role),
 * then refreshes the storefront's cached catalog so prices change at once.
 */

class InputError extends Error {}

export interface FormState {
  ok?: boolean;
  error?: string;
  /** Changes on every successful save so the form can show "Saved". */
  savedAt?: number;
}

async function run(fn: () => Promise<void>): Promise<FormState> {
  try {
    await fn();
    return { ok: true, savedAt: Date.now() };
  } catch (e) {
    // Redirects (e.g. session expired) must pass through.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    if (e instanceof InputError) return { error: e.message.replace(/_/g, " ") };
    console.error("[admin/pricing]", e);
    return { error: "The database refused the change. Check your connection and that you are still an admin." };
  }
}

function text(fd: FormData, key: string, { required = true, max = 300 } = {}): string {
  const v = String(fd.get(key) ?? "").trim();
  if (required && !v) throw new InputError(`${key} is required`);
  if (v.length > max) throw new InputError(`${key} is too long`);
  return v;
}
function money(fd: FormData, key: string): number {
  const v = String(fd.get(key) ?? "").trim().replace(/[$,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(v)) throw new InputError(`${key} must be an amount like 175 or 175.50`);
  return Number(v);
}
function int(fd: FormData, key: string, min: number, max: number): number {
  const n = Number(fd.get(key));
  if (!Number.isInteger(n) || n < min || n > max) throw new InputError(`${key} must be ${min}–${max}`);
  return n;
}
function decimal(fd: FormData, key: string, min: number, max: number): number {
  const n = Number(String(fd.get(key) ?? "").trim());
  if (!Number.isFinite(n) || n < min || n > max) throw new InputError(`${key} must be ${min}–${max}`);
  return n;
}
function date(fd: FormData, key: string): string {
  const v = String(fd.get(key) ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new InputError(`${key} must be a date`);
  return v;
}
const checked = (fd: FormData, key: string) => fd.get(key) === "on";
const hubs = (fd: FormData) =>
  fd.getAll("corridors").map(String).filter((h) => HUBS.some((x) => x.id === h));

async function save(table: string, fd: FormData, values: Record<string, unknown>) {
  await requireRole("admin", "/admin/pricing");
  const id = text(fd, "id", { max: 60 });
  const supabase = (await createSupabaseServerClient())!;
  const { error } = await supabase.from(table).update(values).eq("id", id);
  if (error) throw new Error(error.message);
  done();
}

function done() {
  // expire: 0 → the very next storefront visit reads the new prices.
  revalidateTag(CATALOG_TAG, { expire: 0 });
  revalidatePath("/admin/pricing");
}

async function saveVehicleImpl(fd: FormData) {
  await save("vehicle_classes", fd, {
    name: text(fd, "name"),
    base_rate: money(fd, "base_rate"),
    max_pax: int(fd, "max_pax", 1, 60),
    luggage: text(fd, "luggage", { required: false }),
    badge: text(fd, "badge", { required: false }),
    active: checked(fd, "active"),
  });
}

async function saveStopImpl(fd: FormData) {
  await save("sightseeing_stops", fd, {
    name: text(fd, "name"),
    description: text(fd, "description", { required: false, max: 600 }),
    duration_min: int(fd, "duration_min", 5, 600),
    price: money(fd, "price"),
    park_fee_included: checked(fd, "park_fee_included"),
    corridors: hubs(fd),
    active: checked(fd, "active"),
  });
}

async function addStopImpl(fd: FormData) {
  await requireRole("admin", "/admin/pricing");
  const name = text(fd, "name");
  const id = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  if (!id) throw new InputError("name needs letters or numbers");
  const supabase = (await createSupabaseServerClient())!;
  const { error } = await supabase.from("sightseeing_stops").insert({
    id,
    name,
    description: text(fd, "description", { required: false, max: 600 }),
    duration_min: int(fd, "duration_min", 5, 600),
    price: money(fd, "price"),
    corridors: hubs(fd),
    sort_order: 100,
    active: false, // new stops start hidden so they can be checked before going live
  });
  if (error) throw new Error(error.code === "23505" ? "A stop with that name already exists" : error.message);
  done();
}

async function saveDayTourImpl(fd: FormData) {
  await save("day_tours", fd, {
    name: text(fd, "name"),
    duration_hours: decimal(fd, "duration_hours", 0.5, 24),
    price: money(fd, "price"),
    en_route_upgrade_price: money(fd, "en_route_upgrade_price"),
    active: checked(fd, "active"),
  });
}

async function saveExpeditionImpl(fd: FormData) {
  await save("expeditions", fd, {
    name: text(fd, "name"),
    base_price: money(fd, "base_price"),
    active: checked(fd, "active"),
  });
}

async function saveLodgingTierImpl(fd: FormData) {
  await save("lodging_tiers", fd, {
    name: text(fd, "name"),
    surcharge: money(fd, "surcharge"),
    active: checked(fd, "active"),
  });
}

async function saveSeasonImpl(fd: FormData) {
  await save("seasons", fd, {
    name: text(fd, "name"),
    multiplier: decimal(fd, "multiplier", 0.5, 3),
  });
}

async function addSeasonRangeImpl(fd: FormData) {
  await requireRole("admin", "/admin/pricing");
  const startsOn = date(fd, "starts_on");
  const endsOn = date(fd, "ends_on");
  if (endsOn < startsOn) throw new InputError("The end date is before the start date");
  const supabase = (await createSupabaseServerClient())!;
  const { error } = await supabase.from("season_ranges").insert({
    season_id: text(fd, "season_id", { max: 60 }),
    starts_on: startsOn,
    ends_on: endsOn,
    note: text(fd, "note", { required: false, max: 120 }) || null,
  });
  if (error) throw new Error(error.message);
  done();
}

async function deleteSeasonRangeImpl(fd: FormData) {
  await requireRole("admin", "/admin/pricing");
  const id = text(fd, "id", { max: 60 });
  const supabase = (await createSupabaseServerClient())!;
  const { error } = await supabase.from("season_ranges").delete().eq("id", id);
  if (error) throw new Error(error.message);
  done();
}

export async function saveVehicle(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveVehicleImpl(fd));
}
export async function saveStop(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveStopImpl(fd));
}
export async function addStop(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => addStopImpl(fd));
}
export async function saveDayTour(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveDayTourImpl(fd));
}
export async function saveExpedition(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveExpeditionImpl(fd));
}
export async function saveLodgingTier(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveLodgingTierImpl(fd));
}
export async function saveSeason(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveSeasonImpl(fd));
}
export async function addSeasonRange(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => addSeasonRangeImpl(fd));
}
export async function deleteSeasonRange(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => deleteSeasonRangeImpl(fd));
}
