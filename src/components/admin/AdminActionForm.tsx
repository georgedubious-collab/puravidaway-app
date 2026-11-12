"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { FormState } from "@/lib/forms/formState";
import type { TeamLang } from "@/lib/teamLang";

/**
 * When to ask "are you sure?" before a form is sent (plain data, so server pages can pass it).
 * - always: every time (deleting something, settling money).
 * - equals: when a field is set to one of these values (status "cancelled", decision "reject").
 * - changed: when one of these fields differs from what the page showed (amount received,
 *   prices, a vehicle's category). `{from}` and `{to}` in the message are replaced with the old
 *   and new value of the first changed field (the visible text, for a list).
 */
export type ConfirmRule =
  | { kind: "always"; message: string }
  | { kind: "equals"; field: string; values: string[]; message: string; unlessInitial?: boolean }
  | { kind: "changed"; fields: string[]; message: string };

type Snapshot = Record<string, { value: string; text: string }>;

function read(form: HTMLFormElement): Snapshot {
  const out: Snapshot = {};
  for (const el of Array.from(form.elements)) {
    const e = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!e.name || e.disabled) continue;
    if (e instanceof HTMLInputElement && (e.type === "checkbox" || e.type === "radio")) {
      if (e.type === "radio" && !e.checked) {
        out[e.name] ??= { value: "", text: "" };
        continue;
      }
      if (e.type === "checkbox") {
        const prev = out[e.name]?.value;
        const v = e.checked ? e.value || "on" : "";
        out[e.name] = { value: prev ? [prev, v].filter(Boolean).join(",") : v, text: e.checked ? "✓" : "—" };
        continue;
      }
    }
    const text = e instanceof HTMLSelectElement ? (e.selectedOptions[0]?.text ?? e.value) : e.value;
    out[e.name] = { value: e.value.trim(), text: text.trim() };
  }
  return out;
}

const same = (a = "", b = "") => {
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return a !== "" && b !== "" && Number.isFinite(na) && Number.isFinite(nb) && na === nb;
};

export function confirmMessages(rules: ConfirmRule[], initial: Snapshot, now: Snapshot): string[] {
  const out: string[] = [];
  for (const r of rules) {
    if (r.kind === "always") out.push(r.message);
    else if (r.kind === "equals") {
      const v = now[r.field]?.value ?? "";
      if (r.values.includes(v) && !(r.unlessInitial && initial[r.field]?.value === v)) out.push(r.message);
    } else {
      const changed = r.fields.find((f) => !same(initial[f]?.value, now[f]?.value));
      if (changed) {
        out.push(r.message.replaceAll("{from}", initial[changed]?.text || "—").replaceAll("{to}", now[changed]?.text || "—"));
      }
    }
  }
  return out;
}

/**
 * The admin's form: one action, a submit button, "Saved" or a readable error next to it, and,
 * when `confirm` rules match, an in-page "Are you sure?" box that says what will happen
 * (no browser pop-up). Without JavaScript the form still works, without the extra question.
 */
export function AdminActionForm({
  action,
  children,
  lang,
  submitLabel,
  savedLabel,
  confirm = [],
  confirmLabel,
  danger = false,
  className = "",
  buttonClassName,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children?: React.ReactNode;
  lang: TeamLang;
  submitLabel?: string;
  savedLabel?: string;
  confirm?: ConfirmRule[];
  /** Text of the "yes" button in the question box. */
  confirmLabel?: string;
  /** Red submit button (cancel, delete). */
  danger?: boolean;
  className?: string;
  buttonClassName?: string;
}) {
  const en = lang === "en";
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const initial = useRef<Snapshot>({});
  const confirmed = useRef(false);
  const submitter = useRef<HTMLElement | null>(null);
  const [asking, setAsking] = useState<string[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // What the page showed: taken when the form appears and again after each save.
  useEffect(() => {
    if (formRef.current) initial.current = read(formRef.current);
  }, [state.savedAt]);

  useEffect(() => {
    if (asking) boxRef.current?.querySelector<HTMLButtonElement>("button[data-yes]")?.focus();
  }, [asking]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    if (!confirm.length) return;
    const msgs = confirmMessages(confirm, initial.current, read(e.currentTarget));
    if (msgs.length) {
      e.preventDefault();
      submitter.current = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
      setAsking(msgs);
    }
  }

  function yes() {
    setAsking(null);
    confirmed.current = true;
    const s = submitter.current;
    formRef.current?.requestSubmit(s instanceof HTMLButtonElement || s instanceof HTMLInputElement ? s : undefined);
  }

  function no() {
    setAsking(null);
    formRef.current?.querySelector<HTMLButtonElement>("button[type=submit]")?.focus();
  }

  const buttonClass =
    buttonClassName ??
    `inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-extrabold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857] ${
      danger ? "bg-[#B91C1C] hover:bg-[#991B1B]" : "bg-[#047857] hover:bg-[#065F46]"
    }`;

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || Boolean(asking)} className={buttonClass}>
          {pending ? (en ? "Saving…" : "Guardando…") : (submitLabel ?? (en ? "Save" : "Guardar"))}
        </button>
        <span aria-live="polite" className="text-sm">
          {state.error ? (
            <span role="alert" className="font-semibold text-[#B91C1C]">
              {state.error}
            </span>
          ) : state.ok && !pending ? (
            <span className="font-semibold text-[#047857]">{savedLabel ?? (en ? "Saved" : "Guardado")}</span>
          ) : null}
        </span>
      </div>
      {asking && (
        <div
          ref={boxRef}
          role="alertdialog"
          aria-labelledby={titleId}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              no();
            }
          }}
          className="mt-3 basis-full rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#78350F] sm:col-span-full"
        >
          <p id={titleId} className="font-extrabold text-[#14231C]">
            {en ? "Please confirm" : "Confirme, por favor"}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {asking.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-yes
              onClick={yes}
              className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-extrabold text-white ${danger ? "bg-[#B91C1C] hover:bg-[#991B1B]" : "bg-[#047857] hover:bg-[#065F46]"}`}
            >
              {confirmLabel ?? (en ? "Yes, go ahead" : "Sí, continuar")}
            </button>
            <button
              type="button"
              onClick={no}
              className="inline-flex min-h-11 items-center rounded-xl border border-[#DCE3DF] bg-white px-4 text-sm font-bold text-[#14231C] hover:bg-[#F1F4F2]"
            >
              {en ? "No, go back" : "No, volver"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
