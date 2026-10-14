import { Star } from "lucide-react";
import { REVIEWS, visibleRatingSources, type Review } from "@/lib/trust";

/**
 * Reviews section. Renders nothing until real reviews exist (src/lib/trust.ts).
 * Pass `route` to put reviews about that route first.
 */
export function Reviews({ route }: { route?: string }) {
  if (REVIEWS.length === 0) return null;
  const ratings = visibleRatingSources();
  const sorted: Review[] = route
    ? [...REVIEWS].sort((a, b) => Number(b.route === route) - Number(a.route === route))
    : REVIEWS;

  return (
    <section aria-labelledby="reviews" className="bg-white border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 id="reviews" className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              What travelers say
            </h2>
            <p className="mt-2 text-slate-600">
              Every review comes from a completed ride and links to where it was posted.
            </p>
          </div>
          {ratings.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {ratings.map((r) => (
                <a
                  key={r.name}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-200 px-4 py-3 hover:border-emerald-400"
                >
                  <span className="block text-xs font-bold text-slate-500">{r.name}</span>
                  <span className="flex items-center gap-1 text-xl font-extrabold text-slate-900">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-500" aria-hidden />
                    {r.rating.toFixed(1)}
                  </span>
                  <span className="block text-xs text-slate-500">{r.count} reviews</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {sorted.slice(0, 6).map((r) => (
            <figure
              key={r.url}
              className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex" role="img" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-500" aria-hidden />
                  ))}
                </span>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-slate-600 rounded-full border border-slate-200 bg-white px-2.5 py-1 hover:text-emerald-700"
                >
                  {r.source}
                </a>
              </div>
              <blockquote className="text-slate-900 leading-relaxed">{r.quote}</blockquote>
              <figcaption className="mt-auto flex items-end justify-between gap-3">
                <span>
                  <span className="block font-bold text-slate-900">{r.name}</span>
                  <span className="text-xs text-slate-500">
                    {r.country} · {r.month}
                  </span>
                </span>
                <span className="text-xs font-bold text-emerald-900 bg-emerald-100 rounded-lg px-2 py-1 whitespace-nowrap">
                  {r.route}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
