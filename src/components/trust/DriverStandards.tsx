import { Check } from "lucide-react";
import { CARRIER_NOTE, DRIVER_CHECKS, ICT_BADGE_NOTE } from "@/lib/trust";

/** Full-width "Who drives you" section for route and marketing pages. */
export function DriverStandards() {
  return (
    <section aria-labelledby="who-drives" className="bg-emerald-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Who drives you</p>
          <h2 id="who-drives" className="mt-2 text-2xl sm:text-3xl font-extrabold">
            Hand-picked local partner drivers
          </h2>
          <p className="mt-3 text-base leading-relaxed text-emerald-100">
            Every ride is with an independent, local partner driver we&apos;ve personally
            interviewed. They know these roads in rainy season and dry.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-extrabold">Before their first ride with us, every partner driver:</h3>
          <ul className="mt-4 space-y-3 text-emerald-50">
            {DRIVER_CHECKS.map((c) => (
              <li key={c} className="flex gap-3">
                <Check className="w-5 h-5 shrink-0 text-amber-400" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-emerald-100">{ICT_BADGE_NOTE}</p>
          <p className="mt-3 text-xs leading-relaxed text-emerald-300">{CARRIER_NOTE}</p>
        </div>
      </div>
    </section>
  );
}
