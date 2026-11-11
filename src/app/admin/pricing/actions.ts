"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { EXTRA_AREAS, HUBS, isStopEntrance } from "@/lib/catalog";
import { CATALOG_TAG } from "@/lib/catalogSource";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTeamLang } from "@/lib/teamLangServer";

/**
 * Pricing manager actions. Each one: checks the admin role, validates the
 * form, writes as the logged-in admin (the database re-checks the role),
 * then refreshes the storefront's cached catalog so prices change at once.
 */

/** A problem the admin can fix, in Spanish and English (shown in the page language). */
class InputError extends Error {
  constructor(
    readonly es: string,
    en: string,
  ) {
    super(en);
  }
}

/** Spanish names of the form fields, for error messages ("El campo … es obligatorio"). */
const FIELD_ES: Record<string, string> = {
  id: "id",
  name: "Nombre",
  description: "Descripción",
  price_factor: "Factor de precio",
  extra_fee: "Cargo extra",
  max_pax: "Máximo de pasajeros",
  luggage: "Equipaje",
  badge: "Etiqueta",
  example_models: "Modelos de ejemplo",
  duration_min: "Minutos en la parada",
  detour_km: "Km de desvío",
  detour_min: "Minutos de desvío",
  tour_price_pp: "Precio del tour por persona",
  duration_hours: "Horas",
  price_pp_solo: "Por persona · 1 cliente",
  price_pp_small: "Por persona · 2–3",
  price_pp_group: "Por persona · 4+",
  cost_pp: "Nuestros costos por persona",
  en_route_upgrade_price: "Mejora en ruta",
  base_price: "Precio base",
  surcharge: "Recargo",
  multiplier: "Multiplicador",
  starts_on: "Desde",
  ends_on: "Hasta",
  note: "Nota",
  season_id: "Temporada",
  cash_fee_percent: "Cargo por pago en efectivo",
  night_premium_percent: "Recargo nocturno",
  night_start_hour: "Desde (hora)",
  night_end_hour: "Hasta (hora)",
  ride_base_fare: "Tarifa base",
  ride_per_km: "Por km",
  ride_per_hour: "Por hora de manejo",
  ride_minimum_fare: "Tarifa mínima",
  wait_per_hour: "Tarifa de espera",
  commission_percent: "Nuestra comisión",
  ferry_vehicle_fare_crc: "Carro + conductor (ferry)",
  ferry_passenger_fare_crc: "Por pasajero (ferry)",
  crc_per_usd: "Colones por dólar",
};
const fieldEs = (key: string) => FIELD_ES[key] ?? (key.startsWith("area_") ? `Factor de zona ${key.slice(5)}` : key);
const fieldEn = (key: string) => key.replace(/_/g, " ");
const NOTHING_SAVED = new InputError(
  "No se guardó nada. Recargue la página e intente de nuevo.",
  "Nothing was saved. Reload the page and try again.",
);

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
    const lang = await getTeamLang();
    if (e instanceof InputError) return { error: lang === "en" ? e.message : e.es };
    console.error("[admin/pricing]", e);
    return {
      error:
        lang === "en"
          ? "The database refused the change. Check your connection and that you are still an admin."
          : "La base de datos rechazó el cambio. Revise su conexión y que todavía sea admin.",
    };
  }
}

function text(fd: FormData, key: string, { required = true, max = 300 } = {}): string {
  const v = String(fd.get(key) ?? "").trim();
  if (required && !v) throw new InputError(`${fieldEs(key)}: es obligatorio`, `${fieldEn(key)} is required`);
  if (v.length > max) throw new InputError(`${fieldEs(key)}: es demasiado largo`, `${fieldEn(key)} is too long`);
  return v;
}
function money(fd: FormData, key: string): number {
  const v = String(fd.get(key) ?? "").trim().replace(/[$,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(v))
    throw new InputError(
      `${fieldEs(key)}: debe ser un monto como 175 o 175.50`,
      `${fieldEn(key)} must be an amount like 175 or 175.50`,
    );
  return Number(v);
}
function int(fd: FormData, key: string, min: number, max: number): number {
  const n = Number(fd.get(key));
  if (!Number.isInteger(n) || n < min || n > max)
    throw new InputError(`${fieldEs(key)}: debe estar entre ${min} y ${max}`, `${fieldEn(key)} must be ${min}–${max}`);
  return n;
}
function decimal(fd: FormData, key: string, min: number, max: number): number {
  const n = Number(String(fd.get(key) ?? "").trim());
  if (!Number.isFinite(n) || n < min || n > max)
    throw new InputError(`${fieldEs(key)}: debe estar entre ${min} y ${max}`, `${fieldEn(key)} must be ${min}–${max}`);
  return n;
}
function date(fd: FormData, key: string): string {
  const v = String(fd.get(key) ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new InputError(`${fieldEs(key)}: debe ser una fecha`, `${fieldEn(key)} must be a date`);
  return v;
}
const checked = (fd: FormData, key: string) => fd.get(key) === "on";
const hubs = (fd: FormData) =>
  fd.getAll("corridors").map(String).filter((h) => HUBS.some((x) => x.id === h));

async function save(table: string, fd: FormData, values: Record<string, unknown>) {
  await requireRole("admin", "/admin/pricing");
  const id = text(fd, "id", { max: 60 });
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase.from(table).update(values).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  // RLS hides rows it won't let you change, so 0 rows means nothing was saved.
  if (!data?.length) throw NOTHING_SAVED;
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
    // The field only exists once migration 0039 has run (the form leaves it out before).
    ...(fd.has("example_models") ? { example_models: text(fd, "example_models", { required: false, max: 80 }) || null } : {}),
    price_factor: decimal(fd, "price_factor", 0.5, 3),
    extra_fee: money(fd, "extra_fee"),
    allows_stops: checked(fd, "allows_stops"),
    spanish_speaking_driver: checked(fd, "spanish_speaking_driver"),
    max_pax: int(fd, "max_pax", 1, 60),
    luggage: text(fd, "luggage", { required: false }),
    badge: text(fd, "badge", { required: false }),
    active: checked(fd, "active"),
  });
}

/**
 * Stop entrance: free / included / gate (migration 0014). The old yes/no
 * park_fee_included is kept in step ("included" = yes) for anything still reading it.
 * Before 0014 the form only has the old checkbox, so only that is written.
 */
function entrance(fd: FormData): Record<string, unknown> {
  if (!fd.has("entrance")) return { park_fee_included: checked(fd, "park_fee_included") };
  const v = fd.get("entrance");
  if (!isStopEntrance(v))
    throw new InputError("La entrada debe ser gratis, incluida o pagada en la entrada", "Entrance must be free, included or gate");
  return { entrance: v, park_fee_included: v === "included" };
}

/** Detour and per-person tour inputs (migration 0021); absent from the form before the migration runs. */
function stopPricing(fd: FormData): Record<string, number> {
  if (!fd.has("detour_km")) return {};
  return {
    detour_km: decimal(fd, "detour_km", 0, 500),
    detour_min: int(fd, "detour_min", 0, 600),
    tour_price_pp: money(fd, "tour_price_pp"),
  };
}

async function saveStopImpl(fd: FormData) {
  await save("sightseeing_stops", fd, {
    name: text(fd, "name"),
    description: text(fd, "description", { required: false, max: 600 }),
    duration_min: int(fd, "duration_min", 5, 600),
    ...stopPricing(fd),
    ...entrance(fd),
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
  if (!id) throw new InputError("El nombre necesita letras o números", "name needs letters or numbers");
  const supabase = (await createSupabaseServerClient())!;
  const { error } = await supabase.from("sightseeing_stops").insert({
    id,
    name,
    description: text(fd, "description", { required: false, max: 600 }),
    duration_min: int(fd, "duration_min", 5, 600),
    price: 0,
    ...stopPricing(fd),
    corridors: hubs(fd),
    sort_order: 100,
    active: false, // new stops start hidden so they can be checked before going live
  });
  if (error?.code === "23505") throw new InputError("Ya existe una parada con ese nombre", "A stop with that name already exists");
  if (error) throw new Error(error.message);
  done();
}

async function saveDayTourImpl(fd: FormData) {
  await save("day_tours", fd, {
    name: text(fd, "name"),
    duration_hours: decimal(fd, "duration_hours", 0.5, 24),
    // Per-person tiers (migration 0022); absent from the form before it runs.
    ...(fd.has("price_pp_solo")
      ? {
          price_pp_solo: money(fd, "price_pp_solo"),
          price_pp_small: money(fd, "price_pp_small"),
          price_pp_group: money(fd, "price_pp_group"),
        }
      : {}),
    ...(fd.has("cost_pp") ? { cost_pp: money(fd, "cost_pp") } : {}),
    en_route_upgrade_price: money(fd, "en_route_upgrade_price"),
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
  if (endsOn < startsOn) throw new InputError("La fecha final es anterior a la fecha de inicio", "The end date is before the start date");
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
/** Cash booking fee, entered as a percent (10 = 10%), stored as basis points (1000). */
async function savePaymentSettingsImpl(fd: FormData) {
  await requireRole("admin", "/admin/pricing");
  const pct = decimal(fd, "cash_fee_percent", 0, 50);
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase
    .from("pricing_settings")
    .upsert({ id: true, cash_fee_bps: Math.round(pct * 100) })
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw NOTHING_SAVED;
  done();
}

/** Ride price formula numbers (docs/PRICING.md §4), in dollars. */
async function saveRideFormulaImpl(fd: FormData) {
  await requireRole("admin", "/admin/pricing");
  const values = {
    ride_base_fare: money(fd, "ride_base_fare"),
    ride_per_km: money(fd, "ride_per_km"),
    ride_per_hour: money(fd, "ride_per_hour"),
    ride_minimum_fare: money(fd, "ride_minimum_fare"),
  };
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase.from("pricing_settings").upsert({ id: true, ...values }).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw NOTHING_SAVED;
  done();
}

/** One area factor per hub (1.15 = +15%). */
async function saveAreaFactorsImpl(fd: FormData) {
  await requireRole("admin", "/admin/pricing");
  const rows = [
    ...HUBS.map((h) => ({ hub_id: h.id as string, area_factor: decimal(fd, `area_${h.id}`, 0.5, 2) })),
    // Extra areas (migration 0015) only when the form sent them (their inputs are disabled before).
    ...EXTRA_AREAS.filter((a) => fd.has(`area_${a.id}`)).map((a) => ({
      hub_id: a.id as string,
      area_factor: decimal(fd, `area_${a.id}`, 0.5, 2),
    })),
  ];
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase.from("hub_pricing").upsert(rows).select("hub_id");
  if (error) throw new Error(error.message);
  if ((data?.length ?? 0) !== rows.length) throw NOTHING_SAVED;
  done();
}

/** Waiting rate at stops, USD per hour (migration 0021). */
async function saveWaitRateImpl(fd: FormData) {
  await requireRole("admin", "/admin/pricing");
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase
    .from("pricing_settings")
    .upsert({ id: true, wait_per_hour: money(fd, "wait_per_hour") })
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw NOTHING_SAVED;
  done();
}

export async function saveWaitRate(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveWaitRateImpl(fd));
}

/** Platform commission on rides / day tours, entered as a percent (20 = 20%), stored as basis points. */
async function saveDriverCommissionImpl(fd: FormData) {
  await requireRole("admin", "/admin/pricing");
  const pct = decimal(fd, "commission_percent", 0, 50);
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase
    .from("pricing_settings")
    .upsert({ id: true, driver_commission_bps: Math.round(pct * 100) })
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw NOTHING_SAVED;
  done();
}

export async function saveDriverCommission(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveDriverCommissionImpl(fd));
}

/**
 * Night pickups (migration 0041): the premium as a percent (20 = 20%, stored as basis points)
 * and the window's start and end hours in Costa Rica time (0–23; the window ends just before
 * the end hour and may cross midnight; equal hours = no night window).
 */
async function saveNightPremiumImpl(fd: FormData) {
  await requireRole("admin", "/admin/pricing");
  const pct = decimal(fd, "night_premium_percent", 0, 100);
  const hour = (key: string) => {
    const n = decimal(fd, key, 0, 23);
    if (!Number.isInteger(n)) throw new InputError(`${fieldEs(key)}: debe ser una hora entera de 0 a 23`, `${fieldEn(key)} must be a whole hour, 0–23`);
    return n;
  };
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase
    .from("pricing_settings")
    .upsert({ id: true, night_premium_bps: Math.round(pct * 100), night_start_hour: hour("night_start_hour"), night_end_hour: hour("night_end_hour") })
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw NOTHING_SAVED;
  done();
}

export async function saveNightPremium(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveNightPremiumImpl(fd));
}

/** Gulf of Nicoya ferry fares per crossing in colones, and the colones-per-dollar rate (migration 0015). */
async function saveFerryFaresImpl(fd: FormData) {
  await requireRole("admin", "/admin/pricing");
  const values = {
    ferry_vehicle_fare_crc: int(fd, "ferry_vehicle_fare_crc", 0, 500000),
    ferry_passenger_fare_crc: int(fd, "ferry_passenger_fare_crc", 0, 100000),
    crc_per_usd: decimal(fd, "crc_per_usd", 100, 2000),
  };
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase.from("pricing_settings").upsert({ id: true, ...values }).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw NOTHING_SAVED;
  done();
}

export async function saveFerryFares(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveFerryFaresImpl(fd));
}

export async function saveRideFormula(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveRideFormulaImpl(fd));
}
export async function saveAreaFactors(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveAreaFactorsImpl(fd));
}
export async function savePaymentSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => savePaymentSettingsImpl(fd));
}
export async function saveDayTour(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(() => saveDayTourImpl(fd));
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
