/**
 * Bags on a ride (Jorge, 2026-11-10): large suitcases (bookings.luggage_count) and carry-ons
 * (bookings.carry_on_count), each 0–20. Plain text helpers shared by the website, the driver
 * portal and the CRM; the apps carry their own small copies.
 */
type Lang = "en" | "es";

/** What we start with until the traveller changes a counter: 1 large suitcase and 1 carry-on per person. */
export function defaultBags(pax: number, max = 20): number {
  return Math.max(0, Math.min(Math.floor(pax) || 0, max));
}

/** For travellers: "4 large bags + 4 carry-ons" / "4 maletas grandes + 4 de mano" (a part that is 0 is left out). */
export function bagsSummary(large: number, carryOns: number, lang: Lang): string {
  const es = lang === "es";
  if (!large && !carryOns) return es ? "sin maletas" : "no bags";
  const parts: string[] = [];
  if (large) parts.push(es ? `${large} ${large === 1 ? "maleta grande" : "maletas grandes"}` : `${large} large ${large === 1 ? "bag" : "bags"}`);
  if (carryOns) {
    // "1 de mano" only reads well after "maletas grandes"; alone it needs its noun.
    parts.push(
      es
        ? large
          ? `${carryOns} de mano`
          : `${carryOns} ${carryOns === 1 ? "maleta de mano" : "maletas de mano"}`
        : `${carryOns} ${carryOns === 1 ? "carry-on" : "carry-ons"}`,
    );
  }
  return parts.join(" + ");
}

/**
 * For drivers and the team: "4 grandes + 4 de mano" / "4 large + 4 carry-on". Bookings without a
 * carry-on count (older ones) show the one number as before; null when nothing was given.
 */
export function bagsForTeam(large: number | null | undefined, carryOns: number | null | undefined, lang: Lang): string | null {
  if (large == null && carryOns == null) return null;
  if (carryOns == null) return String(large);
  const es = lang === "es";
  return `${large ?? 0} ${es ? (large === 1 ? "grande" : "grandes") : "large"} + ${carryOns} ${es ? "de mano" : "carry-on"}`;
}

/**
 * Suitcases a vehicle class lists ("3 suitcases" / "3 maletas" → 3). The catalog text is free
 * (edited in /admin/pricing), so anything that doesn't start with a number gives null and no
 * hint is shown (e.g. the Sierpe boat combo's "Wet/dry assist").
 */
export function luggageCapacity(luggage: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})\s+\S/.exec(luggage ?? "");
  return m ? Number(m[1]) : null;
}
