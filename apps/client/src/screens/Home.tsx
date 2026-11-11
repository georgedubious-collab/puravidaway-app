import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cents, useBooking } from "../booking";
import { shortDate } from "../DatePicker";
import { TOWNS } from "../format";
import { pointOfPlace, shortPlace, type MapPoint } from "../geo";
import { tap } from "../haptics";
import { useT } from "../i18n";
import { RouteMap } from "../MapView";
import { openTrip, useNav } from "../nav";
import { POPULAR, driveTime, hub } from "../prices";
import { upcomingBookings, useSession } from "../session";
import { C, R, S, SHADOW, SP, T } from "../theme";
import { Bar, Skeleton, Text } from "../ui";
import { usePopular } from "../usePopular";
import { RouteDots, SHEET } from "./book/parts";
import { bookingStage } from "./Trips";

/**
 * Explore, rides side: the map fills the screen; a panel at the bottom asks
 * "Where from? / Where to?" and the date, with three popular destinations one
 * tap away. `top` is the menu button and the Rides | Day tours switch.
 */
export function Home({ top }: { top: ReactNode }) {
  const { lang, t } = useT();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { state, set } = useBooking();
  const { trips } = useSession();
  const { prices, done } = usePopular();
  const [sheetH, setSheetH] = useState(360);
  const { from, to } = state;

  const next = upcomingBookings(trips)[0]?.booking;
  const stage = next ? bookingStage(next, lang) : null;

  // Three popular rides, the ones leaving from the chosen pickup first.
  const fromHub = from?.id.startsWith("hub:") ? from.id.slice(4) : "";
  const mine = POPULAR.filter((r) => r.from === fromHub);
  const quick = [...mine, ...POPULAR.filter((r) => !mine.includes(r))].slice(0, 3);

  function plan() {
    tap();
    set({ kind: "ride" });
    nav.navigate("BookWhere");
  }
  function quickRide(r: { from: string; to: string }) {
    tap();
    set({ kind: "ride", from: hub(r.from), to: hub(r.to), stopIds: [] });
    nav.navigate("BookRide");
  }

  const a = pointOfPlace(from);
  const b = pointOfPlace(to);
  const points: MapPoint[] = [];
  if (a) points.push({ ...a, kind: "pickup", label: shortPlace(from?.label) });
  if (b) points.push({ ...b, kind: "dropoff", label: shortPlace(to?.label) });

  return (
    <View style={S.screen}>
      <Bar style="dark" />
      <RouteMap style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} points={points} line={a && b ? [a, b] : undefined} country={!(a && b)} pad={{ top: insets.top + (next ? 132 : 72), bottom: sheetH }} />

      <View style={{ position: "absolute", left: SP.lg, right: SP.lg, top: insets.top + 8, gap: 10 }}>
        {top}
        {next && stage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Your next trip: ", "Su próximo viaje: ") + next.title + ", " + stage.text}
            onPress={() => openTrip(next.id)}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, backgroundColor: C.card, borderRadius: R.card, paddingHorizontal: 14, paddingVertical: 8, opacity: pressed ? 0.8 : 1 }, SHADOW]}
          >
            <Ionicons name={stage.icon} size={20} color={C.emerald} />
            <View style={{ flex: 1 }}>
              <Text style={T.caption} numberOfLines={1}>
                {t("Your next trip", "Su próximo viaje")} · {stage.text}
              </Text>
              <Text style={T.smallStrong} numberOfLines={1}>
                {next.title}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
        ) : null}
      </View>

      <View style={[SHEET, { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "68%" }]} onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.page, paddingTop: SP.lg, paddingBottom: SP.md, gap: 14 }}>
          <Text accessibilityRole="header" style={[T.h1, { fontSize: 22, lineHeight: 28 }]}>
            {t("Private rides across Costa Rica", "Traslados privados por Costa Rica")}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, paddingLeft: 14, paddingRight: 10, borderRadius: 18, backgroundColor: C.surface }}>
            <RouteDots inset={22} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Field label={t("From", "Desde")} value={from?.label} placeholder={t("Where from?", "¿Desde dónde?")} onPress={plan} line />
              <Field label={t("To", "Hasta")} value={to?.label} placeholder={t("Where to?", "¿A dónde va?")} onPress={plan} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Date, time and travellers", "Fecha, hora y viajeros") + (state.whenSet ? ": " + shortDate(state.date, lang) : "")}
              onPress={() => nav.navigate("BookWhen")}
              style={({ pressed }) => ({ minHeight: 48, maxWidth: 104, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.control, backgroundColor: C.amberSoft, flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="calendar-outline" size={20} color={C.amber} />
              <Text maxFontSizeMultiplier={1.15} style={{ fontSize: 14, lineHeight: 18, fontWeight: "700", color: C.amber, flexShrink: 1 }}>
                {state.whenSet ? shortDate(state.date, lang) : t("Date", "Fecha")}
              </Text>
            </Pressable>
          </View>

          <View>
            {quick.map((r, i) => {
              const p = prices[r.from + ">" + r.to];
              const origin = shortPlace(TOWNS[r.from]);
              return (
                <Pressable
                  key={r.from + r.to}
                  accessibilityRole="button"
                  accessibilityLabel={TOWNS[r.from] + " → " + TOWNS[r.to] + (p ? t(", from ", ", desde ") + cents(p.fromCents) : "")}
                  onPress={() => quickRide(r)}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingVertical: 8, borderBottomWidth: i < quick.length - 1 ? 1 : 0, borderBottomColor: C.border, opacity: pressed ? 0.6 : 1 })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="location-outline" size={20} color={C.emerald} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "700", color: C.text }} numberOfLines={1}>
                      {TOWNS[r.to]}
                    </Text>
                    <Text style={T.caption} numberOfLines={2}>
                      {p ? t("About " + driveTime(p.minutes) + " from " + origin, "Aprox. " + driveTime(p.minutes) + " desde " + origin) : t("From " + origin, "Desde " + origin)}
                    </Text>
                  </View>
                  {p ? (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[T.caption, { fontSize: 12, lineHeight: 15 }]}>{t("from", "desde")}</Text>
                      <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "800", color: C.text }}>{cents(p.fromCents)}</Text>
                    </View>
                  ) : done ? (
                    <Ionicons name="chevron-forward" size={18} color={C.faint} />
                  ) : (
                    <Skeleton width={52} height={20} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

/** One line of the From / To card: a small label and the place (or the question). */
function Field({ label, value, placeholder, onPress, line }: { label: string; value?: string; placeholder: string; onPress: () => void; line?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label + ": " + (value ?? placeholder)}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 56, justifyContent: "center", gap: 1, paddingVertical: 6, borderBottomWidth: line ? 1 : 0, borderBottomColor: C.border, opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={[T.label, { letterSpacing: 0.5 }]}>{label}</Text>
      <Text style={{ fontSize: 17, lineHeight: 23, fontWeight: "700", color: C.text }} numberOfLines={1}>
        {value ?? placeholder}
      </Text>
    </Pressable>
  );
}
