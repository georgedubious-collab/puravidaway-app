import { Check, ShieldCheck, Star } from "lucide-react";
import {
  CARRIER_NOTE,
  DRIVER_CHECKS,
  GUARANTEES,
  ICT_BADGE_NOTE,
  visibleRatingSources,
} from "@/lib/trust";

/** Compact trust block that sits next to the pay button. */
export function TrustPanel() {
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
                · {r.count} {r.name} reviews
              </span>
            </a>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {GUARANTEES.map((g) => (
          <li key={g.title} className="flex gap-2">
            <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden />
            <span>
              <span className="font-bold text-slate-900">{g.title}.</span>{" "}
              <span className="text-slate-600">{g.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <details className="group rounded-xl border border-slate-200 bg-white">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 font-bold text-slate-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden />
          How we pick our drivers
          <span className="ml-auto text-slate-400 group-open:rotate-180 transition" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="px-3 pb-3 space-y-2 text-slate-600">
          <p>Before their first ride with us, every partner driver:</p>
          <ul className="list-disc pl-5 space-y-1">
            {DRIVER_CHECKS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p>{ICT_BADGE_NOTE}</p>
          <p className="text-xs text-slate-500">{CARRIER_NOTE}</p>
        </div>
      </details>
    </div>
  );
}
