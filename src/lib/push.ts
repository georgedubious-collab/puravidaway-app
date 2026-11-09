import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * Push notifications to the mobile apps through the Expo push service
 * (docs/PROJECT.md §11.4). Phones register their token in device_tokens
 * (register_device()). Sending needs no key; EXPO_ACCESS_TOKEN is optional and
 * only used if "enhanced push security" is switched on in the Expo account.
 * Never throws: a failed push must not break a booking. Email stays the backup.
 */
export interface PushMessage {
  title: string;
  body: string;
  /** Where the app should open, e.g. { screen: "job", id: "<booking id>" }. */
  data?: Record<string, string>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPush(userIds: string[], message: PushMessage, app?: "driver" | "client"): Promise<number> {
  try {
    const ids = [...new Set(userIds.filter(Boolean))];
    const db = createSupabaseAdminClient();
    if (!db || ids.length === 0) return 0;
    let q = db.from("device_tokens").select("token").in("user_id", ids);
    if (app) q = q.eq("app", app);
    const { data } = await q;
    const tokens = (data ?? []).map((r) => r.token as string);
    let sent = 0;
    for (let i = 0; i < tokens.length; i += 100) {
      const chunk = tokens.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(chunk.map((to) => ({ to, sound: "default", title: message.title, body: message.body, data: message.data ?? {} }))),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.error("[push] Expo returned", res.status);
        continue;
      }
      const out = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      const dead: string[] = [];
      (out.data ?? []).forEach((t, n) => {
        if (t.status === "ok") sent++;
        else if (t.details?.error === "DeviceNotRegistered") dead.push(chunk[n]);
      });
      // The app was uninstalled: stop sending to that phone.
      if (dead.length) await db.from("device_tokens").delete().in("token", dead);
    }
    return sent;
  } catch (e) {
    console.error("[push]", e);
    return 0;
  }
}
