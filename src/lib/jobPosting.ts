import "server-only";
import { notifyDriversOfJobs } from "./jobAlerts";
import { runAutoRepost } from "./postingWindow";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * The automatic repost 48 hours before pickup (src/lib/postingWindow.ts, migration 0054), run by
 * the 5-minute check (/api/cron/eta). The database claims each booking once and writes the
 * history; then the drivers get the usual new-job alerts. Never throws.
 */
export async function autoRepostJobs(now = new Date()): Promise<number> {
  try {
    const db = createSupabaseAdminClient();
    if (!db) return 0;
    return await runAutoRepost(
      {
        claim: async () => {
          const { data, error } = await db.rpc("auto_repost_jobs");
          if (error) {
            // Before migration 0054 the function isn't there: nothing to do yet.
            if (!/auto_repost_jobs/.test(error.message)) console.error("[auto repost]", error.message);
            return [];
          }
          return ((data ?? []) as unknown[]).map((r) => (typeof r === "string" ? r : String((r as { auto_repost_jobs?: string }).auto_repost_jobs ?? ""))).filter(Boolean);
        },
        notify: (ids) => notifyDriversOfJobs(ids),
      },
      now,
    );
  } catch (e) {
    console.error("[auto repost]", e);
    return 0;
  }
}
