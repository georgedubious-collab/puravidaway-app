import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { Pressable, View } from "react-native";
import { cents, useBooking } from "../../booking";
import { plural } from "../../format";
import { pick } from "../../haptics";
import { useT, type Lang } from "../../i18n";
import { photoFor } from "../../images";
import { useNav } from "../../nav";
import { driveTime } from "../../prices";
import { useSession } from "../../session";
import { Photo } from "../../Photo";
import { C, S, SP, T } from "../../theme";
import { Bar, Btn, Card, Choice, FieldLabel, Input, Page, Text, Toggle } from "../../ui";
import { PriceBar } from "./parts";

const ENTRANCE: Record<Lang, Record<string, string>> = {
  en: { free: "Free stop, no entrance fee", included: "Entrance included", gate: "Entrance paid at the gate" },
  es: { free: "Parada gratis, sin entrada", included: "Entrada incluida", gate: "Entrada pagada en la puerta" },
};

/** The bar under both panels: the ride's total as it stands, and "Done". */
function DoneBar() {
  const { t } = useT();
  const nav = useNav();
  const { quoteBusy, vehicle, itemCents } = useBooking();
  return (
    <PriceBar
      label={vehicle ? "Total · " + vehicle.name : "Total"}
      amount={!vehicle ? "—" : cents(itemCents)}
      note={t("For the whole car, taxes included", "Por todo el vehículo, impuestos incluidos")}
      action={t("Done", "Listo")}
      icon={null}
      onPress={() => nav.goBack()}
      busy={quoteBusy}
    />
  );
}

/** Slide-up panel: sightseeing stops on the way, each with its price, how long it adds and its entrance. All optional. */
export function BookStops() {
  const { lang, t } = useT();
  const { state, toggleStop, quote, vehicle, stopsOn, ownStopsOn } = useBooking();
  const stops = quote?.stops ?? [];
  return (
    <Page footer={<DoneBar />}>
      <Bar style="dark" />
      <Text style={T.body}>
        {stops.length === 0
          ? ownStopsOn && stopsOn
            ? t("There are no ready-made stops on this route yet. Add your own below.", "Aún no hay paradas listas en esta ruta. Agregue la suya abajo.")
            : t("There are no stops to add on this route yet.", "Aún no hay paradas para agregar en esta ruta.")
          : stopsOn
            ? t("Your driver waits while you visit. The price of each stop is added to your ride.", "Su conductor espera mientras usted la visita. El precio de cada parada se suma a su traslado.")
            : t((vehicle?.name ?? "This vehicle") + " is a direct ride. Choose another vehicle to add stops.", (vehicle?.name ?? "Este vehículo") + " es un traslado directo. Elija otro vehículo para agregar paradas.")}
      </Text>
      {stopsOn
        ? stops.map((s) => {
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
                      {t("Guided visit " + cents(s.tourPerPersonCents) + " per person, included for " + plural(state.pax, "traveller", "en"), "Visita guiada " + cents(s.tourPerPersonCents) + " por persona, incluida para " + plural(state.pax, "traveller", "es"))}
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
      {stopsOn && ownStopsOn ? <OwnStops /> : null}
    </Page>
  );
}

const OWN_ENTRANCE: Record<Lang, string> = {
  en: "Entrance tickets not included; paid at the place",
  es: "Entradas no incluidas; se pagan en el lugar",
};

/**
 * "Add your own stop": any place from the place search and how long to stay. The server
 * measures the extra driving and prices each stop (waiting time + extra driving); nothing is
 * calculated here. Past the limits the server says so and the traveller is pointed to our team.
 */
function OwnStops() {
  const { lang, t } = useT();
  const nav = useNav();
  const { whatsapp } = useSession();
  const { state, set, quote, quoteBusy, ownStops, ownStopsError, ownStopsAskUs } = useBooking();
  const custom = quote?.custom;
  if (!custom) return null;
  const mine = state.customStops;
  const choices = custom.minuteChoices.filter((m) => m <= custom.limits.maxWaitMinutes);
  const full = mine.length >= custom.limits.maxStops;
  const askUs = () => void Linking.openURL("https://wa.me/" + whatsapp + "?text=" + encodeURIComponent(t("Hi! I'd like a quote for a ride with several stops.", "¡Hola! Quisiera una cotización para un traslado con varias paradas.")));
  return (
    <Card>
      <Text accessibilityRole="header" style={T.h3}>
        {t("Add your own stop", "Agregue su propia parada")}
      </Text>
      <Text style={T.small}>
        {t(
          "A waterfall, a garden, a restaurant: search any place and choose how long you stay. Up to " + custom.limits.maxStops + " stops, in the order you add them. The price is the waiting time plus the extra driving.",
          "Una catarata, un jardín, un restaurante: busque cualquier lugar y elija cuánto tiempo se queda. Hasta " + custom.limits.maxStops + " paradas, en el orden en que las agrega. El precio es el tiempo de espera más el recorrido adicional.",
        )}
      </Text>
      {mine.map((s, i) => {
        const priced = ownStops[i] && ownStops[i].id === s.id && ownStops[i].minutes === s.minutes ? ownStops[i] : null;
        return (
          <View key={s.id} style={{ borderWidth: 2, borderColor: C.emerald, borderRadius: 16, padding: SP.md, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <Text style={[T.bodyStrong, { flex: 1 }]}>{i + 1 + ". " + s.label}</Text>
              <Text style={[T.bodyStrong, { color: C.emerald }]}>{priced ? "+" + cents(priced.cents) : quoteBusy && !ownStopsError ? "…" : ""}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Remove ", "Quitar ") + s.label}
                hitSlop={12}
                onPress={() => {
                  pick();
                  set({ customStops: mine.filter((x) => x.id !== s.id) });
                }}
              >
                <Ionicons name="trash-outline" size={22} color={C.body} />
              </Pressable>
            </View>
            <Text style={T.caption}>{t("Time there", "Tiempo en el lugar")}</Text>
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {choices.map((m) => (
                <Toggle key={m} icon="time-outline" label={driveTime(m)} on={s.minutes === m} onPress={() => set({ customStops: mine.map((x) => (x.id === s.id ? { ...x, minutes: m } : x)) })} />
              ))}
            </View>
            {priced ? (
              <Text style={T.caption}>
                {priced.detourMin > 0 || priced.detourKm > 0
                  ? t("Adds " + Math.round(priced.detourKm) + " km / " + driveTime(priced.detourMin) + " of driving", "Agrega " + Math.round(priced.detourKm) + " km / " + driveTime(priced.detourMin) + " de recorrido")
                  : t("On your way", "Queda de camino")}
              </Text>
            ) : null}
            <Text style={T.caption}>{OWN_ENTRANCE[lang]}</Text>
          </View>
        );
      })}
      {ownStopsError ? (
        <Text accessibilityRole="alert" style={S.error}>
          {ownStopsError}
        </Text>
      ) : null}
      {(ownStopsError && ownStopsAskUs) || full ? (
        <>
          {full && !ownStopsError ? (
            <Text style={T.small}>
              {t(
                "That's the most stops of your own on one ride. For a longer route, message us and we'll quote it.",
                "Ese es el máximo de paradas propias en un traslado. Para un recorrido más largo, escríbanos y le cotizamos.",
              )}
            </Text>
          ) : null}
          {whatsapp ? <Btn alt icon="logo-whatsapp" label={t("Message our team", "Escribir a nuestro equipo")} onPress={askUs} /> : null}
        </>
      ) : null}
      {!full ? <Btn alt icon="search" label={mine.length ? t("Add another stop", "Agregar otra parada") : t("Search a place", "Buscar un lugar")} onPress={() => nav.navigate("PlaceSearch", { field: "stop" })} /> : null}
    </Card>
  );
}

/** Slide-up panel: the driver's language, the free extras and a message for the driver. All optional. */
export function BookExtras() {
  const { t } = useT();
  const { state, set, vehicle, spanishDriver, effectivePrefs, notesBlocked } = useBooking();
  const { prefs } = state;
  return (
    <Page footer={<DoneBar />}>
      <Bar style="dark" />
      <Card>
        <FieldLabel>{t("Driver's language", "Idioma del conductor")}</FieldLabel>
        <Choice icon="chatbubbles-outline" title={t("English-speaking driver", "Conductor que habla inglés")} on={effectivePrefs.language === "english"} disabled={spanishDriver} onPress={() => set({ prefs: { ...prefs, language: "english" } })} />
        <Choice icon="chatbubble-ellipses-outline" title={t("Spanish or basic English is fine", "Español o inglés básico está bien")} on={effectivePrefs.language === "spanish_ok"} onPress={() => set({ prefs: { ...prefs, language: "spanish_ok" } })} />
        {spanishDriver && vehicle ? (
          <Text style={T.small}>
            {t(vehicle.name + " has a Spanish-speaking driver. For an English-speaking driver, choose another vehicle.", vehicle.name + " tiene un conductor que habla español. Para un conductor que hable inglés, elija otro vehículo.")}
          </Text>
        ) : null}
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
      </Card>
    </Page>
  );
}
