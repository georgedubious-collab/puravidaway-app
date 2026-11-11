import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cents, useBooking } from "../../booking";
import { shortDate } from "../../DatePicker";
import { orSimilar, plural } from "../../format";
import { pick } from "../../haptics";
import { LangToggle, useT } from "../../i18n";
import { useNav } from "../../nav";
import { driveTime, nightLabel, time12 } from "../../prices";
import { C, S, SP, T, fontFor } from "../../theme";
import { Badge, Bar, Btn, Card, Choice, RoundBtn, Skeleton, Text } from "../../ui";
import { BagNote, ChipBtn, QuoteFacts, QuoteProblem, RouteDots } from "./parts";

/**
 * Choose the vehicle: a short route card (pickup → drop-off, the drive time,
 * the date and travellers), then the choice between the fixed price and an
 * offer for drivers to bid on, and every vehicle with its price for this ride.
 * No map while booking; the map appears on the trip once a driver is assigned.
 */
export function BookRide() {
  const { lang, t } = useT();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { state, set, quote, quoteBusy, vehicle, minOffer, offerValid, offerLow } = useBooking();
  const { mode, from, to } = state;
  const canNext = Boolean(vehicle) && (mode === "fixed" || offerValid);

  function setMode(next: "fixed" | "bid") {
    // Start the offer at the fixed price for the chosen vehicle.
    set(next === "bid" && !state.offer && vehicle ? { mode: next, offer: String(Math.round(vehicle.totalCents / 100)) } : { mode: next });
  }

  return (
    <KeyboardAvoidingView style={[S.screen, { backgroundColor: C.card }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Bar style="dark" />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: SP.lg, paddingBottom: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <RoundBtn icon="chevron-back" label={t("Back", "Volver")} onPress={() => nav.goBack()} />
        <LangToggle />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.lg, paddingTop: SP.sm, paddingBottom: SP.lg, gap: 12 }}>
          <View style={[S.card, { gap: 12 }]}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <RouteDots inset={6} small />
              <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
                <Text accessibilityLabel={t("From: ", "Desde: ") + (from?.label ?? "")} style={T.h3} numberOfLines={2}>
                  {from?.label ?? "—"}
                </Text>
                <Text accessibilityLabel={t("To: ", "Hasta: ") + (to?.label ?? "")} style={T.h3} numberOfLines={2}>
                  {to?.label ?? "—"}
                </Text>
              </View>
            </View>
            {quote ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="time-outline" size={18} color={C.emerald} />
                <Text style={[T.smallStrong, { color: C.emerald, flexShrink: 1 }]}>{t("About " + driveTime(quote.minutes) + " drive", "Aprox. " + driveTime(quote.minutes) + " de viaje")}</Text>
              </View>
            ) : quoteBusy ? (
              <Skeleton width={170} height={18} />
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <ChipBtn
                grow
                icon="calendar-outline"
                tone={state.whenSet ? undefined : "amber"}
                label={state.whenSet ? shortDate(state.date, lang) + " · " + time12(state.time) : t("Choose date and time", "Elija fecha y hora")}
                accessibilityLabel={t("Date and pickup time", "Fecha y hora de recogida") + (state.whenSet ? ": " + shortDate(state.date, lang) + ", " + time12(state.time) : "")}
                onPress={() => nav.navigate("BookWhen")}
              />
              <ChipBtn icon="person-outline" label={plural(state.pax, "traveller", lang)} onPress={() => nav.navigate("BookWhen")} />
            </View>
          </View>
          {quote?.night?.applies ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <Badge text={nightLabel(quote.night, lang)} tone="gold" icon="moon-outline" />
              <Text style={[T.caption, { flexShrink: 1 }]}>{t("Included in the prices below.", "Incluido en los precios de abajo.")}</Text>
            </View>
          ) : null}
          {state.whenSet ? null : (
            <Text style={T.caption}>{t("Prices shown are for " + shortDate(state.date, lang) + ". Choose your date to see yours.", "Los precios mostrados son para el " + shortDate(state.date, lang) + ". Elija su fecha para ver los suyos.")}</Text>
          )}

          <QuoteProblem />
          {quote?.vehicles.length ? (
            <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
              <Text accessibilityRole="header" style={[T.h3, { fontSize: 18, fontWeight: "800", marginTop: 2 }]}>{t("How do you want to book?", "¿Cómo quiere reservar?")}</Text>
              <Choice
                icon="pricetag-outline"
                title={t("Fixed price", "Precio fijo")}
                detail={t("You book at the price you see. It does not change.", "Reserva al precio que ve. No cambia.")}
                on={mode === "fixed"}
                onPress={() => setMode("fixed")}
              />
              <Choice
                icon="hammer-outline"
                title={t("Driver offers", "Ofertas de conductores")}
                detail={t("You propose a price and drivers answer. You may pay less, but a driver may not accept.", "Usted propone un precio y los conductores responden. Puede pagar menos, pero puede que ningún conductor acepte.")}
                on={mode === "bid"}
                onPress={() => setMode("bid")}
              />
            </View>
          ) : null}
          {mode === "bid" && vehicle ? (
            <Card tone="amber">
              <Text style={T.h3}>{t("Name your price", "Proponga su precio")}</Text>
              <Text style={T.small}>
                {t(
                  "Hand-picked local drivers see your offer and bid on it. Our team confirms the best match and emails you the driver's profile and car. Nothing is charged until then.",
                  "Conductores locales seleccionados ven su oferta y ofertan. Nuestro equipo confirma la mejor opción y le envía por correo el perfil del conductor y el vehículo. No se cobra nada hasta entonces.",
                )}
              </Text>
              <Text style={T.small}>{t("Fixed price for the " + vehicle.name + ": ", "Precio fijo del " + vehicle.name + ": ") + cents(vehicle.totalCents)}</Text>
              <View style={[S.input, { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }]}>
                <Text style={{ fontSize: 26, fontWeight: "800", color: C.text }}>$</Text>
                <TextInput
                  accessibilityLabel={t("Your offer in US dollars", "Su oferta en dólares")}
                  value={state.offer}
                  onChangeText={(v) => set({ offer: v.replace(/[^0-9]/g, "").slice(0, 5) })}
                  keyboardType="number-pad"
                  maxFontSizeMultiplier={1.2}
                  style={{ flex: 1, fontSize: 26, color: C.text, padding: 0, fontFamily: fontFor("800") }}
                />
                <Text style={T.small}>USD</Text>
              </View>
              {!offerValid ? <Text style={S.error}>{t("Enter an offer of at least ", "Ingrese una oferta de al menos ") + cents(minOffer) + "."}</Text> : null}
              {offerLow ? <Text style={{ color: C.amber, fontWeight: "700", fontSize: 15, lineHeight: 21 }}>{t("That's well below the fixed price, so drivers may not accept it.", "Está muy por debajo del precio fijo, así que es posible que los conductores no la acepten.")}</Text> : null}
            </Card>
          ) : null}
          {quote?.vehicles.length ? (
            <Text accessibilityRole="header" style={[T.h3, { fontSize: 18, fontWeight: "800", marginTop: 2 }]}>
              {mode === "bid" ? t("Vehicle you'd like", "Vehículo que desea") : t("Choose your vehicle", "Elija su vehículo")}
            </Text>
          ) : null}

          {!quote && quoteBusy ? (
            <View style={{ gap: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingHorizontal: 8 }}>
                  <Skeleton width={48} height={36} radius={10} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton height={16} width="70%" />
                    <Skeleton height={12} width="50%" />
                  </View>
                  <Skeleton width={56} height={20} />
                </View>
              ))}
            </View>
          ) : null}

          <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
            {quote?.vehicles.map((v) => {
              const on = v.id === vehicle?.id;
              const similar = orSimilar(v.exampleModels, lang);
              const facts = [v.badge, v.allowsStops || /direct/i.test(v.badge ?? "") ? "" : t("Direct ride, no stops", "Traslado directo, sin paradas"), v.perPersonCents ? t("from " + cents(v.perPersonCents) + "/person", "desde " + cents(v.perPersonCents) + "/persona") : ""].filter(Boolean);
              return (
                <Pressable
                  key={v.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={v.name + (similar ? ", " + similar : "") + ", " + cents(v.totalCents) + t(" per car", " por vehículo")}
                  onPress={() => {
                    if (!on) pick();
                    set({ vehicleId: v.id });
                  }}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 68, paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderRadius: 16, borderWidth: 2, borderColor: on ? C.emerald : C.card, backgroundColor: on ? C.emeraldTint : C.card, opacity: pressed ? 0.75 : 1 })}
                >
                  <View style={{ width: 52, height: 40, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={v.maxPax > 5 ? "bus-outline" : "car-outline"} size={32} color={C.text} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "700", color: C.text }}>{v.name}</Text>
                    {similar ? <Text style={[T.caption, { fontWeight: "600", color: C.text }]}>{similar}</Text> : null}
                    <Text style={T.caption}>
                      {t("Up to " + plural(v.maxPax, "traveller", "en"), "Hasta " + plural(v.maxPax, "traveller", "es"))} · {v.luggage}
                    </Text>
                    {facts.length ? <Text style={[T.caption, { fontSize: 12, lineHeight: 16, color: C.muted }]}>{facts.join(" · ")}</Text> : null}
                  </View>
                  <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: "800", color: mode === "bid" ? C.muted : C.text }}>{cents(v.totalCents)}</Text>
                </Pressable>
              );
            })}
          </View>
          <BagNote />
          {quote?.vehicles.length ? <Text style={[T.caption, { textAlign: "center" }]}>{t("Price is for the whole vehicle, not per person. Taxes included.", "El precio es por todo el vehículo, no por persona. Impuestos incluidos.")}</Text> : null}
          <QuoteFacts brief />
        </ScrollView>

        <View style={{ paddingHorizontal: SP.lg, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 14), borderTopWidth: 1, borderTopColor: C.border }}>
          {state.whenSet ? (
            <Btn
              label={vehicle ? t("Choose " + vehicle.name, "Elegir " + vehicle.name) : t("Choose a vehicle", "Elija un vehículo")}
              onPress={() => nav.navigate("BookConfirm")}
              disabled={!canNext}
              busy={Boolean(quote) && quoteBusy}
            />
          ) : (
            <Btn label={t("Choose date and time", "Elija fecha y hora")} icon="calendar-outline" onPress={() => nav.navigate("BookWhen")} />
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
