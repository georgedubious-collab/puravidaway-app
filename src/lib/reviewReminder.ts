/**
 * The rules of the single "please rate your driver" reminder, kept apart from the
 * database and the sending so they can be checked by `npm run test:reviews`
 * (scripts/test-review-reminder.mjs). The job is src/app/api/cron/review-reminders.
 *
 * Jorge, 2026-11-11: the traveller is asked as soon as the trip ends
 * (src/lib/reviewRequest.ts). If they haven't rated 24 hours later they get ONE
 * reminder (push to the app + email), never a second one, and never between
 * 9 PM and 7 AM Costa Rica time: a reminder that comes due at night waits for
 * the first check after 7 AM.
 */

/** Hours between the rating request (sent when the trip is completed) and the reminder. */
export const REMINDER_AFTER_HOURS = 24;
/** No reminder from this hour (Costa Rica time)… */
export const QUIET_FROM_HOUR = 21;
/** …until this hour. */
export const QUIET_UNTIL_HOUR = 7;

/** Costa Rica is UTC−6 all year (no daylight saving). */
const CR_OFFSET_MS = 6 * 3600 * 1000;

/** The hour of the day in Costa Rica, 0–23. */
export function costaRicaHour(now: Date): number {
  return new Date(now.getTime() - CR_OFFSET_MS).getUTCHours();
}

/** True from 9 PM up to, not including, 7 AM Costa Rica time. */
export function isQuietHour(now: Date): boolean {
  const h = costaRicaHour(now);
  return h >= QUIET_FROM_HOUR || h < QUIET_UNTIL_HOUR;
}

/** Bookings asked for a rating before this moment are due their reminder. */
export function reminderCutoff(now: Date): Date {
  return new Date(now.getTime() - REMINDER_AFTER_HOURS * 3600 * 1000);
}

export interface ReminderCandidate {
  id: string;
  status: string;
  /** When the rating request went out (the trip was completed). */
  review_requested_at: string | null;
  /** Set once the reminder was sent, or once we saw the trip was already rated. */
  review_reminded_at: string | null;
}

export interface ReminderPlan {
  /** Quiet hours: nothing is sent or marked now; the next check after 7 AM picks these up. */
  quiet: boolean;
  /** Send the one reminder (mark first, then send). */
  remind: string[];
  /** Already rated: mark as done so they never come up again; nothing is sent. */
  markOnly: string[];
}

/**
 * Which bookings get the reminder now. A booking is due when its trip is
 * completed, the rating request went out 24+ hours ago and no reminder was ever
 * recorded. Of those, the ones already rated are only marked; the rest are
 * reminded, unless it is night in Costa Rica.
 */
export function planReviewReminders(now: Date, candidates: ReminderCandidate[], ratedIds: Iterable<string>): ReminderPlan {
  const rated = new Set(ratedIds);
  const cutoff = reminderCutoff(now).getTime();
  const due = candidates.filter((b) => {
    if (b.status !== "completed" || !b.review_requested_at || b.review_reminded_at) return false;
    const asked = new Date(b.review_requested_at).getTime();
    return Number.isFinite(asked) && asked <= cutoff;
  });
  const markOnly = due.filter((b) => rated.has(b.id)).map((b) => b.id);
  const quiet = isQuietHour(now);
  return { quiet, markOnly, remind: quiet ? [] : due.filter((b) => !rated.has(b.id)).map((b) => b.id) };
}

/**
 * A rating as the traveller sends it: 1–5 stars are required; the words are
 * optional (a blank comment is stored as none). `hasContactDetails` is the
 * shared phone / email / link check. Messages are the English originals
 * (translated for the page by src/lib/serverMessagesEs.ts).
 */
export function parseRating(
  starsRaw: unknown,
  commentRaw: unknown,
  hasContactDetails: (text: string) => boolean,
): { ok: true; stars: number; comment: string | null } | { ok: false; error: string } {
  const stars = Number(starsRaw);
  const comment = String(commentRaw ?? "").trim().slice(0, 1000);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, error: "Pick 1 to 5 stars." };
  if (comment && hasContactDetails(comment)) return { ok: false, error: "Please keep phone numbers, emails and links out of the review." };
  return { ok: true, stars, comment: comment || null };
}
