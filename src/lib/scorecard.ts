/**
 * Driver scorecard (/admin/drivers/[id] and a compact column on /admin/drivers), team only.
 * Read-only sums from what the system already stores:
 *   - trips completed: bookings assigned to the driver with status "completed" (30 days = pickup in
 *     the last 30 days);
 *   - ratings: driver_reviews (plain average of the stars; the weighted average the matching uses
 *     is drivers.rating_avg) and the share that came with a written comment;
 *   - "alerts": completed trips where the lateness check fired (bookings.late_alert_at, src/lib/eta.ts).
 *     It fires once per booking when the live traffic estimate says the driver would arrive more than
 *     20 minutes after the pickup time, OR when the driver had shared no location 60 minutes before
 *     the pickup. The system doesn't record which of the two, nor the real arrival time, so this is
 *     "trips with a lateness alert", not proven lateness;
 *   - drop-outs: times the team removed or replaced this driver after assigning them, because the
 *     driver cancelled (booking_events "driver_removed", recorded from 2026-11-12; nothing before);
 *   - offers: bids sent and accepted;
 *   - paid out: the driver payout of their completed trips that were marked settled.
 *
 * Plain TypeScript without imports, so `npm run test:crm` runs it with Node.
 */

export interface ScoreTrip {
  status: string;
  scheduled_at: string | null;
  late_alert_at: string | null;
  driver_payout: number | string | null;
  driver_settled_at: string | null;
}
export interface ScoreReview {
  stars: number;
  comment: string | null;
}
export interface ScoreOffer {
  status: string;
}

export interface Scorecard {
  completed30: number;
  completedAll: number;
  ratingAvg: number | null;
  ratingCount: number;
  /** 0–100, null without ratings. */
  commentShare: number | null;
  /** Completed trips with a lateness alert. */
  alerts: number;
  /** 0–100 of completed trips without a lateness alert, null without completed trips. */
  onTimeShare: number | null;
  dropOuts: number;
  offersSent: number;
  offersAccepted: number;
  /** 0–100, null without offers. */
  acceptShare: number | null;
  paidOut: number;
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : null);

export function scorecard(
  trips: ScoreTrip[],
  reviews: ScoreReview[],
  offers: ScoreOffer[],
  dropOuts: number,
  now: Date = new Date(),
): Scorecard {
  const done = trips.filter((t) => t.status === "completed");
  const since = now.getTime() - 30 * 86_400_000;
  const completed30 = done.filter((t) => t.scheduled_at && Date.parse(t.scheduled_at) >= since && Date.parse(t.scheduled_at) <= now.getTime()).length;
  const alerts = done.filter((t) => t.late_alert_at).length;
  const stars = reviews.map((r) => r.stars).filter((s) => s >= 1 && s <= 5);
  const withComment = reviews.filter((r) => (r.comment ?? "").trim().length > 0).length;
  // Offers that were never withdrawn: what the driver actually put forward.
  const sent = offers.filter((o) => o.status !== "withdrawn").length;
  const accepted = offers.filter((o) => o.status === "accepted").length;
  const paidCents = done
    .filter((t) => t.driver_settled_at)
    .reduce((s, t) => s + Math.round(Number(t.driver_payout ?? 0) * 100), 0);
  return {
    completed30,
    completedAll: done.length,
    ratingAvg: stars.length ? Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 100) / 100 : null,
    ratingCount: stars.length,
    commentShare: pct(withComment, reviews.length),
    alerts,
    onTimeShare: pct(done.length - alerts, done.length),
    dropOuts,
    offersSent: sent,
    offersAccepted: accepted,
    acceptShare: pct(accepted, sent),
    paidOut: paidCents / 100,
  };
}
