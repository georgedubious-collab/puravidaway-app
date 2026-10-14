/**
 * What a traveller can ask for on a ride, and how that compares with what a
 * driver and vehicle offer. Extras are free requests for now (pricing them is
 * an open decision, docs/PROJECT.md §9).
 */

export type DriverLanguage = "english" | "spanish_ok";

export interface RidePrefs {
  /** "english": English-speaking driver. "spanish_ok": Spanish or basic English is fine. */
  language: DriverLanguage;
  wifi: boolean;
  stroller: boolean;
  /** Baby / child seats needed (0–4). */
  childSeats: number;
  pets: boolean;
}

export const DEFAULT_PREFS: RidePrefs = { language: "english", wifi: false, stroller: false, childSeats: 0, pets: false };

export const LANGUAGE_LABEL: Record<DriverLanguage, string> = {
  english: "English-speaking driver",
  spanish_ok: "Spanish or basic English is fine",
};

export const ENGLISH_LEVEL_LABEL: Record<"fluent" | "basic", string> = {
  fluent: "Speaks English",
  basic: "Spanish · basic English",
};

export function parsePrefs(raw: unknown): RidePrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.language !== "english" && o.language !== "spanish_ok") return null;
  if (typeof o.wifi !== "boolean" || typeof o.stroller !== "boolean" || typeof o.pets !== "boolean") return null;
  if (!Number.isInteger(o.childSeats) || (o.childSeats as number) < 0 || (o.childSeats as number) > 4) return null;
  return { language: o.language, wifi: o.wifi, stroller: o.stroller, childSeats: o.childSeats as number, pets: o.pets };
}

/** Short words for summaries ("Wi-Fi · 2 child seats · pet"). */
export function prefsSummary(p: Partial<RidePrefs> | null | undefined): string[] {
  if (!p) return [];
  const out: string[] = [];
  if (p.language === "english") out.push("English-speaking driver");
  if (p.language === "spanish_ok") out.push("Spanish / basic English OK");
  if (p.wifi) out.push("Wi-Fi");
  if (p.stroller) out.push("stroller");
  if (p.childSeats) out.push(`${p.childSeats} child seat${p.childSeats > 1 ? "s" : ""}`);
  if (p.pets) out.push("travelling with a pet");
  return out;
}

/** What the assigned driver / vehicle doesn't cover, for the admin's dispatch warning. */
export function prefMismatches(
  p: Partial<RidePrefs> | null | undefined,
  driver: { english_level: "fluent" | "basic" | null },
  vehicle: { has_wifi: boolean; child_seats: number; stroller_space: boolean; pet_friendly: boolean },
): string[] {
  if (!p) return [];
  const out: string[] = [];
  if (p.language === "english" && driver.english_level !== "fluent") out.push("not an English-speaking driver");
  if (p.wifi && !vehicle.has_wifi) out.push("no Wi-Fi");
  if (p.childSeats && vehicle.child_seats < p.childSeats) out.push(`only ${vehicle.child_seats} child seat(s)`);
  if (p.stroller && !vehicle.stroller_space) out.push("no stroller space listed");
  if (p.pets && !vehicle.pet_friendly) out.push("not pet friendly");
  return out;
}

/**
 * Phone numbers, emails or links in text meant for travellers or drivers.
 * Mirrors public.no_contact_details() in the database.
 */
export function hasContactDetails(t: string): boolean {
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) return true;
  if (/(https?:\/\/|www\.|\.com\b|\.cr\b|wa\.me)/i.test(t)) return true;
  const noYears = t.replace(/(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}/g, "");
  return /\d{8,}/.test(noYears.replace(/(?<=\d)[ ().+-]+(?=\d)/g, ""));
}
