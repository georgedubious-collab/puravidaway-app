"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/forms/formState";
import { hasContactDetails } from "@/lib/preferences";
import { t as pick, type PublicLang } from "@/lib/publicLang";
import { localizeServerMessage } from "@/lib/serverMessagesEs";
import { SIGN_BRAND, SIGN_MAX, cleanSignText, shortName, signTextProblem } from "@/lib/sign";

/**
 * "Name on the sign" on the traveller's private trip page: what the driver's sign will say,
 * with a field to change it until the driver is on the way (then read-only). Rules in
 * src/lib/sign.ts; the server checks everything again (saveSign).
 */
export function SignEditor({
  action,
  token,
  bookingId,
  signText,
  hideName,
  guestName,
  editable,
  lang = "en",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  token: string;
  bookingId: string;
  signText: string | null;
  hideName: boolean;
  /** The name the request was sent with (for "it will show Emily R."). */
  guestName: string | null;
  editable: boolean;
  lang?: PublicLang;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [text, setText] = useState(signText ?? "");
  const [hide, setHide] = useState(hideName);
  const t = <T,>(en: T, es: T): T => pick(lang, en, es);
  const clean = hide ? "" : cleanSignText(text);
  const problem = signTextProblem(clean, hasContactDetails);
  const shown = clean || (hide ? SIGN_BRAND : (shortName(guestName) ?? SIGN_BRAND));
  const changed = hide !== hideName || clean !== (hideName ? "" : cleanSignText(signText));

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-extrabold text-slate-900">{t("Name on the sign", "Nombre en el rótulo")}</h3>
      <p className="mt-1 text-sm text-slate-600">
        {t("Your driver waits with a sign that reads:", "Su conductor lo espera con un rótulo que dice:")}
      </p>
      <p className="mt-2 rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-center text-lg font-extrabold text-slate-900 break-words">
        {shown}
      </p>
      {editable ? (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="booking_id" value={bookingId} />
          <label className="block text-xs font-bold text-slate-600">
            {t("Write something else (optional)", "Escriba otro texto (opcional)")}
            <input
              type="text"
              name="sign_text"
              value={hide ? "" : text}
              onChange={(e) => setText(e.target.value)}
              disabled={hide}
              maxLength={SIGN_MAX}
              autoComplete="off"
              placeholder={t("e.g. The Smith Family", "p. ej. Familia Rodríguez")}
              aria-invalid={Boolean(problem)}
              className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 px-3 text-base font-semibold text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>
          <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="hide_name"
              value="1"
              checked={hide}
              onChange={(e) => setHide(e.target.checked)}
              className="h-4 w-4 accent-emerald-700"
            />
            {t("Don't show my name", "No mostrar mi nombre")}
          </label>
          <p className="text-xs text-slate-500">
            {t(
              "Leave it empty to show your first name and last initial. You can change it until your driver is on the way.",
              "Déjelo vacío para mostrar su nombre y la inicial de su apellido. Puede cambiarlo hasta que su conductor vaya en camino.",
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending || Boolean(problem) || !changed}
              className="min-h-11 rounded-xl bg-emerald-950 px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending ? t("Saving…", "Guardando…") : t("Save sign", "Guardar rótulo")}
            </button>
            {problem ? (
              <p role="alert" className="text-sm font-semibold text-red-700">{localizeServerMessage(problem, lang)}</p>
            ) : state.error ? (
              <p role="alert" className="text-sm font-semibold text-red-700">{localizeServerMessage(state.error, lang)}</p>
            ) : state.ok && !changed ? (
              <p role="status" className="text-sm font-semibold text-emerald-700">{t("Saved.", "Guardado.")}</p>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          {t(
            "The sign can't be changed now that your driver is on the way.",
            "El rótulo ya no se puede cambiar porque su conductor va en camino.",
          )}
        </p>
      )}
    </div>
  );
}
