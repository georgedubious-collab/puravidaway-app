import { wantsAlert, type AlertPrefs, type SendKind } from "./teamAlertRules";
import { sendWebPush, type VapidKeys } from "./webPush";

/**
 * The one team-alert sender, without the database or Vercel settings wired in (those are in
 * src/lib/teamAlerts.ts), so the tests can run it with a store in memory.
 *
 *   1. Once only: with a dedupeKey, the alert is claimed first (team_alerts has one row per
 *      kind + key); a second call with the same key sends nothing.
 *   2. Email to the team address, as before (when the caller passes one).
 *   3. Web Push to every admin phone that asked for this kind and isn't in its quiet hours.
 *      A push service answering 404/410 means that phone is gone: the subscription is deleted.
 */

export interface Recipient {
  admin_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  prefs: AlertPrefs | null;
}

export interface AlertStore {
  claim(kind: SendKind, key: string, meta: { title: string; body: string; url: string }): Promise<boolean>;
  recipients(): Promise<Recipient[]>;
  markSent(endpoint: string): Promise<void>;
  markFailed(endpoint: string): Promise<void>;
  remove(endpoint: string): Promise<void>;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Opened when the notification is tapped: a path under /admin. */
  url: string;
}

export interface AlertDeps<E> {
  store: AlertStore;
  vapid: VapidKeys | null;
  sendEmail: (e: E) => Promise<boolean>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface AlertInput<E> {
  push: PushMessage;
  email?: E | null;
  /** Same kind + key twice → the second call sends nothing. */
  dedupeKey?: string;
  /** Don't push the admin who caused it (e.g. the one who removed a driver). */
  exceptAdminId?: string | null;
  /** The test button: only this admin, ignoring their toggles and quiet hours. */
  onlyAdminId?: string | null;
}

export interface AlertResult {
  duplicate: boolean;
  emailed: boolean;
  pushed: number;
}

/** Never throws: an alert that fails must not break a booking, a rating or a cron run. */
export async function deliverTeamAlert<E>(deps: AlertDeps<E>, kind: SendKind, input: AlertInput<E>): Promise<AlertResult> {
  const out: AlertResult = { duplicate: false, emailed: false, pushed: 0 };
  try {
    if (input.dedupeKey && !(await deps.store.claim(kind, input.dedupeKey, input.push))) {
      out.duplicate = true;
      return out;
    }
    const [emailed, pushed] = await Promise.all([
      input.email ? deps.sendEmail(input.email).catch(() => false) : Promise.resolve(false),
      pushToTeam(deps, kind, input),
    ]);
    out.emailed = emailed;
    out.pushed = pushed;
  } catch (e) {
    console.error("[team alert]", kind, e instanceof Error ? e.message : e);
  }
  return out;
}

async function pushToTeam<E>(deps: AlertDeps<E>, kind: SendKind, input: AlertInput<E>): Promise<number> {
  if (!deps.vapid) return 0;
  const now = deps.now?.() ?? new Date();
  const all = await deps.store.recipients();
  const targets = all.filter((r) => {
    if (input.onlyAdminId) return r.admin_id === input.onlyAdminId;
    if (kind === "test") return false;
    if (input.exceptAdminId && r.admin_id === input.exceptAdminId) return false;
    return wantsAlert(r.prefs, kind, now);
  });
  if (!targets.length) return 0;
  // Same tag = a newer alert about the same thing replaces the older one on the lock screen.
  const payload = JSON.stringify({ ...input.push, tag: `${kind}:${input.dedupeKey ?? input.push.url}`.slice(0, 120) });
  const results = await Promise.all(
    targets.map(async (r) => {
      const res = await sendWebPush(r, payload, deps.vapid!, {
        fetchImpl: deps.fetchImpl,
        urgency: kind === "new_request" ? "normal" : "high",
        ttlSeconds: kind === "test" ? 600 : 6 * 3600,
      });
      if (res.outcome === "sent") await deps.store.markSent(r.endpoint);
      else if (res.outcome === "gone") await deps.store.remove(r.endpoint);
      else await deps.store.markFailed(r.endpoint);
      return res.outcome === "sent" ? 1 : 0;
    }),
  );
  return results.reduce<number>((a, b) => a + b, 0);
}
