import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { pick } from "./haptics";
import { useT, type Lang } from "./i18n";
import { C, T } from "./theme";
import { Text } from "./ui";

const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
};
const WEEKDAYS = { en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], es: ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] };
const DAYS = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  es: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
};
const SHORT_DAYS = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] };
const ymd = (y: number, m: number, d: number) => y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");

/** "Tuesday, 15 December 2026" ("martes, 15 de diciembre de 2026") for a YYYY-MM-DD day. */
export function longDate(day: string, lang: Lang = "en"): string {
  const d = new Date(day + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return day;
  if (lang === "es") return DAYS.es[d.getUTCDay()] + ", " + d.getUTCDate() + " de " + MONTHS.es[d.getUTCMonth()] + " de " + d.getUTCFullYear();
  return DAYS.en[d.getUTCDay()] + ", " + d.getUTCDate() + " " + MONTHS.en[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

/** "Tue 15 Dec" ("mar 15 dic") for a YYYY-MM-DD day. */
export function shortDate(day: string, lang: Lang = "en"): string {
  const d = new Date(day + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return day;
  return SHORT_DAYS[lang][d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[lang][d.getUTCMonth()].slice(0, 3);
}

/**
 * A month grid, always open, so nobody has to type a date. `value` and `min`
 * are YYYY-MM-DD; days before `min` can't be chosen.
 */
export function Calendar({ value, min, onChange }: { value: string; min: string; onChange: (day: string) => void }) {
  const { lang, t } = useT();
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const [month, setMonth] = useState(Number(value.slice(5, 7)) - 1);

  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const canGoBack = ymd(year, month, 1) > min;
  const move = (by: number) => {
    const d = new Date(Date.UTC(year, month + by, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Arrow icon="chevron-back" label={t("Previous month", "Mes anterior")} onPress={() => move(-1)} hidden={!canGoBack} />
        <Text accessibilityLiveRegion="polite" style={T.h3}>
          {lang === "es" ? MONTHS.es[month].charAt(0).toUpperCase() + MONTHS.es[month].slice(1) : MONTHS.en[month]} {year}
        </Text>
        <Arrow icon="chevron-forward" label={t("Next month", "Mes siguiente")} onPress={() => move(1)} />
      </View>
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS[lang].map((w) => (
          <Text key={w} style={[T.caption, { flex: 1, textAlign: "center", color: C.faint }]}>
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: "row" }}>
          {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
            if (d === null) return <View key={i} style={{ flex: 1, aspectRatio: 1 }} />;
            const day = ymd(year, month, d);
            const off = day < min;
            const on = day === value;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={longDate(day, lang)}
                accessibilityState={{ selected: on, disabled: off }}
                disabled={off}
                onPress={() => {
                  pick();
                  onChange(day);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  aspectRatio: 1,
                  margin: 2,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: on ? C.emerald : "transparent",
                  opacity: off ? 0.28 : pressed ? 0.5 : 1,
                })}
              >
                <Text maxFontSizeMultiplier={1.15} style={{ fontSize: 16, fontWeight: on ? "700" : "500", color: on ? "#fff" : C.text }}>
                  {d}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Arrow({ icon, label, onPress, hidden }: { icon: "chevron-back" | "chevron-forward"; label: string; onPress: () => void; hidden?: boolean }) {
  if (hidden) return <View style={{ width: 44, height: 44 }} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={20} color={C.text} />
    </Pressable>
  );
}
