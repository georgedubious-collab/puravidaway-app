/**
 * The admin on a phone (Jorge approved the mockup 2026-11-13): which action the booking page's
 * sticky bottom bar offers first, the fields of "Publicar para conductores", and the next step
 * Inicio's "Necesita atención" cards show. Plain functions, so `npm run test:crm` checks them.
 *
 * "Publicar para conductores" is not a new path: it sends the booking page's own form action
 * (updateBooking in src/app/admin/bookings/actions.ts) with status pending_bids and no driver,
 * exactly what picking "Abierta para conductores" in "Asignación y estado" does. That action
 * alerts the drivers (notifyDriversOfJobs) and the database opens the 1-hour posting window
 * (migration 0054 trigger).
 */
import { canRepost, postingState } from "./postingWindow";
import { isLiveTrip } from "./liveTrips";

export type PrimaryAction = "publish" | "repost" | "offers" | "assign" | "whatsapp" | "none";
export type SecondaryAction = "assign" | "edit" | "map";

export interface ActionBooking {
  status: string;
  assigned_driver_id: string | null;
  driver_payout?: number | string | null;
  scheduled_at: string | null;
  posting_closes_at?: string | null;
  en_route_at?: string | null;
}

export interface ActionContext {
  /** Drivers' offers still waiting (bids with status submitted). */
  openOffers: number;
  now: number;
  /** The traveller has a WhatsApp number (the team's message buttons work). */
  hasWhatsApp: boolean;
  /** The pickup / time can still be changed (canEditPlaces, a ride or a day tour). */
  canEdit: boolean;
}

const ahead = (b: ActionBooking, now: number) => {
  const at = b.scheduled_at ? new Date(b.scheduled_at).getTime() : NaN;
  return Number.isFinite(at) && at > now;
};

/** Whether "Publicar para conductores" is offered: no driver, not on the board, payout set, pickup ahead. */
export function canPublish(b: ActionBooking, now: number): boolean {
  return (
    !b.assigned_driver_id &&
    (b.status === "pending_payment" || b.status === "confirmed") &&
    b.driver_payout != null &&
    ahead(b, now)
  );
}

/**
 * The big green button, by the booking's state:
 *   no driver, offers waiting        → "Ver ofertas" (scrolls to the offers; accept one there)
 *   no driver, posting closed        → "Volver a publicar" (the existing repost)
 *   no driver, not on the job board  → "Publicar para conductores" (payout set, pickup ahead)
 *   no driver, anything else         → "Asignar conductor"
 *   with a driver                    → "Mensajes de WhatsApp" when the traveller has a number
 *   cancelled / completed            → nothing big
 */
export function primaryAction(b: ActionBooking, ctx: ActionContext): PrimaryAction {
  if (b.status === "cancelled" || b.status === "completed") return "none";
  if (!b.assigned_driver_id) {
    if (ctx.openOffers > 0 && b.status === "pending_bids") return "offers";
    if (b.status === "pending_bids") return canRepost(b, ctx.now) ? "repost" : "assign";
    if (canPublish(b, ctx.now)) return "publish";
    return "assign";
  }
  return ctx.hasWhatsApp ? "whatsapp" : "none";
}

/** The smaller buttons under it: assign (or change) the driver, change pickup / time, the live map. */
export function secondaryActions(b: ActionBooking, ctx: ActionContext): SecondaryAction[] {
  if (b.status === "cancelled") return [];
  const out: SecondaryAction[] = [];
  if (b.status !== "completed" && primaryAction(b, ctx) !== "assign") out.push("assign");
  if (ctx.canEdit) out.push("edit");
  if (isLiveTrip(b, ctx.now)) out.push("map");
  return out;
}

/**
 * The hidden fields of "Publicar para conductores": the booking page's updateBooking action with
 * status pending_bids and nobody assigned (the amount received and the notes are not sent, so they
 * keep their values; see "a field that isn't sent keeps its value" in updateBooking).
 */
export function publishFields(bookingId: string): [string, string][] {
  return [
    ["id", bookingId],
    ["status", "pending_bids"],
    ["assignment", ""],
  ];
}

export type NextStep = "choose_offer" | "repost" | "publish" | "waiting" | "assign";

/** The next step a "Necesita atención" card names for a booking without a driver. */
export function nextStep(b: ActionBooking, openOffers: number, now: number): NextStep {
  if (b.status === "pending_bids") {
    if (openOffers > 0) return "choose_offer";
    if (postingState(b, now) === "open") return "waiting";
    return canRepost(b, now) ? "repost" : "assign";
  }
  return canPublish(b, now) ? "publish" : "assign";
}

export function nextStepText(s: NextStep, lang: "es" | "en"): string {
  const T: Record<NextStep, [string, string]> = {
    choose_offer: ["Elegir una oferta", "Choose an offer"],
    repost: ["Volver a publicar", "Post it again"],
    publish: ["Publicar para conductores", "Post to drivers"],
    waiting: ["Esperando ofertas", "Waiting for offers"],
    assign: ["Asignar conductor", "Assign a driver"],
  };
  return T[s][lang === "en" ? 1 : 0];
}
