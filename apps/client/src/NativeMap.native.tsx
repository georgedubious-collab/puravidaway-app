import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, type ComponentType } from "react";
import { View } from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import { COSTA_RICA, type LatLng } from "./geo";
import type { RouteMapProps } from "./MapView";
import { C } from "./theme";
import { Text } from "./ui";

const COUNTRY: Region = {
  latitude: (COSTA_RICA.minLat + COSTA_RICA.maxLat) / 2,
  longitude: (COSTA_RICA.minLng + COSTA_RICA.maxLng) / 2,
  latitudeDelta: COSTA_RICA.maxLat - COSTA_RICA.minLat + 0.6,
  longitudeDelta: COSTA_RICA.maxLng - COSTA_RICA.minLng + 0.6,
};
const CORNERS: LatLng[] = [
  { lat: COSTA_RICA.minLat, lng: COSTA_RICA.minLng },
  { lat: COSTA_RICA.maxLat, lng: COSTA_RICA.maxLng },
];
const coord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

/**
 * The real map on a phone: Apple Maps on iPhone, Google Maps on Android (only
 * used there when the build has a Google Maps key; RouteMap decides). Same pins
 * as the drawn map; the line is dashed because it runs straight between the
 * points, not along the road.
 */
function PhoneMap({ points, line, lineStyle = "solid", pill, country, pad, onPressPoint, style }: RouteMapProps) {
  const map = useRef<MapView>(null);
  const ready = useRef(false);
  const top = (pad?.top ?? 0) + 48;
  const right = (pad?.right ?? 0) + 48;
  const bottom = (pad?.bottom ?? 0) + 48;
  const left = (pad?.left ?? 0) + 48;
  // Refit only when something on the map actually moves.
  const key = JSON.stringify([country, points.map((p) => [p.lat, p.lng]), (line ?? []).map((p) => [p.lat, p.lng]), top, right, bottom, left]);

  const fit = useCallback(
    (animated: boolean) => {
      const all: LatLng[] = [...points, ...(line ?? [])];
      const show = country || all.length === 0 ? CORNERS : all;
      if (show.length === 1) {
        map.current?.animateToRegion({ ...coord(show[0]), latitudeDelta: 0.5, longitudeDelta: 0.5 }, animated ? 300 : 0);
        return;
      }
      map.current?.fitToCoordinates(show.map(coord), { edgePadding: { top, right, bottom, left }, animated });
    },
    // `key` stands for points, line, country and the padding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  useEffect(() => {
    if (ready.current) fit(true);
  }, [fit]);

  const mid = line && line.length >= 2 ? { lat: (line[0].lat + line[line.length - 1].lat) / 2, lng: (line[0].lng + line[line.length - 1].lng) / 2 } : null;

  return (
    <MapView
      ref={map}
      style={style}
      initialRegion={COUNTRY}
      onMapReady={() => {
        ready.current = true;
        fit(false);
      }}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      showsCompass={false}
    >
      {line && line.length >= 2 ? <Polyline coordinates={line.map(coord)} strokeColor={C.emerald} strokeWidth={5} lineCap="round" lineDashPattern={lineStyle === "dotted" ? [2, 10] : [14, 8]} /> : null}
      {mid && pill ? (
        <Marker coordinate={coord(mid)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} tappable={false}>
          <View style={{ backgroundColor: C.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text maxFontSizeMultiplier={1.15} style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
              {pill}
            </Text>
          </View>
        </Marker>
      ) : null}
      {points.map((p, i) => (
        <Marker
          key={(p.id ?? p.kind) + i + (p.selected ? "s" : "")}
          coordinate={coord(p)}
          title={p.label}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          onPress={p.id && onPressPoint ? () => onPressPoint(p.id as string) : undefined}
        >
          {p.kind === "pickup" ? (
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.emerald, borderWidth: 4, borderColor: "#fff" }} />
          ) : p.kind === "dropoff" ? (
            <View style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: C.text, borderWidth: 4, borderColor: "#fff" }} />
          ) : p.kind === "driver" ? (
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.text, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="car" size={20} color="#fff" />
            </View>
          ) : (
            <View style={{ width: p.selected ? 26 : 20, height: p.selected ? 26 : 20, borderRadius: 13, backgroundColor: p.selected ? C.emerald : "#fff", borderWidth: p.selected ? 4 : 3, borderColor: p.selected ? "#fff" : C.emerald }} />
          )}
        </Marker>
      ))}
    </MapView>
  );
}

export const NativeMap: ComponentType<RouteMapProps> | null = PhoneMap;
