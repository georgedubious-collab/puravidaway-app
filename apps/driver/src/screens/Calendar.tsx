import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useT } from "../i18n";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import type { Trip } from "../types";
import { Card, IconLine, ScreenTitle, type IconName } from "../ui";

const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"],
};
const WEEKDAYS = { en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], es: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] };
const CR_OFFSET_MS = 6 * 3600 * 1000;
/** A timestamp's calendar day in Costa Rica (UTC−6 all year), "YYYY-MM-DD". */
const crDay = (ms: number) => new Date(ms - CR_OFFSET_MS).toISOString().slice(0, 10);
const ymd = (y: number, m: number, d: number) => y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");

/**
 * The driver's calendar: tap a day to block it when they can't work, tap again
 * to open it. On a blocked day they aren't shown or sent jobs. Days with a
 * confirmed trip are marked and can't be blocked from here.
 */
export function Calendar({ trips, demoBlocked }: { trips: Trip[]; /** Sample blocked days for design previews; skips loading. */ demoBlocked?: string[] }) {
  const today = crDay(Date.now());
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);
  const [blocked, setBlocked] = useState<Set<string>>(new Set(demoBlocked));
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { t, lang } = useT();

  const load = useCallback(async () => {
    if (demoBlocked) return;
    const { data } = await supabase.from("driver_unavailable").select("day").gte("day", today);
    setBlocked(new Set(((data as { day: string }[] | null) ?? []).map((r) => r.day)));
  }, [today, demoBlocked]);
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
      return setMsg({
        ok: false,
        text: known ? error.message : t("No se pudo actualizar ese día. Revise su conexión e intente de nuevo.", "Couldn't update that day. Check your connection and try again."),
      });
    }
    setMsg({
      ok: true,
      text: block
        ? t("Bloqueado. No recibirá trabajos para ese día.", "Blocked. You won't get jobs for that day.")
        : t("Abierto de nuevo. Recibirá trabajos para ese día.", "Open again. You'll get jobs for that day."),
    });
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

  const dot = (color: string) => <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />;

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <ScreenTitle
        title={t("Calendario", "Calendar")}
        subtitle={t("Toque un día para bloquearlo cuando no pueda trabajar. Tóquelo otra vez para abrirlo.", "Tap a day to block it when you can't work. Tap it again to open it.")}
      />
      <Card>
        <View style={S.row}>
          <RoundBtn icon="chevron-back" label={t("Mes anterior", "Previous month")} onPress={() => move(-1)} hidden={thisMonth} />
          <Text style={S.h2}>
            {MONTHS[lang][month]} {year}
          </Text>
          <RoundBtn icon="chevron-forward" label={t("Mes siguiente", "Next month")} onPress={() => move(1)} hidden={monthsAhead >= 11} />
        </View>
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          {WEEKDAYS[lang].map((w) => (
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
              const past = day < today;
              const isBlocked = blocked.has(day);
              const tripCount = tripDays.get(day) ?? 0;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={
                    day + (isBlocked ? t(", bloqueado", ", blocked") : tripCount ? t(", viaje ese día", ", trip that day") : t(", disponible", ", available"))
                  }
                  disabled={past || busy !== ""}
                  onPress={() => void toggle(day)}
                  style={({ pressed }) => ({
                    flex: 1,
                    aspectRatio: 1,
                    margin: 2,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isBlocked ? C.redSoft : tripCount ? C.emerald : "transparent",
                    borderWidth: 2,
                    borderColor: day === today ? C.emeraldDark : "transparent",
                    opacity: past ? 0.3 : busy === day || pressed ? 0.5 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: isBlocked || tripCount || day === today ? "800" : "600",
                      color: isBlocked ? C.red : tripCount ? "#fff" : C.text,
                      textDecorationLine: isBlocked ? "line-through" : "none",
                    }}
                  >
                    {d}
                  </Text>
                  {tripCount > 1 ? <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff", marginTop: -2 }}>×{tripCount}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {dot(C.emerald)}
            <Text style={S.muted}>{t("Viaje confirmado", "Confirmed trip")}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {dot("#FCA5A5")}
            <Text style={S.muted}>{t("Bloqueado por usted", "Blocked by you")}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: C.emeraldDark }} />
            <Text style={S.muted}>{t("Hoy", "Today")}</Text>
          </View>
        </View>
        {msg ? <Text style={msg.ok ? { color: C.emerald, fontWeight: "700" } : S.error}>{msg.text}</Text> : null}
      </Card>
      <Card>
        <IconLine
          icon="eye-off-outline"
          text={t(
            "En los días bloqueados no verá ni recibirá trabajos. Bloquear un día retira las ofertas que haya enviado para ese día.",
            "You won't see or be sent jobs for blocked days. Blocking a day withdraws any offers you sent for it.",
          )}
        />
        <IconLine
          icon="alert-circle-outline"
          text={t(
            "Un día con un viaje confirmado no se puede bloquear aquí. Si no puede hacer un viaje, contacte a soporte de inmediato (Perfil → Ayuda) para que podamos reasignarlo.",
            "A day with a confirmed trip can't be blocked here. If you can't do a trip, contact support right away (Profile → Help) so we can reassign it.",
          )}
        />
      </Card>
    </ScrollView>
  );
}

function RoundBtn({ icon, label, onPress, hidden }: { icon: IconName; label: string; onPress: () => void; hidden?: boolean }) {
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
