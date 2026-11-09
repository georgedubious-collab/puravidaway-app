"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";
import type { FormState } from "@/lib/forms/formState";

/**
 * Star rating + optional comment for a completed trip (traveller's private trip
 * page). A written comment counts double towards the driver's rating.
 */
export function RateDriver({
  action,
  token,
  bookingId,
  driverFirstName,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  token: string;
  bookingId: string;
  driverFirstName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const labels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
  if (state.ok) {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
        Thank you! Your rating helps us give the best drivers more trips.
      </p>
    );
  }
  return (
    <form action={formAction} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="stars" value={stars} />
      <p className="font-extrabold text-slate-900">How was your ride with {driverFirstName}?</p>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
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
        A few words about your driver (optional)
        <textarea
          name="comment"
          rows={2}
          maxLength={1000}
          placeholder="e.g. Punctual, careful on the mountain roads, great tips for La Fortuna"
          className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-base sm:text-sm font-normal text-slate-900"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || stars === 0}
          className="min-h-11 rounded-xl bg-emerald-950 px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send rating"}
        </button>
        {state.error && <p role="alert" className="text-sm font-semibold text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}
