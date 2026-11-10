"use client";

import { Check, ShieldCheck, Star } from "lucide-react";
import {
  CARRIER_NOTE,
  CARRIER_NOTE_ES,
  DRIVER_CHECKS,
  DRIVER_CHECKS_ES,
  guarantees,
  ICT_BADGE_NOTE,
  ICT_BADGE_NOTE_ES,
  visibleRatingSources,
} from "@/lib/trust";
import { usePublicLang, useT } from "../PublicLangContext";

/** Compact trust block that sits next to the send button (in the storefront's language). */
export function TrustPanel({ cashFeeBps }: { cashFeeBps: number }) {
  const lang = usePublicLang();
  const t = useT();
  const ratings = visibleRatingSources();
  return (
    <div className="space-y-3 text-sm">
      {ratings.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {ratings.map((r) => (
            <a
              key={r.name}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-slate-900 hover:underline"
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" aria-hidden />
              {r.rating.toFixed(1)}
              <span className="font-medium text-slate-600">
                · {t(`${r.count} ${r.name} reviews`, `${r.count} reseñas en ${r.name}`)}
              </span>
            </a>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {guarantees(cashFeeBps, lang).map((g) => (
          <li key={g.title} className="flex gap-2">
            <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden />
            <span>
              <span className="font-bold text-slate-900">{g.title}.</span>{" "}
              <span className="text-slate-600">{g.text}</span>
              {g.href && (
                <>
                  {" "}
                  <a href={g.href} className="inline-flex min-h-11 items-center font-semibold text-emerald-700 underline">
                    {t("Policy", "Política")}
                  </a>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      <details className="group rounded-xl border border-slate-200 bg-white">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 font-bold text-slate-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden />
          {t("How we pick our drivers", "Cómo elegimos a nuestros conductores")}
          <span className="ml-auto text-slate-500 group-open:rotate-180 transition" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="px-3 pb-3 space-y-2 text-slate-600">
          <p>
            {t(
              "Before their first ride with us, every partner driver:",
              "Antes de su primer viaje con nosotros, cada conductor asociado:",
            )}
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {t(DRIVER_CHECKS, DRIVER_CHECKS_ES).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p>{t(ICT_BADGE_NOTE, ICT_BADGE_NOTE_ES)}</p>
          <p className="text-xs text-slate-500">{t(CARRIER_NOTE, CARRIER_NOTE_ES)}</p>
        </div>
      </details>
    </div>
  );
}
