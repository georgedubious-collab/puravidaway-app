import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { cents, useBooking } from "../../booking";
import { plural } from "../../format";
import { pick } from "../../haptics";
import { useT, type Lang } from "../../i18n";
import { photoFor } from "../../images";
import { useNav } from "../../nav";
import { Photo } from "../../Photo";
import { C, S, SP, T } from "../../theme";
import { Bar, Card, Choice, FieldLabel, IconLine, Input, Page, Stepper, Text, Toggle } from "../../ui";
import { PriceBar, StepIntro } from "./parts";

const ENTRANCE: Record<Lang, Record<string, string>> = {
  en: { free: "Free stop, no entrance fee", included: "Entrance included", gate: "Entrance paid at the gate" },
  es: { free: "Parada gratis, sin entrada", included: "Entrada incluida", gate: "Entrada pagada en la puerta" },
};

/** Step 4 of 5 — Make it yours: stops on the way, the driver's language, extras, a message, the flight. All optional. */
export function BookExtras() {
  const { lang, t } = useT();
  const nav = useNav();
  const { state, set, toggleStop, quote, quoteBusy, vehicle, stopsOn, spanishDriver, effectivePrefs, notesBlocked, itemCents, offerValid, extrasCount } = useBooking();
  const { prefs, mode, pax } = state;
  const canNext = Boolean(vehicle) && !notesBlocked && (mode === "fixed" || offerValid);

  return (
    <Page
      footer={
        <PriceBar
          label={mode === "bid" ? t("Your offer", "Su oferta") : vehicle ? "Total · " + vehicle.name : "Total"}
          amount={!vehicle || (mode === "bid" && !offerValid) ? "—" : cents(itemCents)}
          note={t("For the whole car, taxes included", "Por todo el vehículo, impuestos incluidos")}
          action={extrasCount === 0 ? t("Skip", "Omitir") : t("Continue", "Continuar")}
          onPress={() => nav.navigate("BookReview")}
          disabled={!canNext}
          busy={quoteBusy}
        />
      }
    >
      <Bar style="dark" />
      <StepIntro step={4} title={t("Make it yours", "Hágalo a su medida")} subtitle={t("Everything here is optional. Skip it if you just want the ride.", "Todo aquí es opcional. Omítalo si solo quiere el traslado.")} />

      {quote && quote.stops.length > 0 ? (
        <View style={{ gap: SP.md }}>
          <View style={{ gap: 2 }}>
            <Text style={T.h2}>{t("Add a stop on the way", "Agregue una parada en el camino")}</Text>
            <Text style={T.small}>
              {stopsOn
                ? t("Your driver waits while you visit.", "Su conductor espera mientras usted la visita.")
                : t((vehicle?.name ?? "This vehicle") + " is a direct ride. Choose another vehicle to add stops.", (vehicle?.name ?? "Este vehículo") + " es un traslado directo. Elija otro vehículo para agregar paradas.")}
            </Text>
          </View>
          {stopsOn
            ? quote.stops.map((s) => {
                const on = state.stopIds.includes(s.id);
                return (
                  <Pressable
                    key={s.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={s.name + ", +" + cents(s.cents)}
                    onPress={() => {
                      pick();
                      toggleStop(s.id);
                    }}
                    style={({ pressed }) => [S.card, { padding: 0, gap: 0, overflow: "hidden", borderWidth: on ? 2 : 0, borderColor: C.emerald, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Photo name={"stop:" + s.id} fallback={photoFor(s.name)} style={{ height: 120 }}>
                      <View style={{ position: "absolute", right: 12, top: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={on ? "checkbox" : "square-outline"} size={24} color={on ? C.emerald : C.faint} />
                      </View>
                    </Photo>
                    <View style={{ padding: SP.lg - (on ? 2 : 0), gap: 4 }}>
                      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                        <Text style={[T.h3, { flex: 1 }]}>{s.name}</Text>
                        <Text style={[T.h3, { color: C.emerald }]}>+{cents(s.cents)}</Text>
                      </View>
                      <Text style={T.small}>{s.description}</Text>
                      {s.tourPerPersonCents ? (
                        <Text style={T.small}>
                          {t("Guided visit " + cents(s.tourPerPersonCents) + " per person, included for " + plural(pax, "traveller", "en"), "Visita guiada " + cents(s.tourPerPersonCents) + " por persona, incluida para " + plural(pax, "traveller", "es"))}
                        </Text>
                      ) : null}
                      <Text style={T.caption}>
                        {t("Adds ", "Agrega ") + s.durationMin} min{ENTRANCE[lang][s.entrance] ? " · " + ENTRANCE[lang][s.entrance] : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            : null}
        </View>
      ) : null}

      <Card>
        <Text style={T.h2}>{t("Your driver & extras", "Su conductor y extras")}</Text>
        <FieldLabel>{t("Driver's language", "Idioma del conductor")}</FieldLabel>
        <Choice icon="chatbubbles-outline" title={t("English-speaking driver", "Conductor que habla inglés")} on={effectivePrefs.language === "english"} disabled={spanishDriver} onPress={() => set({ prefs: { ...prefs, language: "english" } })} />
        <Choice icon="chatbubble-ellipses-outline" title={t("Spanish or basic English is fine", "Español o inglés básico está bien")} on={effectivePrefs.language === "spanish_ok"} onPress={() => set({ prefs: { ...prefs, language: "spanish_ok" } })} />
        {spanishDriver && vehicle ? (
          <Text style={T.small}>
            {t(vehicle.name + " has a Spanish-speaking driver. For an English-speaking driver, choose another vehicle.", vehicle.name + " tiene un conductor que habla español. Para un conductor que hable inglés, elija otro vehículo.")}
          </Text>
        ) : null}
        <View style={{ height: 4 }} />
        <FieldLabel>{t("Extras (free, subject to availability)", "Extras (gratis, según disponibilidad)")}</FieldLabel>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 }}>
          <Ionicons name="happy-outline" size={22} color={C.muted} />
          <Text style={[T.bodyStrong, { flex: 1 }]}>{t("Baby / child seats", "Sillas para bebé / niño")}</Text>
          <Stepper value={prefs.childSeats} min={0} max={4} onChange={(childSeats) => set({ prefs: { ...prefs, childSeats } })} lessLabel={t("One fewer child seat", "Una silla menos")} moreLabel={t("One more child seat", "Una silla más")} />
        </View>
        {prefs.childSeats > 0 ? <Text style={T.small}>{t("Add the children's ages in the message below so the right seats come along.", "Escriba la edad de los niños en el mensaje de abajo para llevar las sillas correctas.")}</Text> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Toggle icon="wifi-outline" label={t("Wi-Fi on board", "Wi-Fi a bordo")} on={prefs.wifi} onPress={() => set({ prefs: { ...prefs, wifi: !prefs.wifi } })} />
          <Toggle icon="cart-outline" label={t("Stroller", "Coche de bebé")} on={prefs.stroller} onPress={() => set({ prefs: { ...prefs, stroller: !prefs.stroller } })} />
          <Toggle icon="paw-outline" label={t("Travelling with a pet", "Viajo con mascota")} on={prefs.pets} onPress={() => set({ prefs: { ...prefs, pets: !prefs.pets } })} />
        </View>
      </Card>

      <Card>
        <FieldLabel>{t("Message for your driver (optional)", "Mensaje para su conductor (opcional)")}</FieldLabel>
        <Input
          accessibilityLabel={t("Message for your driver", "Mensaje para su conductor")}
          value={state.driverNotes}
          onChangeText={(driverNotes) => set({ driverNotes })}
          multiline
          maxLength={500}
          placeholder={t("e.g. Kids are 2 and 5 · a stop for fresh fruit · large surfboard bag", "p. ej. Los niños tienen 2 y 5 años · una parada para fruta · bolsa de tabla de surf grande")}
          style={{ minHeight: 104, textAlignVertical: "top" }}
        />
        {notesBlocked ? (
          <Text accessibilityRole="alert" style={S.error}>
            {t("Please leave out phone numbers, emails and links. You and your driver can message each other in the trip chat once confirmed.", "Por favor no incluya teléfonos, correos ni enlaces. Usted y su conductor podrán escribirse en el chat del viaje una vez confirmado.")}
          </Text>
        ) : null}
        <View style={{ height: 4 }} />
        <FieldLabel>{quote?.airportPickup ? t("Flight number, so we can track it", "Número de vuelo, para darle seguimiento") : t("Flight number or hotel name (optional)", "Número de vuelo o nombre del hotel (opcional)")}</FieldLabel>
        <Input accessibilityLabel={t("Flight number or hotel", "Número de vuelo u hotel")} value={state.notes} onChangeText={(notes) => set({ notes })} maxLength={200} placeholder={t("e.g. AA 1234", "p. ej. AA 1234")} />
      </Card>

      {vehicle ? (
        <Card tone="flat">
          <Text style={T.label}>{t("Every ride includes", "Cada traslado incluye")}</Text>
          {quote?.airportPickup ? <IconLine small icon="airplane-outline" color={C.emerald} text={t("Flight tracking: we follow your flight, so a delay doesn't leave you stranded.", "Seguimiento del vuelo: seguimos su vuelo, así que un retraso no lo deja esperando.")} /> : null}
          <IconLine small icon="time-outline" color={C.emerald} text={t("60 min free waiting after your flight lands or your pickup time.", "60 min de espera gratis después de que aterrice su vuelo o de la hora de recogida.")} />
          <IconLine small icon="happy-outline" color={C.emerald} text={t("Child seats free on request.", "Sillas para niños gratis si las pide.")} />
          <IconLine small icon="shield-checkmark-outline" color={C.emerald} text={t("Free cancellation up to 24 hours before pickup.", "Cancelación gratis hasta 24 horas antes de la recogida.")} />
        </Card>
      ) : null}
    </Page>
  );
}
