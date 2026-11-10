"use client";

import { createContext, useCallback, useContext } from "react";
import type { PublicLang } from "@/lib/publicLang";

const PublicLangContext = createContext<PublicLang>("en");

/**
 * Language of the booking storefront. The page (/ → "en", /es → "es") sets it
 * once; every storefront component reads it with usePublicLang() / useT().
 */
export function PublicLangProvider({ lang, children }: { lang: PublicLang; children: React.ReactNode }) {
  return <PublicLangContext.Provider value={lang}>{children}</PublicLangContext.Provider>;
}

export function usePublicLang(): PublicLang {
  return useContext(PublicLangContext);
}

/** `const t = useT(); t("English", "Español")` — texts are written in place, side by side. */
export function useT(): <T>(en: T, es: T) => T {
  const lang = usePublicLang();
  return useCallback(<T,>(en: T, es: T): T => (lang === "es" ? es : en), [lang]);
}
