/**
 * Night pickups (Jorge, 2026-11-11): rides can be picked up at any hour, and a ride whose
 * pickup time (Costa Rica time) falls in the night window costs a percentage more.
 *
 * The percentage and the window live in the database (pricing_settings.night_premium_bps,
 * night_start_hour, night_end_hour; migration 0041; edited at /admin/pricing) and reach the
 * code as catalog.nightPremium. The values below are only the built-in fallback for when the
 * database isn't connected, like the other pricing defaults.
 *
 * The window runs from the start hour up to, but not including, the end hour, and may cross
 * midnight: 22 → 4 means 10:00 PM, 11:30 PM and 3:59 AM are night; 4:00 AM and 9:30 PM are not.
 * The same start and end hour, or 0%, switches the premium off.
 *
 * Only the ride itself is marked up (after the vehicle, area and season); see quoteTransfer()
 * in ./pricing. Plain TypeScript without imports, so scripts/test-night-premium.mjs can load it.
 */
export interface NightPremium {
  /** Basis points added to the ride (2000 = +20%). 0 = no premium. */
  bps: number;
  /** First hour of the night window, 0–23, Costa Rica time. */
  startHour: number;
  /** First hour that is day again, 0–23 (the window ends just before it). */
  endHour: number;
}

/** Built-in fallback (Jorge, 2026-11-11: +20% from 10 PM to 4 AM). The live values come from pricing_settings. */
export const NIGHT_PREMIUM_DEFAULT: NightPremium = { bps: 2000, startHour: 22, endHour: 4 };

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Is this pickup time ("HH:MM", Costa Rica time) inside the night window? No time, or a malformed one, is never night. */
export function isNightPickup(time: string | null | undefined, night: NightPremium): boolean {
  if (typeof time !== "string" || night.bps <= 0 || night.startHour === night.endHour) return false;
  const m = HHMM.exec(time);
  if (!m) return false;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  const start = night.startHour * 60;
  const end = night.endHour * 60;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/** The premium for this pickup time in basis points: the configured value at night, else 0. */
export function nightBpsFor(time: string | null | undefined, night: NightPremium): number {
  return isNightPickup(time, night) ? night.bps : 0;
}

/** Is a night premium configured at all? */
export function nightPremiumOn(night: NightPremium): boolean {
  return night.bps > 0 && night.startHour !== night.endHour;
}

/** "20%" / "12.5%". */
export function nightPercent(night: NightPremium): string {
  return `${Number((night.bps / 100).toFixed(2))}%`;
}

/** An hour of the day as travellers read it: 22 → "10:00 PM" ("10:00 p. m." in Spanish). */
export function hourLabel(hour: number, lang: "en" | "es" = "en"): string {
  const half = lang === "es" ? (hour < 12 ? "a. m." : "p. m.") : hour < 12 ? "AM" : "PM";
  return `${hour % 12 === 0 ? 12 : hour % 12}:00 ${half}`;
}

/** "las 10:00 p. m." / "la 1:00 a. m.". */
function esHour(hour: number): string {
  return `${hour % 12 === 1 ? "la" : "las"} ${hourLabel(hour, "es")}`;
}

/** "between 10:00 PM and 4:00 AM" / "entre las 10:00 p. m. y las 4:00 a. m.". */
export function nightWindow(night: NightPremium, lang: "en" | "es" = "en"): string {
  return lang === "es"
    ? `entre ${esHour(night.startHour)} y ${esHour(night.endHour)}`
    : `between ${hourLabel(night.startHour)} and ${hourLabel(night.endHour)}`;
}

/** The chip on vehicle cards and summaries: "Night pickup +20%" / "Recogida nocturna +20%". */
export function nightChip(night: NightPremium, lang: "en" | "es" = "en"): string {
  return lang === "es" ? `Recogida nocturna +${nightPercent(night)}` : `Night pickup +${nightPercent(night)}`;
}

/**
 * One sentence for guides and the FAQ, built from the live values:
 * "Pickups are available at any hour. Rides that start between 10:00 PM and 4:00 AM cost 20% more."
 * Without a premium it is only the first sentence.
 */
export function nightSentence(night: NightPremium, lang: "en" | "es" = "en"): string {
  const anyHour = lang === "es" ? "Hay recogidas a cualquier hora." : "Pickups are available at any hour.";
  if (!nightPremiumOn(night)) return anyHour;
  return lang === "es"
    ? `${anyHour} Los traslados que empiezan ${nightWindow(night, "es")} cuestan un ${nightPercent(night)} más.`
    : `${anyHour} Rides that start ${nightWindow(night)} cost ${nightPercent(night)} more.`;
}
