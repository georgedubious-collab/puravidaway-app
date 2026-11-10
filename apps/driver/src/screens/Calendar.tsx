import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import type { Trip } from "../types";
import { Btn, Card } from "../ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CR_OFFSET_MS = 6 * 3600 * 1000;
/** A timestamp's calendar day in Costa Rica (UTC−6 all year), "YYYY-MM-DD". */
const crDay = (ms: number) => new Date(ms - CR_OFFSET_MS).toISOString().slice(0, 10);
const ymd = (y: number, m: number, d: number) => y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");

/**
 * The driver's calendar: tap a day to block it when they can't work, tap again
 * to open it. On a blocked day they aren't shown or sent jobs. Days with a
 * confirmed trip are marked and can't be blocked from here.
 */
export function Calendar({ trips }: { trips: Trip[] }) {
  const today = crDay(Date.now());
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("driver_unavailable").select("day").gte("day", today);
    setBlocked(new Set(((data as { day: string }[] | null) ?? []).map((r) => r.day)));
  }, [today]);
  useEffect(() => {
    void load();
  }, [load]);

  const tripDays = new Map<string, number>();
  for (const t of trips) {
    if ((t.status === "confirmed" || t.status === "in_progress") && t.scheduled_at) {
      const d = crDay(new Date(t.scheduled_at).getTime());
      tripDays.set(d, (tripDays.get(d) ?? 0) + 1);
    }
  }

  async function toggle(day: string) {
    const block = !blocked.has(day);
    setBusy(day);
    setMsg(null);
    const { error } = await supabase.rpc("set_unavailable", { p_day: day, p_blocked: block });
    setBusy("");
    if (error) {
      const known = /^(You have a trip|Pick a day|Only drivers)/.test(error.message);
      return setMsg({ ok: false, text: known ? error.message : "Couldn't update that day. Check your connection and try again." });
    }
    setMsg({ ok: true, text: block ? "Blocked. You won't get jobs for that day." : "Open again. You'll get jobs for that day." });
    await load();
  }

  // Monday-first grid for the shown month.
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const thisMonth = year === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7)) - 1;
  const monthsAhead = (year - Number(today.slice(0, 4))) * 12 + month - (Number(today.slice(5, 7)) - 1);
  const move = (by: number) => {
    const d = new Date(Date.UTC(year, month + by, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Text style={S.h1}>Calendar</Text>
      <Text style={S.muted}>Tap a day to block it when you can&apos;t work. Tap it again to open it. You won&apos;t see or be sent jobs for blocked days.</Text>
      <Card>
        <View style={S.row}>
          <View style={{ width: 64 }}>{!thisMonth ? <Btn label="‹" alt onPress={() => move(-1)} /> : null}</View>
          <Text style={S.h2}>
            {MONTHS[month]} {year}
          </Text>
          <View style={{ width: 64 }}>{monthsAhead < 11 ? <Btn label="›" alt onPress={() => move(1)} /> : null}</View>
        </View>
        <View style={{ flexDirection: "row" }}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={[S.label, { flex: 1, textAlign: "center" }]}>
              {w}
            </Text>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={row} style={{ flexDirection: "row" }}>
            {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
              if (d === null) return <View key={i} style={{ flex: 1, aspectRatio: 1 }} />;
              const day = ymd(year, month, d);
              const past = day < today;
              const isBlocked = blocked.has(day);
              const tripCount = tripDays.get(day) ?? 0;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={day + (isBlocked ? ", blocked" : tripCount ? ", trip that day" : ", available")}
                  disabled={past || busy !== ""}
                  onPress={() => void toggle(day)}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    margin: 2,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isBlocked ? "#FEE2E2" : tripCount ? C.emeraldSoft : "#fff",
                    borderWidth: day === today ? 2 : 1,
                    borderColor: day === today ? C.emeraldDark : isBlocked ? "#FCA5A5" : C.border,
                    opacity: past ? 0.35 : busy === day ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "800", color: isBlocked ? C.red : C.text }}>{d}</Text>
                  {tripCount ? <Text style={{ fontSize: 10, fontWeight: "700", color: C.emeraldDark }}>{tripCount === 1 ? "trip" : tripCount + " trips"}</Text> : null}
                  {isBlocked ? <Text style={{ fontSize: 10, fontWeight: "700", color: C.red }}>off</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
        {msg ? <Text style={msg.ok ? { color: C.emerald, fontWeight: "700" } : S.error}>{msg.text}</Text> : null}
      </Card>
      <Card>
        <Text style={S.text}>
          <Text style={{ fontWeight: "800", color: C.red }}>off</Text> = you blocked the day ·{" "}
          <Text style={{ fontWeight: "800", color: C.emeraldDark }}>trip</Text> = you have a confirmed trip
        </Text>
        <Text style={S.muted}>
          A day with a confirmed trip can&apos;t be blocked here. If you can&apos;t do a trip, contact support right away (Profile → Help) so we can
          reassign it. Blocking a day withdraws any offers you sent for it.
        </Text>
      </Card>
    </ScrollView>
  );
}
