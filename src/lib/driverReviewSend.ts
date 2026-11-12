import "server-only";
import { after } from "next/server";
import { driverNoticeText, type DriverNotice } from "./driverReviewNotices";
import { SITE_URL, sendEmail } from "./email";
import { sendPush } from "./push";
import type { createSupabaseServerClient } from "./supabase/server";

type Db = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/**
 * Tell one driver about the team's decision: a push to the driver app (no screen: the app opens
 * normally, as it doesn't route a "documents" notification yet) and an email, in the driver's
 * language. Reads only that driver's own name, email and language (with the admin's session),
 * then sends after the response. Never throws: a failed message must not undo the decision.
 */
export async function notifyDriver(db: Db, driverId: string, notice: DriverNotice | null): Promise<void> {
  if (!notice) return;
  try {
    const { data: p } = await db.from("profiles").select("full_name, email, app_lang").eq("id", driverId).maybeSingle();
    const lang = p?.app_lang === "en" ? "en" : "es";
    const first = String(p?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    const m = driverNoticeText(notice, lang, first);
    const email = p?.email as string | null | undefined;
    after(async () => {
      await sendPush([driverId], { title: m.title, body: m.body }, "driver");
      if (email) {
        await sendEmail({
          to: email,
          subject: m.subject,
          lines: m.lines,
          button: { label: lang === "en" ? "Open the driver portal" : "Abrir el portal de conductores", url: `${SITE_URL}/driver` },
        });
      }
    });
  } catch (e) {
    console.error("[driver notice]", e);
  }
}
