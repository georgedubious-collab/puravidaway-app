import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cents, useBooking } from "../booking";
import { shortDate } from "../DatePicker";
import { TOWNS } from "../format";
import { shortPlace } from "../geo";
import { tap } from "../haptics";
import { useT } from "../i18n";
import { openTrip, useNav } from "../nav";
import { Photo } from "../Photo";
import { POPULAR, driveTime, hub } from "../prices";
import { upcomingBookings, useSession } from "../session";
import { C, R, S, SHADOW, SP, T } from "../theme";
import { Skeleton, Bar, Text } from "../ui";
import { usePopular } from "../usePopular";
import { RouteDots } from "./book/parts";
import { RidePromises } from "./Promises";
import { bookingStage } from "./Trips";

/**
 * Explore, rides side: a clean booking start. A short headline, the
 * "From / To" card with the date, popular rides as picture cards with their
 * drive time and "from" price, and what every ride includes. No map here: the
 * map only appears on a trip once the driver is on the way (TripDetail).
 * `top` is the menu button and the Rides | Day tours switch.
 */
export function Home({ top }: { top: ReactNode }) {
  const { lang, t } = useT();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { state, set } = useBooking();
  const { trips } = useSession();
  const { prices, done } = usePopular();
  const { from, to } = state;

  const next = upcomingBookings(trips)[0]?.booking;
  const stage = next ? bookingStage(next, lang) : null;

  // Popular rides, the ones leaving from the chosen pickup first.
  const fromHub = from?.id.startsWith("hub:") ? from.id.slice(4) : "";
  const mine = POPULAR.filter((r) => r.from === fromHub);
  const popular = [...mine, ...POPULAR.filter((r) => !mine.includes(r))];

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

  return (
    <ScrollView style={S.screen} contentContainerStyle={[S.pad, { paddingTop: insets.top + 8, gap: SP.xl }]} showsVerticalScrollIndicator={false}>
      <Bar style="dark" />
      <View style={{ marginHorizontal: SP.lg - SP.page }}>{top}</View>

      {next && stage ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Your next trip: ", "Su próximo viaje: ") + next.title + ", " + stage.text}
          onPress={() => openTrip(next.id)}
          style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, backgroundColor: C.emeraldTint, borderRadius: R.card, paddingHorizontal: 14, paddingVertical: 10, marginTop: -SP.sm, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name={stage.icon} size={22} color={C.emerald} />
          <View style={{ flex: 1 }}>
            <Text style={T.caption} numberOfLines={1}>
              {t("Your next trip", "Su próximo viaje")} · {stage.text}
            </Text>
            <Text style={T.smallStrong} numberOfLines={1}>
              {next.title}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.emerald} />
        </Pressable>
      ) : null}

      <View style={{ gap: SP.lg }}>
        <View style={{ gap: 6 }}>
          <Text accessibilityRole="header" style={T.display}>
            {t("Private rides across Costa Rica", "Traslados privados por Costa Rica")}
          </Text>
          <Text style={T.body}>{t("Door to door with a hand-picked local driver. See the price before you book.", "De puerta a puerta con un conductor local seleccionado. Vea el precio antes de reservar.")}</Text>
        </View>

        <View style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, paddingLeft: 14, paddingRight: 10, borderRadius: R.card, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }, SHADOW]}>
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
      </View>

      <View style={{ gap: SP.md }}>
        <Text accessibilityRole="header" style={T.h2}>
          {fromHub && mine.length ? t("Popular from " + shortPlace(from?.label), "Populares desde " + shortPlace(from?.label)) : t("Popular rides", "Traslados populares")}
        </Text>
        {popular.map((r) => {
          const p = prices[r.from + ">" + r.to];
          const origin = shortPlace(TOWNS[r.from]);
          return (
            <Pressable
              key={r.from + r.to}
              accessibilityRole="button"
              accessibilityLabel={TOWNS[r.from] + " → " + TOWNS[r.to] + (p ? ", " + driveTime(p.minutes) + t(", from ", ", desde ") + cents(p.fromCents) : "")}
              onPress={() => quickRide(r)}
              style={({ pressed }) => [S.card, { padding: 0, gap: 0, flexDirection: "row", overflow: "hidden", minHeight: 100, opacity: pressed ? 0.85 : 1 }]}
            >
              <Photo name={r.photo} style={{ width: 100, alignSelf: "stretch" }} />
              <View style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingLeft: 14, paddingRight: 12, gap: 3, justifyContent: "center" }}>
                <Text style={T.h3} numberOfLines={2}>
                  {TOWNS[r.to]}
                </Text>
                <Text style={T.caption} numberOfLines={1}>
                  {t("from ", "desde ") + origin}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 10, rowGap: 4, marginTop: 4 }}>
                  {p ? (
                    <>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="time-outline" size={14} color={C.emerald} />
                        <Text style={[T.caption, { color: C.emerald, fontWeight: "700" }]}>{driveTime(p.minutes)}</Text>
                      </View>
                      <Text style={T.caption}>
                        {t("from ", "desde ")}
                        <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: "800", color: C.text }}>{cents(p.fromCents)}</Text>
                      </Text>
                    </>
                  ) : done ? (
                    <Text style={[T.smallStrong, { color: C.emerald }]}>{t("See price", "Ver precio")}</Text>
                  ) : (
                    <Skeleton width={120} height={18} />
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
        <Text style={T.caption}>{t("Prices are for the whole vehicle, not per person.", "Los precios son por todo el vehículo, no por persona.")}</Text>
      </View>

      <View style={{ backgroundColor: C.surface, borderRadius: R.card, padding: SP.lg, gap: SP.md }}>
        <Text accessibilityRole="header" style={T.h3}>
          {t("Every ride includes", "Cada traslado incluye")}
        </Text>
        <RidePromises compact />
      </View>
    </ScrollView>
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
