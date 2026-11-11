"use client";

import { BadgeCheck, CalendarX2, MessageCircle, ShieldCheck } from "lucide-react";
import { HOME_HERO_PHOTO } from "@/lib/photos";
import type { PublicLang } from "@/lib/publicLang";
import { trustStrip } from "@/lib/trust";
import { usePublicLang } from "./PublicLangContext";
import { Photo } from "./site/Photo";

export type Builder = "transfers" | "daytours";

/** One naming set everywhere (header menu, tabs): Transfers / Day tours. */
export const BUILDER_LABEL: Record<Builder, Record<PublicLang, string>> = {
  transfers: { en: "Transfers", es: "Traslados" },
  daytours: { en: "Day tours", es: "Tours de un día" },
};

export interface BuilderTabs {
  current: Builder;
  onChange: (b: Builder) => void;
}

const TRUST_ICONS = [BadgeCheck, CalendarX2, ShieldCheck, MessageCircle];

/**
 * The first screen of the booking app, shared by the two tabs: the hero photo
 * under a dark-green overlay, the page's H1, one line of what you get, and a
 * compact white form card (tabs + the tab's own fields and its one button).
 * Under it, the four-claim trust strip (src/lib/trust.ts).
 * The tabs are hidden on wide screens, where the header menu shows the same
 * two choices: no duplicate navigation.
 */
export function BuilderHero({
  tabs,
  title,
  text,
  children,
}: {
  tabs: BuilderTabs;
  title: string;
  text: string;
  /** The tab's form fields and button. */
  children: React.ReactNode;
}) {
  const lang = usePublicLang();
  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl bg-emerald-950 text-white shadow-xl">
        <div className="absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
          <Photo id={HOME_HERO_PHOTO} lang={lang} fill decorative priority sizes="(min-width: 1280px) 1060px, 100vw" />
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/80 via-emerald-950/55 to-emerald-950/80 lg:bg-gradient-to-r lg:from-emerald-950/90 lg:via-emerald-950/60 lg:to-emerald-950/30" />
        </div>
        <div className="relative p-4 sm:p-6 lg:p-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,430px)] lg:gap-8 lg:items-center">
          <div>
            <h1 className="text-[26px] sm:text-4xl lg:text-[42px] font-extrabold leading-[1.1] tracking-tight [text-shadow:0_1px_12px_rgb(2_44_34/0.6)]">
              {title}
            </h1>
            <p className="mt-2 lg:mt-4 max-w-xl text-sm sm:text-base lg:text-lg leading-snug text-emerald-50 [text-shadow:0_1px_8px_rgb(2_44_34/0.7)]">
              {text}
            </p>
          </div>
          <div className="mt-4 lg:mt-0 rounded-2xl bg-white p-3 sm:p-4 text-slate-900 shadow-2xl">
            <div
              role="group"
              aria-label={lang === "es" ? "¿Qué desea reservar?" : "What do you want to book?"}
              className="lg:hidden mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
            >
              {(Object.keys(BUILDER_LABEL) as Builder[]).map((b) => {
                const on = tabs.current === b;
                return (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={on}
                    onClick={() => tabs.onChange(b)}
                    className={`min-h-11 rounded-lg px-1.5 text-[13px] font-bold leading-tight transition ${
                      on ? "bg-emerald-950 text-white shadow" : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    {BUILDER_LABEL[b][lang]}
                  </button>
                );
              })}
            </div>
            {children}
          </div>
        </div>
      </div>

      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {trustStrip(lang).map((claim, i) => {
          const Icon = TRUST_ICONS[i] ?? BadgeCheck;
          return (
            <li
              key={claim}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-bold leading-tight text-slate-800"
            >
              <Icon className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
              {claim}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Label + control inside the hero form card. Labels are 12 px, controls 16 px (no zoom on iPhone) and 44 px tall. */
export function HeroField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const HERO_CONTROL =
  "w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

export const HERO_BUTTON =
  "mt-3 w-full min-h-12 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-base font-extrabold flex items-center justify-center gap-2 transition";

/** A numbered section title of the builder ("2 · Choose your vehicle"). */
export function StepTitle({ n, children, icon }: { n: number; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-base sm:text-lg font-extrabold text-slate-900">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-950 text-xs font-extrabold text-white" aria-hidden>
        {n}
      </span>
      <span className="sr-only">{n}. </span>
      {icon}
      {children}
    </h2>
  );
}
