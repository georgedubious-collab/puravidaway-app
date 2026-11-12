"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";
import type { FormState } from "@/lib/forms/formState";
import { t as pick, type PublicLang } from "@/lib/publicLang";
import { localizeServerMessage } from "@/lib/serverMessagesEs";

/**
 * Star rating + optional comment for a completed trip (traveller's private trip
 * page). The stars are required and are enough on their own; the words are
 * optional and say so. A written comment counts double towards the driver's
 * rating (internal: the traveller is not told). `ride` names the trip when the
 * form sits at the top of the page, away from its card. `lang` is the trip's language.
 */
export function RateDriver({
  action,
  token,
  bookingId,
  driverFirstName,
  ride,
  lang = "en",
}: {
  lang?: PublicLang;
  ride?: string;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  token: string;
  bookingId: string;
  driverFirstName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const t = <T,>(en: T, es: T): T => pick(lang, en, es);
  const labels = t(["", "Poor", "Fair", "Good", "Very good", "Excellent"], ["", "Mala", "Regular", "Buena", "Muy buena", "Excelente"]);
  if (state.ok) {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
        {t(
          "Thank you! Your rating helps us give the best drivers more trips.",
          "¡Gracias! Su calificación nos ayuda a dar más viajes a los mejores conductores.",
        )}
      </p>
    );
  }
  return (
    <form action={formAction} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="stars" value={stars} />
      <p className="font-extrabold text-slate-900">
        {t(`How was your ride with ${driverFirstName}?`, `¿Cómo estuvo su viaje con ${driverFirstName}?`)}
      </p>
      {ride && <p className="text-sm text-slate-600">{ride}</p>}
      <p className="mt-1 text-sm text-slate-700">
        {t("Tap the stars to rate. That's all we need.", "Toque las estrellas para calificar. Con eso basta.")}
      </p>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label={t("Rating", "Calificación")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={t(`${n} star${n > 1 ? "s" : ""}`, `${n} estrella${n > 1 ? "s" : ""}`)}
            onClick={() => setStars(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="min-h-11 min-w-11 p-1"
          >
            <Star
              className={`h-8 w-8 ${(hover || stars) >= n ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
              aria-hidden
            />
          </button>
        ))}
        <span className="ml-2 text-sm font-bold text-slate-700">{labels[hover || stars]}</span>
      </div>
      <label className="mt-3 block text-xs font-bold text-slate-600">
        {t("Add a few words (optional)", "Agregue unas palabras (opcional)")}
        <textarea
          name="comment"
          rows={2}
          maxLength={1000}
          placeholder={t(
            "e.g. Punctual, careful on the mountain roads, great tips for La Fortuna",
            "p. ej. Puntual, cuidadoso en las carreteras de montaña, muy buenas recomendaciones para La Fortuna",
          )}
          className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-base sm:text-sm font-normal text-slate-900"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || stars === 0}
          className="min-h-11 rounded-xl bg-emerald-950 px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? t("Sending…", "Enviando…") : t("Send rating", "Enviar calificación")}
        </button>
        {state.error && <p role="alert" className="text-sm font-semibold text-red-700">{localizeServerMessage(state.error, lang)}</p>}
      </div>
    </form>
  );
}
