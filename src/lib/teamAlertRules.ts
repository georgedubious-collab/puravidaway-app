/**
 * Rules for the team's phone alerts (Web Push, Jorge 2026-11-12: a night team that must hear
 * about problems without watching email). No server-only imports: the settings page and the
 * tests use these too. Sending is in src/lib/teamAlertCore.ts / src/lib/teamAlerts.ts.
 */

/** Every alert the team can get on their phones. The settings page shows them in this order. */
export const ALERT_KINDS = ["late_driver", "no_location", "no_driver", "tonight", "driver_removed", "low_rating", "new_request"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];
/** "test" is the button on the settings page: only the admin who pressed it, always. */
export type SendKind = AlertKind | "test";

export function isAlertKind(v: unknown): v is AlertKind {
  return typeof v === "string" && (ALERT_KINDS as readonly string[]).includes(v);
}

/** Labels for the settings page (Spanish first, as on every team page). */
export const ALERT_KIND_LABELS: Record<AlertKind, { es: string; en: string; hintEs: string; hintEn: string }> = {
  late_driver: {
    es: "Conductor atrasado",
    en: "Late driver",
    hintEs: "Con el tráfico actual llegaría más de 20 min tarde a la recogida.",
    hintEn: "With current traffic they'd reach the pickup more than 20 min late.",
  },
  no_location: {
    es: "Sin ubicación del conductor",
    en: "No driver location",
    hintEs: "Falta 1 hora o menos para la recogida y el conductor no comparte su ubicación.",
    hintEn: "Pickup within 1 hour and the driver isn't sharing their location.",
  },
  no_driver: {
    es: "Viaje sin conductor",
    en: "Trip without a driver",
    hintEs: "Faltan 12 horas o menos para la recogida y todavía no hay conductor asignado.",
    hintEn: "Pickup within 12 hours and no driver assigned yet.",
  },
  tonight: {
    es: "Reserva nueva para hoy",
    en: "New booking for tonight",
    hintEs: "Llega una solicitud con recogida dentro de las próximas 12 horas.",
    hintEn: "A request comes in with a pickup within the next 12 hours.",
  },
  driver_removed: {
    es: "Conductor retirado",
    en: "Driver dropped out",
    hintEs: "Se quitó o reemplazó al conductor de un viaje (no le llega a quien hizo el cambio).",
    hintEn: "A trip's driver was removed or replaced (not sent to whoever made the change).",
  },
  low_rating: {
    es: "Calificación baja",
    en: "Low rating",
    hintEs: "Un viajero calificó con 3 estrellas o menos.",
    hintEn: "A traveller rated 3 stars or less.",
  },
  new_request: {
    es: "Solicitudes nuevas",
    en: "New requests",
    hintEs: "Cualquier otra solicitud nueva desde la web o la app (recogida en más de 12 horas).",
    hintEn: "Any other new request from the website or app (pickup more than 12 hours away).",
  },
};

export interface AlertPrefs {
  muted_kinds: string[];
  /** Costa Rica hours 0–23; both set = no pushes from start until end (may cross midnight). */
  quiet_start: number | null;
  quiet_end: number | null;
}

/** Costa Rica is UTC−6 all year (no daylight saving). */
export function costaRicaHour(at: Date): number {
  return (at.getUTCHours() + 24 - 6) % 24;
}

export function inQuietHours(p: AlertPrefs | null, at: Date): boolean {
  if (!p || p.quiet_start === null || p.quiet_end === null || p.quiet_start === p.quiet_end) return false;
  const h = costaRicaHour(at);
  return p.quiet_start < p.quiet_end ? h >= p.quiet_start && h < p.quiet_end : h >= p.quiet_start || h < p.quiet_end;
}

/** Does this admin want this alert on their phones right now? No settings saved = everything, always. */
export function wantsAlert(p: AlertPrefs | null, kind: AlertKind, at: Date): boolean {
  if (!p) return true;
  if (p.muted_kinds.includes(kind)) return false;
  return !inQuietHours(p, at);
}

/** "Tonight": a pickup from now until 12 hours from now. */
export const TONIGHT_HOURS = 12;
export function isTonight(scheduledAt: string | null | undefined, now: Date): boolean {
  if (!scheduledAt) return false;
  const ms = new Date(scheduledAt).getTime() - now.getTime();
  return Number.isFinite(ms) && ms >= 0 && ms <= TONIGHT_HOURS * 3600000;
}

/** Give a brand-new booking this long before the "no driver" alert (the "tonight" alert already went out). */
export const NO_DRIVER_GRACE_MIN = 30;
const OPEN_STATUSES = ["pending_payment", "pending_bids", "confirmed"];

export interface UnassignedRow {
  id: string;
  status: string;
  assigned_driver_id: string | null;
  scheduled_at: string | null;
  created_at: string;
  no_driver_alert_at: string | null;
}

/** Bookings that need the "trip without a driver" alert now (once each: no_driver_alert_at). */
export function pickupsWithoutDriver<T extends UnassignedRow>(rows: T[], now: Date): T[] {
  return rows.filter(
    (b) =>
      OPEN_STATUSES.includes(b.status) &&
      !b.assigned_driver_id &&
      !b.no_driver_alert_at &&
      isTonight(b.scheduled_at, now) &&
      now.getTime() - new Date(b.created_at).getTime() >= NO_DRIVER_GRACE_MIN * 60000,
  );
}

/** "M." from "María López": never the full name, never anything that looks like an email or phone. */
export function guestInitial(name: string | null | undefined): string {
  const m = (name ?? "").trim().match(/\p{L}/u);
  return m ? `${m[0].toUpperCase()}.` : "";
}

export interface AlertFacts {
  ref: string;
  route: string;
  when: string;
  guestName?: string | null;
  driver?: string | null;
  lateMin?: number;
  /** Minutes until the pickup. */
  minutes?: number;
  stars?: number;
  /** Items in one request. */
  count?: number;
  reason?: "driver_dropped" | "team";
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * The short Spanish text on the lock screen. Ref + route + time, the traveller's initial at
 * most; never the traveller's phone, email or full name (a lock screen can be seen by anyone).
 */
export function alertText(kind: SendKind, f: AlertFacts): { title: string; body: string } {
  const who = guestInitial(f.guestName);
  const trip = clip(`${f.route} · ${f.when}${who ? ` · ${who}` : ""}`, 150);
  const d = f.driver ? clip(f.driver, 40) : "El conductor";
  let title: string;
  let body: string;
  switch (kind) {
    case "late_driver":
      title = `Conductor atrasado · ${f.ref}`;
      body = `${d} llegaría ~${f.lateMin ?? "?"} min tarde. ${trip}`;
      break;
    case "no_location":
      title = `Sin ubicación del conductor · ${f.ref}`;
      body = `Recogida en ${Math.max(0, f.minutes ?? 0)} min y ${f.driver ? d : "el conductor"} no comparte su ubicación. Llámelo. ${trip}`;
      break;
    case "no_driver":
      title = `Sin conductor · ${f.ref}`;
      body = `Recogida en ${formatIn(f.minutes)} y no hay conductor asignado. ${trip}`;
      break;
    case "tonight":
      title = `Reserva para hoy · ${f.ref}`;
      body = `Nueva solicitud con recogida en ${formatIn(f.minutes)}${f.count && f.count > 1 ? ` (${f.count} servicios)` : ""}. ${trip}`;
      break;
    case "driver_removed":
      title = `Conductor retirado · ${f.ref}`;
      body = `${d} ${f.reason === "driver_dropped" ? "se retiró del viaje" : "fue retirado por el equipo"}. Revise la asignación. ${trip}`;
      break;
    case "low_rating":
      title = `Calificación baja (${f.stars ?? "?"}★) · ${f.ref}`;
      body = `Conductor: ${d}. ${trip}`;
      break;
    case "new_request":
      title = `Solicitud nueva · ${f.ref}`;
      body = `${f.count && f.count > 1 ? `${f.count} servicios. ` : ""}${trip}`;
      break;
    case "test":
      title = "Prueba de alertas";
      body = "Las alertas del equipo llegan a este teléfono.";
      break;
  }
  return { title: clip(title, 80), body: clip(body, 240) };
}

function formatIn(minutes: number | undefined): string {
  const m = Math.max(0, Math.round(minutes ?? 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Read the settings form: ticked boxes are "on"; quiet hours only when both ends are valid. */
export function parsePrefsForm(fd: { get(name: string): unknown }): AlertPrefs {
  const muted_kinds = ALERT_KINDS.filter((k) => fd.get(`kind_${k}`) !== "on");
  const hour = (v: unknown) => {
    const s = String(v ?? "");
    if (!/^\d{1,2}$/.test(s)) return null;
    const n = Number(s);
    return n >= 0 && n <= 23 ? n : null;
  };
  const a = hour(fd.get("quiet_start"));
  const b = hour(fd.get("quiet_end"));
  return a === null || b === null || a === b ? { muted_kinds, quiet_start: null, quiet_end: null } : { muted_kinds, quiet_start: a, quiet_end: b };
}
