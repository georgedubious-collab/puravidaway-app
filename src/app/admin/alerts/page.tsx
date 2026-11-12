import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { PushAlertsCard } from "@/components/admin/PushAlertsCard";
import { Card, PageHeader, field } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ALERT_KINDS, ALERT_KIND_LABELS, type AlertPrefs } from "@/lib/teamAlertRules";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { vapidFromEnv } from "@/lib/webPush";
import { saveAlertPrefs } from "./actions";

/**
 * Team alerts on the team's phones (CRM part 6, 2026-11-12): switch them on for this phone, send
 * a test, choose which alerts and quiet hours. Every admin has their own settings.
 */
export default async function AlertsPage() {
  const me = await requireRole("admin", "/admin/alerts");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const supabase = (await createSupabaseServerClient())!;
  const [{ data: prefsRow }, { data: count }] = await Promise.all([
    supabase.from("admin_alert_prefs").select("muted_kinds, quiet_start, quiet_end").eq("admin_id", me.id).maybeSingle<AlertPrefs>(),
    supabase.rpc("my_admin_push_count"),
  ]);
  const prefs: AlertPrefs = prefsRow ?? { muted_kinds: [], quiet_start: null, quiet_end: null };
  // Only the public half of the key pair goes to the browser.
  const publicKey = vapidFromEnv() ? (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim() : "";
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        title={t("Alertas del equipo", "Team alerts")}
        subtitle={t(
          "Avisos urgentes en el teléfono de cada miembro del equipo, además del correo.",
          "Urgent alerts on each team member's phone, in addition to email.",
        )}
      />
      <PushAlertsCard lang={lang} publicKey={publicKey} myPhones={typeof count === "number" ? count : 0} />
      <Card title={t("Qué alertas quiero recibir", "Which alerts I want")} id="prefs-card">
        <AdminActionForm action={saveAlertPrefs} lang={lang} className="space-y-5" submitLabel={t("Guardar", "Save")}>
          <fieldset className="space-y-3">
            <legend className="sr-only">{t("Tipos de alerta", "Alert types")}</legend>
            {ALERT_KINDS.map((k) => {
              const l = ALERT_KIND_LABELS[k];
              return (
                <label key={k} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-[#E3E8E5] p-3 hover:bg-[#FAFBFA]">
                  <input
                    type="checkbox"
                    name={`kind_${k}`}
                    defaultChecked={!prefs.muted_kinds.includes(k)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#047857]"
                  />
                  <span>
                    <span className="block text-sm font-bold text-[#14231C]">{lang === "en" ? l.en : l.es}</span>
                    <span className="block text-xs text-[#5F6F67]">{lang === "en" ? l.hintEn : l.hintEs}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <fieldset>
            <legend className={field.label}>{t("Horas de silencio (opcional)", "Quiet hours (optional)")}</legend>
            <p className={field.hint}>
              {t(
                "Hora de Costa Rica. Sin alertas al teléfono entre estas horas; el correo sigue llegando. Déjelo vacío si usted cubre la noche.",
                "Costa Rica time. No phone alerts between these hours; email still arrives. Leave empty if you cover the night shift.",
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className={field.label}>{t("Desde", "From")}</span>
                <select name="quiet_start" defaultValue={prefs.quiet_start ?? ""} className={`${field.input} w-36`}>
                  <option value="">{t("— ninguna —", "— none —")}</option>
                  {hours.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className={field.label}>{t("Hasta", "Until")}</span>
                <select name="quiet_end" defaultValue={prefs.quiet_end ?? ""} className={`${field.input} w-36`}>
                  <option value="">{t("— ninguna —", "— none —")}</option>
                  {hours.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
        </AdminActionForm>
      </Card>
    </div>
  );
}
