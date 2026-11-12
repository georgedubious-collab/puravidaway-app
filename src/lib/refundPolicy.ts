/**
 * The refund calculator on the booking page ("Cancelar reserva"), from the published
 * cancellation policy (/cancellation and /es/cancelacion, decided by Jorge 2026-11-08,
 * docs/PROJECT.md §9 #7):
 *   - Rides and day tours: the traveller cancels 24 hours or more before pickup → full refund.
 *   - Less than 24 hours before pickup, or no-show → no refund.
 *   - We or the driver cancel → full refund of what they paid us.
 *   - Weather, road or park closure → rebooking or a refund of the affected service. The
 *     calculator proposes the full refund; if only part is affected (or they rebook), the team
 *     changes the amount and writes why.
 *   - Cash (pay-the-driver) bookings: the same limits; the cash-booking fee is non-refundable
 *     within 24 h. The refund is always of what we actually received, so a cash booking where
 *     nothing was received refunds $0.
 * Times count from the confirmed pickup; the moment the traveller's message reached us counts.
 *
 * Plain TypeScript without imports, so `npm run test:crm` runs it with Node.
 */

export type CancelledBy = "traveller" | "team" | "driver" | "weather";
export type RefundRule = "free_24h" | "late_or_no_show" | "we_cancelled" | "weather";

export const CANCELLED_BY: readonly CancelledBy[] = ["traveller", "team", "driver", "weather"];
export const REFUND_METHODS = ["card", "sinpe", "transfer", "cash"] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];

/** Free cancellation limit, in hours before pickup ("24 hours or more"). */
export const FREE_CANCEL_HOURS = 24;

const HOUR_MS = 3_600_000;

export interface RefundInput {
  by: CancelledBy;
  /** Pickup time (ISO). */
  pickupAt: string | null;
  /** When the traveller's message reached us (ISO); "now" when the team cancels on the spot. */
  askedAt: string;
  /** Amount received from the traveller, USD. */
  amountReceived: number;
  /** The traveller didn't show up (only for "traveller"). */
  noShow?: boolean;
}

export interface RefundResult {
  /** USD, 2 decimals, never more than the amount received. */
  refund: number;
  rule: RefundRule;
  /** Hours between the request and the pickup (negative after the pickup); null without a pickup time. */
  hoursBefore: number | null;
}

const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100);

export function hoursBefore(pickupAt: string | null, askedAt: string): number | null {
  if (!pickupAt) return null;
  const p = Date.parse(pickupAt);
  const a = Date.parse(askedAt);
  if (!Number.isFinite(p) || !Number.isFinite(a)) return null;
  return Math.round(((p - a) / HOUR_MS) * 100) / 100;
}

/** The refund the policy gives. */
export function refundByPolicy(i: RefundInput): RefundResult {
  const received = Math.max(0, cents(i.amountReceived)) / 100;
  const h = hoursBefore(i.pickupAt, i.askedAt);
  if (i.by === "team" || i.by === "driver") return { refund: received, rule: "we_cancelled", hoursBefore: h };
  if (i.by === "weather") return { refund: received, rule: "weather", hoursBefore: h };
  // The traveller: exactly 24 h before still counts as "24 hours or more" (compared in ms).
  const p = i.pickupAt ? Date.parse(i.pickupAt) : NaN;
  const a = Date.parse(i.askedAt);
  const early = !i.noShow && Number.isFinite(p) && Number.isFinite(a) && p - a >= FREE_CANCEL_HOURS * HOUR_MS;
  return early ? { refund: received, rule: "free_24h", hoursBefore: h } : { refund: 0, rule: "late_or_no_show", hoursBefore: h };
}

/** The rule that applied, in the team's language. */
export function ruleText(rule: RefundRule, lang: "es" | "en"): string {
  const es = lang === "es";
  switch (rule) {
    case "free_24h":
      return es
        ? "El viajero canceló 24 horas o más antes de la recogida: reembolso completo."
        : "The traveller cancelled 24 hours or more before pickup: full refund.";
    case "late_or_no_show":
      return es
        ? "El viajero canceló con menos de 24 horas o no se presentó: sin reembolso (el cargo por reserva en efectivo tampoco se devuelve)."
        : "The traveller cancelled less than 24 hours before pickup, or didn't show up: no refund (the cash-booking fee isn't refunded either).";
    case "we_cancelled":
      return es
        ? "Cancelamos nosotros o el conductor: reembolso completo de lo que pagó."
        : "We or the driver cancelled: full refund of what they paid.";
    case "weather":
      return es
        ? "Clima, cierre de carretera o de parque: se ofrece otra fecha o el reembolso del servicio afectado. Si solo una parte se afectó o prefiere otra fecha, cambie el monto y explique por qué."
        : "Weather, road or park closure: offer another date or a refund of the affected service. If only part was affected or they rebook, change the amount and say why.";
  }
}

export function cancelledByText(by: CancelledBy, lang: "es" | "en"): string {
  const es = lang === "es";
  return {
    traveller: es ? "El viajero" : "The traveller",
    team: es ? "Nosotros (el equipo)" : "Us (the team)",
    driver: es ? "El conductor" : "The driver",
    weather: es ? "Clima, carretera o parque cerrado" : "Weather, road or park closure",
  }[by];
}

export function refundMethodText(m: string, lang: "es" | "en"): string {
  const es = lang === "es";
  return (
    { card: es ? "Tarjeta" : "Card", sinpe: "SINPE Móvil", transfer: es ? "Transferencia" : "Bank transfer", cash: es ? "Efectivo" : "Cash" } as Record<string, string>
  )[m] ?? m;
}

/** "2026-11-12T08:30" typed in a datetime-local box, as Costa Rica time (UTC−6, no daylight saving). */
export function crLocalToIso(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const ms = Date.parse(`${v}:00-06:00`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** The other way: an instant shown in a datetime-local box, Costa Rica time. */
export function isoToCrLocal(iso: string): string {
  const ms = Date.parse(iso);
  return new Date(ms - 6 * HOUR_MS).toISOString().slice(0, 16);
}

/** Money typed by the team ("45", "45.5", "45.50"), or null. */
export function parseMoney(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

/**
 * Check what the team confirmed before cancelling: the refund owed can't be negative or more than
 * what was received, and a refund that differs from the policy needs a reason (3+ characters).
 * Returns a problem in the team's language, or null.
 */
export function refundProblem(due: number | null, policy: number, received: number, reason: string, lang: "es" | "en"): string | null {
  const es = lang === "es";
  if (due === null) return es ? "Escriba el reembolso como 45 o 45.50." : "Write the refund like 45 or 45.50.";
  if (cents(due) > cents(received))
    return es ? "El reembolso no puede ser mayor que lo recibido." : "The refund can't be more than what was received.";
  if (cents(due) !== cents(policy) && reason.trim().length < 3)
    return es
      ? "El reembolso es distinto al de la política: escriba el motivo."
      : "The refund differs from the policy: write the reason.";
  return null;
}
