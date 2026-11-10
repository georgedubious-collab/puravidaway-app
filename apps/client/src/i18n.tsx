import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, Text as Emoji } from "react-native";
import { pick } from "./haptics";
import { C } from "./theme";
import { Text } from "./ui";

/**
 * English by default; the flag button switches to Spanish and back. Strings are
 * written in place as t("English", "Español"), so each screen keeps both
 * versions side by side. The choice is remembered on the phone.
 */
export type Lang = "en" | "es";

const KEY = "lang";

interface LangValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (en: string, es: string) => string;
}

const LangContext = createContext<LangValue>({ lang: "en", setLang: () => {}, t: (en) => en });

export function LangProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial ?? "en");

  useEffect(() => {
    if (initial) return;
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (live && (v === "en" || v === "es")) setLangState(v);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [initial]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const value = useMemo<LangValue>(() => ({ lang, setLang, t: (en, es) => (lang === "es" ? es : en) }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useT = () => useContext(LangContext);

/**
 * The language switch: in English it shows the Costa Rica flag and "ES" (tap for
 * Spanish); in Spanish it shows the US flag and "EN" (tap for English).
 * `dark` is for the green sign-in screen.
 */
export function LangToggle({ dark }: { dark?: boolean }) {
  const { lang, setLang } = useT();
  const toEs = lang === "en";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={toEs ? "Cambiar a español" : "Switch to English"}
      hitSlop={8}
      onPress={() => {
        pick();
        setLang(toEs ? "es" : "en");
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 36,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: dark ? "rgba(255,255,255,0.35)" : C.border,
        backgroundColor: dark ? "rgba(255,255,255,0.12)" : "#fff",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Emoji style={{ fontSize: 16 }}>{toEs ? "🇨🇷" : "🇺🇸"}</Emoji>
      <Text style={{ fontSize: 13, fontWeight: "700", color: dark ? "#fff" : C.text }}>{toEs ? "ES" : "EN"}</Text>
    </Pressable>
  );
}
