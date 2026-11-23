import "server-only";
import type { Email } from "./emailHtml";
import { sendEmail } from "./email";
import { createSupabaseAdminClient } from "./supabase/admin";
import type { AlertInput } from "./teamAlertCore";
import { sendTeamAlert } from "./teamAlerts";
import type { AlertKind } from "./teamAlertRules";

/**
 * New-request messages that wait for the card (Jorge, 2026-11-22; migration 0062).
 *
 * A traveller who pays online by card (Stripe) goes to Stripe's page right after the request is
 * saved. The usual messages — the team's "new trip request" email + push and the traveller's
 * "we got your request" email — are prepared then but kept in trip_request_notices, and sent:
 *   - once the card is held (sendHeldNotices, from src/lib/stripePayments.ts);
 *   - or, if it isn't within 30 minutes (Stripe's page has expired by then), the team gets one
 *     "unpaid request" alert instead and the traveller their request email, which says how to pay
 *     from the trip page (sendUnpaidNotices, every 5 minutes from /api/cron/card-holds).
 * A traveller who pays later still triggers the team's normal alert. Each message goes once.
 */

export const UNPAID_AFTER_MINUTES = 30;

export interface RequestNotices {
  /** The traveller's "we got your request" email (null: not sent, e.g. entered by the team). */
  traveller: Email | null;
  /** The team's usual alert (email + push). */
  team: { kind: AlertKind; input: AlertInput<Email> };
  /** The team's alert when the card wasn't held in time. */
  unpaid: AlertInput<Email>;
}

/** Keep the messages until the card is held. False if they couldn't be saved (send them now instead). */
export async function holdRequestNotices(tripId: string, notices: RequestNotices): Promise<boolean> {
  const db = createSupabaseAdminClient();
  if (!db) return false;
  const { error } = await db.from("trip_request_notices").insert({ trip_id: tripId, payload: notices });
  if (error) console.error("[request notices] save failed", error.message);
  return !error;
}

/** Mark one column sent, once: true only for the call that set it. */
async function claim(tripId: string, column: "team_sent_at" | "traveller_sent_at" | "unpaid_alert_at") {
  const db = createSupabaseAdminClient();
  if (!db) return null;
  const { data } = await db
    .from("trip_request_notices")
    .update({ [column]: new Date().toISOString() })
    .eq("trip_id", tripId)
    .is(column, null)
    .select("payload");
  return (data?.[0]?.payload as RequestNotices | undefined) ?? null;
}

/** The card is held (or charged): the team's alert and the traveller's email, each once. */
export async function sendHeldNotices(tripId: string): Promise<void> {
  const team = await claim(tripId, "team_sent_at");
  if (team) await sendTeamAlert(team.team.kind, team.team.input);
  const trav = await claim(tripId, "traveller_sent_at");
  if (trav?.traveller) await sendEmail(trav.traveller);
}

/** Requests whose card wasn't held within 30 minutes: "unpaid request" to the team, the request email to the traveller. */
export async function sendUnpaidNotices(now = new Date()): Promise<number> {
  const db = createSupabaseAdminClient();
  if (!db) return 0;
  const before = new Date(now.getTime() - UNPAID_AFTER_MINUTES * 60_000).toISOString();
  const { data } = await db
    .from("trip_request_notices")
    .select("trip_id")
    .is("team_sent_at", null)
    .is("unpaid_alert_at", null)
    .lt("created_at", before)
    .limit(50);
  let sent = 0;
  for (const r of data ?? []) {
    const tripId = r.trip_id as string;
    const n = await claim(tripId, "unpaid_alert_at");
    if (!n) continue;
    await sendTeamAlert("new_request", n.unpaid);
    const trav = await claim(tripId, "traveller_sent_at");
    if (trav?.traveller) await sendEmail(trav.traveller);
    sent++;
  }
  return sent;
}
