import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useBooking } from "../booking";
import { shortDate } from "../DatePicker";
import { orSimilar, plural } from "../format";
import { tap } from "../haptics";
import { useT, type Lang } from "../i18n";
import { openTrip, useNav } from "../nav";
import type { VehicleClass } from "../prices";
import { upcomingBookings, useSession } from "../session";
import { C, R, S, SHADOW, SP, T } from "../theme";
import { Bar, Skeleton, Text } from "../ui";
import { useVehicleClasses } from "../usePopular";
import { VehicleArt } from "../VehicleArt";
import { RouteDots } from "./book/parts";
import { BAND_OVERLAP, ExploreBand } from "./ExploreBand";
import { RidePromises } from "./Promises";
import { bookingStage } from "./Trips";

/** "Five vehicle types." The number as a word up to ten, as a figure after that. */
const COUNT_WORDS: Record<Lang, string[]> = {
  en: ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"],
  es: ["", "Un", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"],
};
function typesLine(n: number, lang: Lang): string {
  const word = COUNT_WORDS[lang][n] ?? String(n);
  if (lang === "es") return word + (n === 1 ? " tipo de vehículo." : " tipos de vehículo.") + " Los precios aparecen cuando elige a dónde va.";
  return word + (n === 1 ? " vehicle type." : " vehicle types.") + " Prices appear once you pick where to.";
}

/**
 * Explore, rides side: a clean booking start. The dark green band with the
 * headline, the "From / To" card with the date overlapping its edge, our
 * vehicle types ("Choose your ride": what each one is and who fits, no prices,
 * because nothing is priced until there is a route), and what every ride
 * includes. No map here: the map only appears on a trip once the driver is on
 * the way (TripDetail). `top` is the menu button and the Rides | Day tours switch.
 */
export function Home({ top }: { top: ReactNode }) {
  const { lang, t } = useT();
  const nav = useNav();
  const { state, set } = useBooking();
  const { trips } = useSession();
  const { classes, failed } = useVehicleClasses();
  const { from, to } = state;

  const next = upcomingBookings(trips)[0]?.booking;
  const stage = next ? bookingStage(next, lang) : null;

  function plan() {
    tap();
    set({ kind: "ride" });
    nav.navigate("BookWhere");
  }
  /** Remember the vehicle type as the one wanted; "Choose your vehicle" opens with it selected when the route offers it. */
  function planWith(v: VehicleClass) {
    tap();
    set({ kind: "ride", vehicleId: v.id });
    nav.navigate("BookWhere");
  }

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ paddingBottom: SP.xxl }} showsVerticalScrollIndicator={false}>
      <Bar style="light" />
      <ExploreBand
        top={top}
        title={t("Private rides across Costa Rica", "Traslados privados por Costa Rica")}
        subtitle={t("Door to door with a hand-picked local driver. See the price before you book.", "De puerta a puerta con un conductor local seleccionado. Vea el precio antes de reservar.")}
      />

      <View style={{ marginTop: -BAND_OVERLAP, paddingHorizontal: SP.lg, gap: SP.xl }}>
        <View style={{ gap: SP.md }}>
          <View style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, paddingLeft: 14, paddingRight: 10, borderRadius: R.card, backgroundColor: C.card }, SHADOW]}>
            <RouteDots inset={22} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Field label={t("From", "Desde")} value={from?.label} placeholder={t("Where from?", "¿Desde dónde?")} onPress={plan} line />
              <Field label={t("To", "Hasta")} value={to?.label} placeholder={t("Where to?", "¿A dónde va?")} onPress={plan} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Date, time and travellers", "Fecha, hora y viajeros") + (state.whenSet ? ": " + shortDate(state.date, lang) : "")}
              onPress={() => nav.navigate("BookWhen")}
              style={({ pressed }) => ({ minHeight: 52, maxWidth: 104, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: C.amberSoft, flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="calendar-outline" size={20} color={C.amber} />
              <Text maxFontSizeMultiplier={1.15} style={{ fontSize: 14, lineHeight: 18, fontWeight: "800", color: C.amber, flexShrink: 1 }}>
                {state.whenSet ? shortDate(state.date, lang) : t("Date", "Fecha")}
              </Text>
            </Pressable>
          </View>

          {next && stage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Your next trip: ", "Su próximo viaje: ") + next.title + ", " + stage.text}
              onPress={() => openTrip(next.id)}
              style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, backgroundColor: C.emeraldTint, borderRadius: R.card, paddingHorizontal: 14, paddingVertical: 10, opacity: pressed ? 0.8 : 1 }]}
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
        </View>

        {failed ? null : (
          <View style={{ gap: 10 }}>
            <View style={{ gap: 2, paddingHorizontal: SP.xs }}>
              <Text accessibilityRole="header" style={[T.h2, { fontWeight: "800" }]}>
                {t("Choose your ride", "Elija su vehículo")}
              </Text>
              {classes ? <Text style={T.caption}>{typesLine(classes.length, lang)}</Text> : <Skeleton width={230} height={14} style={{ marginVertical: 2 }} />}
            </View>
            {classes
              ? classes.map((v) => {
                  const similar = orSimilar(v.exampleModels, lang);
                  const fits = t("Up to " + plural(v.maxPax, "traveller", "en"), "Hasta " + plural(v.maxPax, "traveller", "es")) + " · " + v.luggage;
                  return (
                    <Pressable
                      key={v.id}
                      accessibilityRole="button"
                      accessibilityLabel={[v.name, similar, fits, v.badge].filter(Boolean).join(", ")}
                      onPress={() => planWith(v)}
                      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 84, backgroundColor: C.card, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, opacity: pressed ? 0.85 : 1 }, SHADOW]}
                    >
                      <VehicleArt id={v.id} name={v.name} maxPax={v.maxPax} width={92} height={66} />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "800", color: C.text }}>{v.name}</Text>
                        {similar ? <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: "500", color: C.text }}>{similar}</Text> : null}
                        <Text style={T.caption}>{fits}</Text>
                        {v.badge ? (
                          <View style={{ alignSelf: "flex-start", maxWidth: "100%", marginTop: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: C.surface }}>
                            <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: "700", color: C.body }}>{v.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={C.faint} />
                    </Pressable>
                  );
                })
              : [0, 1, 2, 3].map((i) => (
                  <View key={i} style={[{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 84, backgroundColor: C.card, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 }, SHADOW]}>
                    <Skeleton width={92} height={66} radius={14} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <Skeleton height={16} width="60%" />
                      <Skeleton height={12} width="80%" />
                    </View>
                  </View>
                ))}
            <Text style={[T.caption, { textAlign: "center", marginTop: 4 }]}>{t("The price is for the whole vehicle, not per person. Photos show example vehicles.", "El precio es por todo el vehículo, no por persona. Las fotos muestran vehículos de ejemplo.")}</Text>
          </View>
        )}

        <View style={{ backgroundColor: C.surface, borderRadius: R.card, padding: SP.lg, gap: SP.md }}>
          <Text accessibilityRole="header" style={T.h3}>
            {t("Every ride includes", "Cada traslado incluye")}
          </Text>
          <RidePromises compact />
        </View>
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
      <Text style={{ fontSize: 17, lineHeight: 23, fontWeight: "700", color: value ? C.text : C.muted }} numberOfLines={1}>
        {value ?? placeholder}
      </Text>
    </Pressable>
  );
}
