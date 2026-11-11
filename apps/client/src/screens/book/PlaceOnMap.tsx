import { useRoute, type RouteProp } from "@react-navigation/native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useBooking } from "../../booking";
import { pointOfPlace, shortPlace, type MapPoint } from "../../geo";
import { pick } from "../../haptics";
import { useT } from "../../i18n";
import { RouteMap } from "../../MapView";
import { useNav, type RootParams } from "../../nav";
import { HUBS } from "../../prices";
import { S, SP, T } from "../../theme";
import { Bar, BottomBar, Btn, Chip, Text } from "../../ui";

/**
 * Slide-up panel: choose the pickup or drop-off by tapping one of our towns and
 * airports on the map (or its name under the map). Hotels and addresses are
 * found with the search instead.
 */
export function PlaceOnMap() {
  const { t } = useT();
  const nav = useNav();
  const { field } = useRoute<RouteProp<RootParams, "PlaceOnMap">>().params;
  const { state, set } = useBooking();
  const other = field === "from" ? state.to : state.from;
  const options = HUBS.filter((h) => h.id !== other?.id);
  const [picked, setPicked] = useState<string | null>(state[field]?.id.startsWith("hub:") && state[field]?.id !== other?.id ? (state[field]?.id ?? null) : null);
  const place = options.find((h) => h.id === picked);

  const points: MapPoint[] = [];
  for (const h of options) {
    const at = pointOfPlace(h);
    if (at) points.push({ ...at, kind: "place", id: h.id, selected: h.id === picked, label: h.id === picked ? shortPlace(h.label) : undefined });
  }
  function choose(id: string) {
    pick();
    setPicked(id);
  }

  return (
    <View style={S.screen}>
      <Bar style="dark" />
      <RouteMap style={{ flex: 1 }} points={points} country onPressPoint={choose} pad={{ top: 8, bottom: 8 }} />
      <View style={{ paddingTop: SP.md, gap: SP.sm }}>
        <Text style={[T.small, { paddingHorizontal: SP.page }]}>{t("Tap a town or an airport. For a hotel or an address, use the search.", "Toque un pueblo o un aeropuerto. Para un hotel o una dirección, use la búsqueda.")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: SP.page, paddingBottom: SP.md }} accessibilityRole="radiogroup">
          {options.map((h) => (
            <Chip key={h.id} label={shortPlace(h.label)} on={h.id === picked} onPress={() => setPicked(h.id)} />
          ))}
        </ScrollView>
      </View>
      <BottomBar>
        <Btn
          label={place ? (field === "from" ? t("Pick up at " + shortPlace(place.label), "Recoger en " + shortPlace(place.label)) : t("Go to " + shortPlace(place.label), "Ir a " + shortPlace(place.label))) : t("Choose a place", "Elija un lugar")}
          disabled={!place}
          onPress={() => {
            if (!place) return;
            // A new pickup or drop-off means new stops on the way.
            set({ [field]: place, stopIds: [] });
            nav.goBack();
          }}
        />
      </BottomBar>
    </View>
  );
}
