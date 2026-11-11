import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useBooking } from "../../booking";
import { plural } from "../../format";
import { shortPlace } from "../../geo";
import { pick, tap } from "../../haptics";
import { useT, type Lang } from "../../i18n";
import { useNav } from "../../nav";
import { HUBS, driveTime } from "../../prices";
import { C, T } from "../../theme";
import type { Place } from "../../types";
import { Bar, Page, Text } from "../../ui";
import { usePopular } from "../../usePopular";
import { ChipBtn, FromBar, QuoteFacts, QuoteProblem, RouteDots } from "./parts";

/** A few words about each of our towns, for the list of destinations. */
const ABOUT: Record<Lang, Record<string, string>> = {
  en: {
    SJO: "San José international airport",
    LIR: "Guanacaste international airport",
    Arenal: "Volcano and hot springs",
    ManuelAntonio: "Pacific coast and national park",
    Monteverde: "Cloud forest",
    Sierpe: "Boat dock for Drake Bay",
    DrakeBay: "Osa Peninsula, reached by boat",
    PuertoViejo: "Caribbean coast",
    Tamarindo: "Guanacaste beaches",
  },
  es: {
    SJO: "Aeropuerto internacional de San José",
    LIR: "Aeropuerto internacional de Guanacaste",
    Arenal: "Volcán y aguas termales",
    ManuelAntonio: "Costa del Pacífico y parque nacional",
    Monteverde: "Bosque nuboso",
    Sierpe: "Muelle de botes hacia Bahía Drake",
    DrakeBay: "Península de Osa, se llega en bote",
    PuertoViejo: "Costa del Caribe",
    Tamarindo: "Playas de Guanacaste",
  },
};

/** Pickup and drop-off: two fields that open the place search, "Add a stop", "Set on map", then our towns one tap away. */
export function BookWhere() {
  const { lang, t } = useT();
  const nav = useNav();
  const { state, set, quote, stopsOn } = useBooking();
  const { prices } = usePopular();
  const [hint, setHint] = useState("");
  const { from, to } = state;
  const fromHub = from?.id.startsWith("hub:") ? from.id.slice(4) : "";
  const stops = quote && stopsOn ? state.stopIds.filter((id) => quote.stops.some((s) => s.id === id)).length : 0;

  function addStop() {
    if (!from || !to) return setHint(t("Choose your pickup and drop-off first, then you'll see the stops on the way.", "Primero elija su recogida y su destino; luego verá las paradas en el camino."));
    if (!quote) return setHint(t("One moment, we're checking this route.", "Un momento, estamos revisando esta ruta."));
    if (quote.stops.length === 0) return setHint(t("There are no stops to add on this route yet.", "Aún no hay paradas para agregar en esta ruta."));
    setHint("");
    nav.navigate("BookStops");
  }
  function choose(place: Place) {
    tap();
    set({ to: place, stopIds: [] });
    nav.navigate("BookRide");
  }

  return (
    <Page footer={<FromBar canNext={Boolean(quote && quote.vehicles.length)} onNext={() => nav.navigate("BookRide")} />}>
      <Bar style="dark" />
      <View style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}>
        <RouteDots inset={38} />
        <View style={{ flex: 1, gap: 10, minWidth: 0 }}>
          <PlaceField label={t("Pickup", "Recogida")} value={from?.label} next={!from} onPress={() => nav.navigate("PlaceSearch", { field: "from" })} />
          <PlaceField label={t("Drop-off", "Destino")} value={to?.label} next={Boolean(from) && !to} onPress={() => nav.navigate("PlaceSearch", { field: "to" })} />
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <ChipBtn icon="add" label={stops ? plural(stops, "stop", lang) : t("Add a stop", "Agregar una parada")} onPress={addStop} />
        <ChipBtn icon="location-outline" label={t("Set on map", "Elegir en el mapa")} onPress={() => nav.navigate("PlaceOnMap", { field: from ? "to" : "from" })} />
        {from && to ? (
          <ChipBtn
            icon="swap-vertical"
            label={t("Swap", "Invertir")}
            accessibilityLabel={t("Swap pickup and drop-off", "Intercambiar recogida y destino")}
            onPress={() => {
              pick();
              set({ from: to, to: from, stopIds: [] });
            }}
          />
        ) : null}
      </View>
      {hint ? (
        <Text accessibilityLiveRegion="polite" style={T.small}>
          {hint}
        </Text>
      ) : null}

      <QuoteProblem />
      {to ? <QuoteFacts /> : null}

      <View>
        <Text accessibilityRole="header" style={[T.label, { marginTop: 4, marginBottom: 4 }]}>
          {fromHub ? t("Popular from " + shortPlace(from?.label), "Populares desde " + shortPlace(from?.label)) : t("Popular destinations", "Destinos populares")}
        </Text>
        {HUBS.filter((h) => h.id !== from?.id).map((h) => {
          const id = h.id.slice(4);
          const p = fromHub ? prices[fromHub + ">" + id] : undefined;
          const on = to?.id === h.id;
          return (
            <Pressable
              key={h.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={h.label + (p ? ", " + driveTime(p.minutes) : "")}
              onPress={() => choose(h)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 64, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: on ? C.emeraldSoft : C.surface, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={id === "SJO" || id === "LIR" ? "airplane-outline" : "location-outline"} size={20} color={on ? C.emerald : C.text} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "700", color: C.text }}>{h.label}</Text>
                {ABOUT[lang][id] ? <Text style={T.caption}>{ABOUT[lang][id]}</Text> : null}
              </View>
              {p ? <Text style={{ fontSize: 14, lineHeight: 19, fontWeight: "700", color: C.emerald }}>{driveTime(p.minutes)}</Text> : <Ionicons name="chevron-forward" size={18} color={C.faint} />}
            </Pressable>
          );
        })}
        <Text style={[T.small, { paddingTop: 14 }]}>{t("Staying somewhere else? Tap Drop-off and type the hotel's name or the address.", "¿Se hospeda en otro lugar? Toque Destino y escriba el nombre del hotel o la dirección.")}</Text>
      </View>
    </Page>
  );
}

/** A labelled box that looks like a text field and opens the place search. `next` marks the one to fill in now. */
function PlaceField({ label, value, next, onPress }: { label: string; value?: string; next: boolean; onPress: () => void }) {
  const { t } = useT();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[T.label, { letterSpacing: 0.5 }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label + ": " + (value ?? t("Hotel, town or airport", "Hotel, pueblo o aeropuerto"))}
        onPress={onPress}
        style={({ pressed }) => ({ minHeight: 50, justifyContent: "center", borderRadius: 12, borderWidth: next ? 2 : 1, borderColor: next ? C.emerald : C.border, backgroundColor: C.card, paddingHorizontal: next ? 13 : 14, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "600", color: value ? C.text : C.faint }} numberOfLines={2}>
          {value ?? t("Hotel, town or airport", "Hotel, pueblo o aeropuerto")}
        </Text>
      </Pressable>
    </View>
  );
}
