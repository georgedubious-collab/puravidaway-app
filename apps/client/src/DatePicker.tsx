import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { C, R, S } from "./theme";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ymd = (y: number, m: number, d: number) => y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");

/** "Tuesday, 15 December 2026" for a YYYY-MM-DD day. */
export function longDate(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return day;
  return DAYS[d.getUTCDay()] + ", " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

/**
 * A date field that opens a month grid, so nobody has to type a date. `value`
 * and `min` are YYYY-MM-DD; days before `min` can't be chosen.
 */
export function DatePicker({ label, value, min, onChange, startOpen }: { label: string; value: string; min: string; onChange: (day: string) => void; startOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(startOpen));
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
      <Text style={S.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label + ": " + longDate(value)}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [S.input, { flexDirection: "row", alignItems: "center", gap: 10, borderColor: open ? C.emerald : C.border, opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name="calendar-outline" size={20} color={C.emerald} />
        <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: C.text }}>{longDate(value)}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={C.faint} />
      </Pressable>
      {open ? (
        <View style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: R.control, padding: 10, gap: 4 }}>
          <View style={S.row}>
            <Arrow icon="chevron-back" label="Previous month" onPress={() => move(-1)} hidden={!canGoBack} />
            <Text style={S.h2}>
              {MONTHS[month]} {year}
            </Text>
            <Arrow icon="chevron-forward" label="Next month" onPress={() => move(1)} />
          </View>
          <View style={{ flexDirection: "row" }}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={[S.label, { flex: 1, textAlign: "center", letterSpacing: 0 }]}>
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
                    accessibilityLabel={longDate(day)}
                    accessibilityState={{ selected: on, disabled: off }}
                    disabled={off}
                    onPress={() => {
                      onChange(day);
                      setOpen(false);
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      aspectRatio: 1,
                      margin: 2,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: on ? C.emerald : "transparent",
                      opacity: off ? 0.3 : pressed ? 0.5 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 15, fontWeight: on ? "800" : "600", color: on ? "#fff" : C.text }}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
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
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={20} color={C.emerald} />
    </Pressable>
  );
}
