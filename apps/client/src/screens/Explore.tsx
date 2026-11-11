import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useBooking } from "../booking";
import { useDemo } from "../demo";
import { pick } from "../haptics";
import { useT } from "../i18n";
import { useNav } from "../nav";
import { C, R, S, SHADOW } from "../theme";
import { Text } from "../ui";
import { Home } from "./Home";
import { ToursHome } from "./Tours";

export type ExploreMode = "rides" | "tours";
const KEY = "explore-mode-v1";

/**
 * The Explore tab: private rides (a map with "Where from? / Where to?") or day
 * tours (photos first), chosen with the switch at the top. The phone remembers
 * which side was open last.
 */
export function Explore() {
  const demo = useDemo();
  const focused = useIsFocused();
  const { state, set } = useBooking();
  const [mode, setModeState] = useState<ExploreMode | null>(demo ? (demo.explore ?? "rides") : null);

  useEffect(() => {
    if (demo) return;
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (live) setModeState(v === "tours" ? "tours" : "rides");
      })
      .catch(() => {
        if (live) setModeState("rides");
      });
    return () => {
      live = false;
    };
  }, [demo]);

  const setMode = useCallback((m: ExploreMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  // What is being planned follows the side that is showing (prices for a ride, the tour list for tours).
  // Only while this tab is the screen in front, so a booking started elsewhere is never switched under the traveller.
  const want = mode === "tours" ? "tour" : "ride";
  useEffect(() => {
    if (mode && focused && state.kind !== want) set({ kind: want });
  }, [mode, focused, state.kind, want, set]);

  if (!mode) return <View style={S.screen} />;
  return mode === "rides" ? <Home top={<ExploreTop mode={mode} onMode={setMode} floating />} /> : <ToursHome top={<ExploreTop mode={mode} onMode={setMode} />} />;
}

/** The row at the top of Explore: the round menu button and the "Rides | Day tours" switch. `floating` sits on the map. */
function ExploreTop({ mode, onMode, floating }: { mode: ExploreMode; onMode: (m: ExploreMode) => void; floating?: boolean }) {
  const { t } = useT();
  const nav = useNav();
  const options: { id: ExploreMode; label: string }[] = [
    { id: "rides", label: t("Rides", "Traslados") },
    { id: "tours", label: t("Day tours", "Tours de un día") },
  ];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Open menu", "Abrir menú")}
        onPress={() => nav.navigate("Menu")}
        style={({ pressed }) => [{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.card, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }, floating ? SHADOW : { borderWidth: 1, borderColor: C.border }]}
      >
        <Ionicons name="menu" size={24} color={C.text} />
      </Pressable>
      <View accessibilityRole="tablist" style={[{ flex: 1, flexDirection: "row", padding: 4, borderRadius: R.pill, backgroundColor: floating ? C.card : C.surface }, floating ? SHADOW : null]}>
        {options.map((o) => {
          const on = o.id === mode;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (on) return;
                pick();
                onMode(o.id);
              }}
              style={{ flex: 1, minHeight: 44, borderRadius: R.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, backgroundColor: on ? C.emerald : "transparent" }}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.15} style={{ fontSize: 15, lineHeight: 20, fontWeight: "700", color: on ? "#fff" : C.muted }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
