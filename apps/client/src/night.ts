/**
 * Pickup times and the night-pickup rule, as the app needs them (Jorge, 2026-11-11: pickups at
 * any hour; rides that start at night cost a percentage more). The price itself always comes
 * from the server, which also reports the rule with every quote (`quote.night`): this file only
 * lists the hours and marks the night ones. No imports, so the website's test script
 * (scripts/test-night-premium.mjs) can check it against the server's rule.
 */

/** Pickup times offered: every half hour, around the clock (it was 4:00 AM to 10:00 PM). */
export const TIMES = Array.from({ length: 48 }, (_, i) => {
  const m = i * 30;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
});

/** The night-pickup rule as the server reports it with a quote. */
export type NightRule = { percent: number; startHour: number; endHour: number; applies: boolean };

/**
 * Is this pickup time inside the night window the server reported? From the start hour up to,
 * but not including, the end hour; the window may cross midnight.
 */
export function isNightTime(time: string, night: NightRule | null | undefined): boolean {
  if (!night || !night.percent || night.startHour === night.endHour) return false;
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + m;
  const start = night.startHour * 60;
  const end = night.endHour * 60;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/** "Night pickup +20%" / "Recogida nocturna +20%". */
export const nightLabel = (night: NightRule, lang: "en" | "es") => (lang === "es" ? "Recogida nocturna +" : "Night pickup +") + night.percent + "%";
