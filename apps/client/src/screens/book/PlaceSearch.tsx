import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBooking } from "../../booking";
import { SITE_URL } from "../../config";
import { useDemo } from "../../demo";
import { pick } from "../../haptics";
import { useT } from "../../i18n";
import { useNav, type RootParams } from "../../nav";
import { HUBS } from "../../prices";
import { C, R, S, SP, T, fontFor } from "../../theme";
import type { Place } from "../../types";
import { Bar, Skeleton, Text, type IconName } from "../../ui";

const RECENT_KEY = "recent-places-v1";
const newSession = () => "s" + Math.random().toString(36).slice(2) + Date.now().toString(36);

interface Suggestion {
  placeId: string;
  main: string;
  secondary: string;
}

/**
 * The full-screen place search that slides up from step 1. Before typing: the
 * places this phone searched for recently, then our towns and airports. While
 * typing: matching towns, then hotels and addresses from Google (through our
 * server, Costa Rica only).
 */
export function PlaceSearch() {
  const { t } = useT();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const header = useHeaderHeight();
  const demo = useDemo();
  const { field } = useRoute<RouteProp<RootParams, "PlaceSearch">>().params;
  const { state, set } = useBooking();
  const isStop = field === "stop";
  const current = isStop ? null : state[field];
  const [text, setText] = useState(demo?.found ? "Tabac" : "");
  const [found, setFound] = useState<Suggestion[]>(demo?.found ?? []);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<Place[]>([]);
  const [error, setError] = useState("");
  const session = useRef(newSession());
  const q = text.trim();

  useEffect(() => {
    if (demo) return;
    AsyncStorage.getItem(RECENT_KEY)
      .then((v) => setRecent(v ? (JSON.parse(v) as Place[]) : []))
      .catch(() => {});
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    if (q.length < 3) {
      setFound([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(SITE_URL + "/api/places/suggest?q=" + encodeURIComponent(q) + "&session=" + session.current);
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        setFound(data.suggestions ?? []);
      } catch {
        setFound([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(id);
  }, [q, demo]);

  function choose(place: Place, remember: boolean) {
    pick();
    if (isStop) {
      // One more stop of the traveller's own, 1 hour to start with; never the pickup, the drop-off or a place twice.
      const taken = [state.from?.id, state.to?.id, ...state.customStops.map((s) => s.id)];
      if (!taken.includes(place.id)) set({ customStops: [...state.customStops, { id: place.id, label: place.label, minutes: 60 }] });
    }
    // A new pickup or drop-off means new stops on the way.
    else set({ [field]: place, stopIds: [], customStops: [] });
    if (remember) {
      const next = [place, ...recent.filter((r) => r.id !== place.id)].slice(0, 5);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
    }
    nav.goBack();
  }

  async function pickGoogle(s: Suggestion) {
    setError("");
    try {
      const res = await fetch(SITE_URL + "/api/places/lookup?id=" + s.placeId + "&label=" + encodeURIComponent(s.main) + "&session=" + session.current);
      const data = (await res.json()) as { place?: Place; error?: string };
      if (!data.place) return setError(data.error ?? t("We couldn't find that place.", "No pudimos encontrar ese lugar."));
      session.current = newSession();
      // The map point is kept only to draw the route; prices never use it.
      const { lat, lng } = data.place;
      choose({ id: data.place.id, label: data.place.label, ...(typeof lat === "number" && typeof lng === "number" ? { lat, lng } : {}) }, true);
    } catch {
      setError(t("We couldn't find that place. Check your connection.", "No pudimos encontrar ese lugar. Revise su conexión."));
    }
  }

  // A stop is any place from the search; our towns and airports are pickups and drop-offs.
  const hubs = isStop ? [] : HUBS.filter((h) => q.length < 2 || h.label.toLowerCase().includes(q.toLowerCase()));
  const recents = q.length < 2 ? recent.filter((r) => !r.id.startsWith("hub:")) : [];
  const label = field === "from" ? t("Pickup", "Recogida") : isStop ? t("Stop", "Parada") : t("Drop-off", "Destino");

  return (
    <KeyboardAvoidingView style={S.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={header}>
      <Bar style="dark" />
      <View style={{ paddingHorizontal: SP.page, paddingBottom: SP.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderWidth: 2, borderColor: C.emerald, borderRadius: R.pill, paddingHorizontal: 18, minHeight: 56 }}>
          <Ionicons name="search" size={20} color={C.emerald} />
          <TextInput
            accessibilityLabel={label}
            value={text}
            onChangeText={setText}
            autoFocus={!demo}
            placeholder={isStop ? t("Waterfall, garden, restaurant…", "Catarata, jardín, restaurante…") : t("Airport, town, hotel or address", "Aeropuerto, pueblo, hotel o dirección")}
            placeholderTextColor={C.faint}
            autoCorrect={false}
            returnKeyType="search"
            maxFontSizeMultiplier={1.35}
            style={{ flex: 1, fontSize: 17, color: C.text, paddingVertical: 12, fontFamily: fontFor("500") }}
          />
          {text ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t("Clear ", "Borrar ") + label.toLowerCase()} hitSlop={12} onPress={() => setText("")}>
              <Ionicons name="close-circle" size={20} color={C.faint} />
            </Pressable>
          ) : null}
        </View>
        {error ? <Text style={[S.error, { marginTop: 8 }]}>{error}</Text> : null}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: SP.page, paddingBottom: insets.bottom + SP.xl }} showsVerticalScrollIndicator={false}>
        {recents.length ? (
          <>
            <Text style={[T.label, { marginTop: 4, marginBottom: 4 }]}>{t("Recent", "Recientes")}</Text>
            {recents.map((r) => (
              <Row key={r.id} icon="time-outline" main={r.label} on={current?.id === r.id} onPress={() => choose(r, true)} />
            ))}
          </>
        ) : null}
        {hubs.length ? <Text style={[T.label, { marginTop: recents.length ? 16 : 4, marginBottom: 4 }]}>{t("Airports and towns", "Aeropuertos y pueblos")}</Text> : null}
        {hubs.map((h) => (
          <Row key={h.id} icon={h.id === "hub:SJO" || h.id === "hub:LIR" ? "airplane-outline" : "location-outline"} main={h.label} on={current?.id === h.id} onPress={() => choose(h, false)} />
        ))}
        {q.length >= 3 ? (
          <>
            <Text style={[T.label, { marginTop: 16, marginBottom: 4 }]}>{isStop ? t("Places", "Lugares") : t("Hotels and addresses", "Hoteles y direcciones")}</Text>
            {searching && found.length === 0 ? (
              <View style={{ gap: 14, paddingVertical: 10 }}>
                <Skeleton height={20} width="70%" />
                <Skeleton height={20} width="55%" />
              </View>
            ) : null}
            {found.map((s) => (
              <Row key={s.placeId} icon="business-outline" main={s.main} secondary={s.secondary} onPress={() => void pickGoogle(s)} />
            ))}
            {!searching && found.length === 0 ? <Text style={[T.small, { paddingVertical: 10 }]}>{t("Nothing found. Try the hotel's full name or the town.", "No encontramos nada. Pruebe con el nombre completo del hotel o el pueblo.")}</Text> : null}
            {found.length > 0 ? <Text style={[T.caption, { textAlign: "right", paddingTop: 8 }]}>{t("Powered by Google", "Con tecnología de Google")}</Text> : null}
          </>
        ) : q.length < 2 ? (
          <Text style={[T.small, { paddingTop: 16 }]}>
            {isStop
              ? t("Type the name of the place you'd like to visit on the way.", "Escriba el nombre del lugar que quiere visitar en el camino.")
              : t("Staying somewhere else? Type the hotel's name or the address.", "¿Se hospeda en otro lugar? Escriba el nombre del hotel o la dirección.")}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ icon, main, secondary, on, onPress }: { icon: IconName; main: string; secondary?: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(on) }}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, opacity: pressed ? 0.5 : 1 })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: on ? C.emeraldSoft : C.surface, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={on ? C.emerald : C.body} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={T.bodyStrong}>{main}</Text>
        {secondary ? <Text style={T.small}>{secondary}</Text> : null}
      </View>
      {on ? <Ionicons name="checkmark" size={20} color={C.emerald} /> : null}
    </Pressable>
  );
}
