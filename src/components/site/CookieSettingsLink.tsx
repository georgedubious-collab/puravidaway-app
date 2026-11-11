"use client";

import { openConsentSettings } from "@/lib/analytics";
import type { PublicLang } from "@/lib/publicLang";

/** Footer link that reopens the cookie banner so a visitor can change or withdraw their choice. */
export function CookieSettingsLink({ lang }: { lang: PublicLang }) {
  return (
    <button
      type="button"
      onClick={openConsentSettings}
      className="min-h-11 inline-flex items-center font-semibold text-emerald-100 underline hover:text-white"
    >
      {lang === "es" ? "Configuración de cookies" : "Cookie settings"}
    </button>
  );
}
