import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * The app's language: Spanish by default (our drivers are Costa Rican), English as an option.
 * Each string is written in place as t("Español", "English"). The choice is saved on the
 * phone under "lang" and switched on the Profile screen or the sign-in screen.
 */
export type Lang = "es" | "en";
const KEY = "lang";

/** The language outside React (notifications, background location, upload messages). */
let current: Lang = "es";
export const currentLang = (): Lang => current;
/** Pick a string by the current language, for code that runs outside a screen. */
export const tr = (es: string, en: string): string => (current === "en" ? en : es);

/** Read the saved language (Spanish if none was chosen yet). */
export async function loadLang(): Promise<Lang> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === "es" || v === "en") current = v;
  } catch {
    /* storage unavailable: keep Spanish */
  }
  return current;
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (es: string, en: string) => string };
const LangContext = createContext<Ctx>({ lang: "es", setLang: () => {}, t: (es) => es });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>(current);
  useEffect(() => {
    void loadLang().then(setState);
  }, []);
  const setLang = useCallback((l: Lang) => {
    current = l;
    setState(l);
    void AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (es, en) => (lang === "en" ? en : es) }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** { lang, setLang, t } for a screen. */
export const useT = () => useContext(LangContext);
