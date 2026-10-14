"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

/** A form that shows "Saved" or a plain-language error next to its button. */
export function AdminForm({
  action,
  children,
  submitLabel = "Save",
  className = "",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 px-4 rounded-lg bg-emerald-950 text-white text-sm font-bold disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <span aria-live="polite" className="text-sm">
          {state.error ? (
            <span className="font-semibold text-red-700">{state.error}</span>
          ) : state.ok && !pending ? (
            <span className="font-semibold text-emerald-700">Saved</span>
          ) : null}
        </span>
      </div>
    </form>
  );
}
