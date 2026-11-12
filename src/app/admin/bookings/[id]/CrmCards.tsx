"use client";

import { useMemo, useState } from "react";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { field } from "@/components/admin/ui";
import { CANCELLED_BY, cancelledByText, parseMoney, refundByPolicy, refundProblem, ruleText, type CancelledBy } from "@/lib/refundPolicy";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { cancelWithRefund, logWhatsAppOpened } from "../crmActions";

/* Booking page cards added by CRM part 3 (2026-11-12). */

export interface WaButton {
  kind: string;
  label: string;
  href: string | null;
  /** Why it can't be used yet. */
  unavailable: string | null;
  text: string;
}

/** One-tap WhatsApp messages: each opens WhatsApp with the text ready; the team presses send. */
export function WhatsAppButtons({ bookingId, buttons, lang }: { bookingId: string; buttons: WaButton[]; lang: TeamLang }) {
  const t = makeT(lang);
  return (
    <ul className="space-y-2">
      {buttons.map((b) => (
        <li key={b.kind} className="rounded-xl border border-[#E3E8E5] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#14231C]">{b.label}</span>
            {b.href && !b.unavailable ? (
              <a
                href={b.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void logWhatsAppOpened(bookingId, b.kind).catch(() => {})}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#047857] px-3 text-sm font-extrabold text-white hover:bg-[#065F46] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]"
              >
                {t("Abrir WhatsApp", "Open WhatsApp")} <span aria-hidden>↗</span>
              </a>
            ) : (
              <span className="text-xs font-semibold text-[#5F6F67]">{b.unavailable}</span>
            )}
          </div>
          <details className="mt-1.5">
            <summary className="cursor-pointer text-xs font-bold text-[#047857]">{t("Ver el mensaje", "See the message")}</summary>
            <p className="mt-1 whitespace-pre-line rounded-lg bg-[#F4F6F4] p-2.5 text-sm text-[#33443C]">{b.text}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Cancel the booking with the refund calculator: who cancels, when (from now vs pickup, Costa Rica
 * time), the amount received → the refund the policy gives and the rule. The team may change it
 * (with a reason). The server works it all out again before saving.
 */
export function CancelBookingForm({
  bookingId,
  bookingRef,
  pickupAt,
  amountReceived,
  hasDriver,
  testPaid,
  nowLocal,
  nowIso,
  lang,
}: {
  bookingId: string;
  bookingRef: string;
  pickupAt: string | null;
  amountReceived: number;
  hasDriver: boolean;
  testPaid: boolean;
  /** Now, Costa Rica time, for the datetime box ("2026-11-12T08:30"). */
  nowLocal: string;
  nowIso: string;
  lang: TeamLang;
}) {
  const t = makeT(lang);
  const [by, setBy] = useState<CancelledBy>("traveller");
  const [asked, setAsked] = useState(nowLocal);
  const [noShow, setNoShow] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);

  const askedIso = by === "traveller" ? (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(asked) ? new Date(`${asked}:00-06:00`).toISOString() : nowIso) : nowIso;
  const policy = useMemo(
    () => refundByPolicy({ by, pickupAt, askedAt: askedIso, amountReceived, noShow: by === "traveller" && noShow }),
    [by, pickupAt, askedIso, amountReceived, noShow],
  );
  const dueText = edited ?? policy.refund.toFixed(2);
  const due = parseMoney(dueText);
  const changed = due !== null && Math.round(due * 100) !== Math.round(policy.refund * 100);
  const problem = refundProblem(due, policy.refund, amountReceived, reason, lang);
  const h = policy.hoursBefore;
  const hoursText =
    h === null
      ? t("sin hora de recogida", "no pickup time")
      : h >= 0
        ? t(`${Math.floor(h)} h ${Math.round((h % 1) * 60)} min antes de la recogida`, `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min before pickup`)
        : t("después de la hora de recogida", "after the pickup time");

  const confirmText = [
    t(`La reserva ${bookingRef} quedará cancelada.`, `Booking ${bookingRef} will be cancelled.`),
    t(`Reembolso a deber: ${money(due ?? 0)} de ${money(amountReceived)} recibidos.`, `Refund owed: ${money(due ?? 0)} of ${money(amountReceived)} received.`),
    notify
      ? hasDriver
        ? t("Se avisa por correo al viajero (en su idioma) y al conductor asignado (sin datos del viajero ni precios).", "The traveller (in their language) and the assigned driver (no traveller details or prices) are emailed.")
        : t("Se avisa por correo al viajero, en su idioma.", "The traveller is emailed, in their language.")
      : t("Nadie recibe un aviso: avíseles usted.", "Nobody is told: let them know yourself."),
  ].join(" ");

  return (
    <AdminActionForm
      action={cancelWithRefund}
      lang={lang}
      danger
      className="space-y-4"
      submitLabel={t("Cancelar la reserva", "Cancel the booking")}
      savedLabel={t("Cancelada", "Cancelled")}
      confirm={problem ? [] : [{ kind: "always", message: confirmText }]}
      confirmLabel={t("Sí, cancelar", "Yes, cancel it")}
    >
      <input type="hidden" name="id" value={bookingId} />
      <fieldset>
        <legend className={field.label}>{t("¿Quién cancela?", "Who cancels?")}</legend>
        <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
          {CANCELLED_BY.map((k) => (
            <label key={k} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${by === k ? "border-[#047857] bg-[#ECFDF5]" : "border-[#DCE3DF]"}`}>
              <input
                type="radio"
                name="by"
                value={k}
                checked={by === k}
                onChange={() => {
                  setBy(k);
                  setEdited(null);
                }}
              />
              {cancelledByText(k, lang)}
            </label>
          ))}
        </div>
      </fieldset>
      {by === "traveller" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={field.label}>
            {t("¿Cuándo llegó su mensaje? (hora de Costa Rica)", "When did their message arrive? (Costa Rica time)")}
            <input
              type="datetime-local"
              name="asked_at"
              value={asked}
              max={nowLocal}
              onChange={(e) => {
                setAsked(e.target.value);
                setEdited(null);
              }}
              className={field.input}
            />
            <span className={field.hint}>{t("La política cuenta desde que recibimos su mensaje.", "The policy counts from when we received their message.")}</span>
          </label>
          <label className="flex items-center gap-2 self-center text-sm font-bold text-[#33443C]">
            <input
              type="checkbox"
              name="no_show"
              checked={noShow}
              onChange={(e) => {
                setNoShow(e.target.checked);
                setEdited(null);
              }}
              className="h-5 w-5"
            />
            {t("No se presentó", "No-show")}
          </label>
        </div>
      )}
      <div role="status" aria-live="polite" className="rounded-xl border border-[#E3E8E5] bg-[#FAFBFA] p-3.5 text-sm">
        <p className="text-[#5F6F67]">
          {t("Recibido", "Received")}: <strong className="text-[#14231C]">{money(amountReceived)}</strong>
          {by === "traveller" ? ` · ${hoursText}` : ""}
        </p>
        <p className="mt-1 text-[#5F6F67]">
          {t("Según la política", "By the policy")}: <strong className="text-lg text-[#14231C]">{money(policy.refund)}</strong>
        </p>
        <p className="mt-1 text-[#33443C]">{ruleText(policy.rule, lang)}</p>
        {testPaid && (
          <p className="mt-1 font-semibold text-[#B45309]">
            {t("Ojo: lo recibido vino del pago de PRUEBA; no hay dinero real que devolver.", "Note: what was received came from the TEST checkout; there's no real money to return.")}
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={field.label}>
          {t("Reembolso a deber (USD)", "Refund owed (USD)")}
          <input name="refund_due" inputMode="decimal" value={dueText} onChange={(e) => setEdited(e.target.value)} className={field.input} />
          <span className={field.hint}>{t("Puede cambiarlo; si es distinto al de la política, escriba el motivo.", "You may change it; if it differs from the policy, write the reason.")}</span>
        </label>
        {(changed || reason) && (
          <label className={field.label}>
            {t("Motivo del cambio (obligatorio)", "Reason for the change (required)")}
            <textarea name="reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} required={changed} className={field.textarea} />
          </label>
        )}
      </div>
      {problem && (
        <p role="alert" className="text-sm font-semibold text-[#B91C1C]">
          {problem}
        </p>
      )}
      <label className="flex items-start gap-2 text-sm font-bold text-[#33443C]">
        <input type="checkbox" name="notify" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 h-5 w-5" />
        <span>
          {hasDriver ? "Avisar al viajero y al conductor" : "Avisar al viajero"}
          {lang === "en" && <span className="font-normal"> ({hasDriver ? "notify the traveller and the driver" : "notify the traveller"})</span>}
          <span className={field.hint}>
            {t(
              "Por correo. Al viajero en su idioma; al conductor en su idioma, sin datos del viajero ni precios.",
              "By email. The traveller in their language; the driver in theirs, with no traveller details or prices.",
            )}
          </span>
        </span>
      </label>
      <p className="text-xs text-[#5F6F67]">
        {t(
          "Los reembolsos con tarjeta aún no se hacen solos (Green Pay no está conectado): después de devolver el dinero, márquelo abajo como pagado.",
          "Card refunds don't happen by themselves yet (Green Pay isn't connected): once you've sent the money back, mark it paid below.",
        )}
      </p>
    </AdminActionForm>
  );
}
