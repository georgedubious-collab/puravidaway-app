/**
 * The job board's posting window (Jorge, 2026-11-12; migration 0054, docs/PROJECT.md §6.3):
 *   - a booking posted to the drivers ("Abierta para conductores", status pending_bids) is open
 *     for offers for 1 hour (bookings.posting_closes_at). After that drivers no longer see it and
 *     can't offer (driver_jobs() / offer_job() check the time in the database); the status stays
 *     pending_bids, so the admin still shows it as needing a driver, and offers received during the
 *     hour can still be accepted;
 *   - "Volver a publicar" (repost_job()) opens a new hour and alerts the drivers again;
 *   - 48 hours before pickup a booking still without a driver is posted again by itself, once
 *     (auto_repost_jobs(), from the 5-minute check). Not between 9 PM and 7 AM Costa Rica time: a
 *     repost that comes due at night waits for the first check after 7 AM, so the hour falls when
 *     drivers are awake (the same quiet hours as the other automatic messages).
 *
 * Plain TypeScript (only the quiet-hours rule imported), so `npm run test:dispatch` runs it with Node.
 */
import { isQuietHour } from "./reviewReminder";

/** How long a posting stays open for offers. Same value as in migration 0054. */
export const POSTING_WINDOW_MINUTES = 60;
/** The automatic repost happens this many hours before pickup. Same value as in migration 0054. */
export const AUTO_REPOST_HOURS = 48;

export type PostingState = "open" | "closed";

export interface PostingFields {
  status: string;
  posting_closes_at?: string | null;
}

/**
 * "open" while the posting is on the job board, "closed" once its hour is over (or for a booking
 * posted before the window existed), null for a booking that isn't open for drivers.
 */
export function postingState(b: PostingFields, nowMs: number): PostingState | null {
  if (b.status !== "pending_bids") return null;
  const closes = b.posting_closes_at ? new Date(b.posting_closes_at).getTime() : NaN;
  return Number.isFinite(closes) && closes > nowMs ? "open" : "closed";
}

/** Whole minutes left in an open posting (at least 1), or 0. */
export function postingMinutesLeft(b: PostingFields, nowMs: number): number {
  if (postingState(b, nowMs) !== "open") return 0;
  return Math.max(1, Math.ceil((new Date(b.posting_closes_at!).getTime() - nowMs) / 60000));
}

/** "Volver a publicar" is offered: closed posting, no driver, payout set, pickup still ahead. */
export function canRepost(
  b: PostingFields & { assigned_driver_id: string | null; driver_payout?: number | string | null; scheduled_at: string | null },
  nowMs: number,
): boolean {
  if (postingState(b, nowMs) !== "closed" || b.assigned_driver_id || b.driver_payout == null) return false;
  const at = b.scheduled_at ? new Date(b.scheduled_at).getTime() : NaN;
  return Number.isFinite(at) && at > nowMs;
}

/** Short words for the team: "Publicación cerrada · 2 ofertas" / "Abierta · quedan 35 min". */
export function postingLabel(state: PostingState, offers: number, minutesLeft: number, lang: "es" | "en"): string {
  const o = lang === "en" ? `${offers} offer${offers === 1 ? "" : "s"}` : `${offers} ${offers === 1 ? "oferta" : "ofertas"}`;
  if (state === "closed") return lang === "en" ? `Posting closed · ${o}` : `Publicación cerrada · ${o}`;
  return lang === "en" ? `Open · ${minutesLeft} min left · ${o}` : `Abierta · quedan ${minutesLeft} min · ${o}`;
}

export interface AutoRepostDeps {
  /** Claims and reposts the due bookings in the database (auto_repost_jobs()); returns their ids. */
  claim: () => Promise<string[]>;
  /** Sends the new-job alerts to the drivers (src/lib/jobAlerts.ts). */
  notify: (ids: string[]) => Promise<void>;
}

/**
 * One run of the automatic repost (from /api/cron/eta every 5 minutes). Nothing at night (Costa
 * Rica 9 PM–7 AM): the bookings are still due at the first run after 7 AM. Returns how many
 * bookings were posted again.
 */
export async function runAutoRepost(deps: AutoRepostDeps, now: Date): Promise<number> {
  if (isQuietHour(now)) return 0;
  const ids = await deps.claim();
  if (ids.length) await deps.notify(ids);
  return ids.length;
}
