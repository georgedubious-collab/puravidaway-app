import { Check } from "lucide-react";
import type { PublicLang } from "@/lib/publicLang";
import { CARRIER_NOTE, CARRIER_NOTE_ES, DRIVER_CHECKS, DRIVER_CHECKS_ES, ICT_BADGE_NOTE, ICT_BADGE_NOTE_ES } from "@/lib/trust";

/** Full-width "Who drives you" section for route and marketing pages. */
export function DriverStandards({ lang = "en" }: { lang?: PublicLang }) {
  const es = lang === "es";
  return (
    <section aria-labelledby="who-drives" className="bg-emerald-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400">{es ? "Quién lo lleva" : "Who drives you"}</p>
          <h2 id="who-drives" className="mt-2 text-2xl sm:text-3xl font-extrabold">
            {es ? "Conductores locales asociados, elegidos uno por uno" : "Hand-picked local partner drivers"}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-emerald-100">
            {es
              ? "Cada viaje es con un conductor local independiente asociado, a quien hemos entrevistado personalmente. Conoce estas carreteras en época lluviosa y seca."
              : "Every ride is with an independent, local partner driver we've personally interviewed. They know these roads in rainy season and dry."}
          </p>
        </div>
        <div>
          <h3 className="text-lg font-extrabold">
            {es ? "Antes de su primer viaje con nosotros, cada conductor asociado:" : "Before their first ride with us, every partner driver:"}
          </h3>
          <ul className="mt-4 space-y-3 text-emerald-50">
            {(es ? DRIVER_CHECKS_ES : DRIVER_CHECKS).map((c) => (
              <li key={c} className="flex gap-3">
                <Check className="w-5 h-5 shrink-0 text-amber-400" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-emerald-100">{es ? ICT_BADGE_NOTE_ES : ICT_BADGE_NOTE}</p>
          <p className="mt-3 text-xs leading-relaxed text-emerald-300">{es ? CARRIER_NOTE_ES : CARRIER_NOTE}</p>
        </div>
      </div>
    </section>
  );
}
