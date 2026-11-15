/** Small display helpers shared by the admin panel, bookings list and CSV export. */
import type { BookingRow } from "./bookings";
import { bookedItemName } from "./catalog";
import type { CatalogData } from "./catalogModel";
import { addDays, formatShortDate, formatTime12h, scheduledParts } from "./dates";
import type { TeamLang } from "./teamLang";
import { jobClassLabel } from "./vehicleEligibility";

/** "Hoy" / "Mañana" / "jue, 14 nov" and "6:30 a. m." for a pickup, in Costa Rica time. */
export function pickupDay(iso: string | null | undefined, today: string, lang: TeamLang): { day: string; time: string; ymd: string } {
  const p = scheduledParts(iso);
  if (!p) return { day: "—", time: "", ymd: "" };
  const day =
    p.ymd === today
      ? lang === "en" ? "Today" : "Hoy"
      : p.ymd === addDays(today, 1)
        ? lang === "en" ? "Tomorrow" : "Mañana"
        : formatShortDate(p.ymd, lang);
  return { day, time: formatTime12h(p.time, lang), ymd: p.ymd };
}

/**
 * First part of a place ("Arenas Del Mar Resort" of "Arenas Del Mar Resort, Rd to …"), skipping a
 * Google plus code ("X5C9+HMQ, P.º de los Turistas, …" → "P.º de los Turistas").
 */
export function shortPlace(s: string | null | undefined): string {
  const parts = (s ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const first = parts.find((p) => !/^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}$/i.test(p));
  return first ?? parts[0] ?? "—";
}

/** "SJO Airport → La Fortuna" for rides, the tour's name for tours. */
export function bookingTitle(
  b: Pick<BookingRow, "service_type" | "origin" | "destination" | "catalog_item_id">,
  catalog: Pick<CatalogData, "dayTours">,
  lang: TeamLang,
  short = true,
): string {
  if (b.service_type === "transfer") {
    return short ? `${shortPlace(b.origin)} → ${shortPlace(b.destination)}` : `${b.origin ?? "—"} → ${b.destination ?? "—"}`;
  }
  return bookedItemName(catalog.dayTours, b.catalog_item_id, lang) ?? b.catalog_item_id ?? "—";
}

/** The booked vehicle class as the team knows it ("Minivan (MPV)"); "—" on tours. */
export function vehicleClassName(cls: string | null | undefined, catalog: Pick<CatalogData, "vehicles">, lang: TeamLang): string {
  if (!cls) return "—";
  return catalog.vehicles.find((v) => v.id === cls)?.name ?? jobClassLabel(cls, lang);
}
