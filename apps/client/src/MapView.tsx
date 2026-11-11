import Constants from "expo-constants";
import { useState } from "react";
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { COSTA_RICA, HUB_POINTS, type LatLng, type MapPoint } from "./geo";
import { NativeMap } from "./NativeMap";
import { C, MAP, SHADOW } from "./theme";
import { Text } from "./ui";

/**
 * The app's one map. Give it pins and, optionally, a line to draw through them.
 *
 * - iPhone: Apple Maps (react-native-maps), no key needed.
 * - Android: Google Maps, only when the build was made with a Google Maps key
 *   (EXPO_PUBLIC_GOOGLE_MAPS_KEY, see app.config.ts). Without the key Google's
 *   map would crash or stay grey, so the drawn map below is shown instead.
 * - Browser preview: the drawn map.
 *
 * The line is drawn straight between the points the app knows (pickup and
 * drop-off): it shows where the ride goes, not the exact road. Drive times and
 * prices always come from the server.
 */
export interface RouteMapProps {
  points: MapPoint[];
  /** Draw a line through these points, in order. */
  line?: LatLng[];
  /** "dotted" for the driver's way to the pickup. */
  lineStyle?: "solid" | "dotted";
  /** A dark label on the middle of the line ("About 3 h drive"). */
  pill?: string;
  /** Show the whole country even with pins on it (the home screen). */
  country?: boolean;
  /** Screen space covered by things on top of the map (buttons, the bottom sheet), so pins stay in view. */
  pad?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Makes pins with an `id` tappable. */
  onPressPoint?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

/** Set by app.config.ts when the Android build carries a Google Maps key. */
const androidKey = (Constants.expoConfig?.extra as { androidMapsKey?: boolean } | undefined)?.androidMapsKey === true;
const useNative = NativeMap !== null && (Platform.OS === "ios" || (Platform.OS === "android" && androidKey));

export function RouteMap(props: RouteMapProps) {
  if (useNative && NativeMap) return <NativeMap {...props} />;
  return <DrawnMap {...props} />;
}

/* ------------------------------------------------------------------ */
/* The drawn map: Costa Rica's outline with our pins in their real     */
/* places. An illustration, not a road map.                            */
/* ------------------------------------------------------------------ */

/** Costa Rica's outline, roughly ([lng, lat], clockwise from the north-west corner). */
const COAST: [number, number][] = [
  [-85.7, 11.07], [-85.62, 11.21], [-85.1, 11.1], [-84.7, 11.08], [-84.35, 10.97], [-84.19, 10.79], [-83.94, 10.71], [-83.76, 10.77], [-83.7, 10.94],
  [-83.51, 10.54], [-83.35, 10.31], [-83.03, 9.99], [-82.83, 9.74], [-82.75, 9.66], [-82.65, 9.63], [-82.56, 9.57],
  [-82.62, 9.48], [-82.93, 9.47], [-82.93, 9.07], [-82.72, 8.92], [-82.87, 8.8], [-82.83, 8.63], [-82.9, 8.38], [-82.88, 8.03],
  [-82.95, 8.25], [-83.14, 8.39], [-83.17, 8.64], [-83.33, 8.7], [-83.48, 8.69], [-83.3, 8.53], [-83.29, 8.38], [-83.44, 8.44], [-83.59, 8.48], [-83.73, 8.62],
  [-83.67, 8.7], [-83.62, 8.78], [-83.6, 8.95], [-83.77, 9.15], [-83.86, 9.25], [-84.16, 9.4], [-84.33, 9.5], [-84.63, 9.61], [-84.66, 9.65], [-84.63, 9.77],
  [-84.72, 9.91], [-84.84, 9.97], [-85.1, 10.2], [-85.2, 10.12], [-85.05, 9.98], [-84.96, 9.94], [-84.94, 9.82], [-85.02, 9.72], [-85.07, 9.65], [-85.11, 9.56],
  [-85.15, 9.61], [-85.17, 9.65], [-85.27, 9.77], [-85.53, 9.88], [-85.66, 9.97], [-85.86, 10.3], [-85.79, 10.43], [-85.7, 10.55], [-85.68, 10.63], [-85.95, 10.89],
  [-85.68, 10.94],
];
/** The mountain ranges, as soft shapes: [lng, lat, half-width in degrees, half-height in degrees]. */
const HILLS: [number, number, number, number][] = [
  [-85.2, 10.75, 0.35, 0.15],
  [-84.75, 10.38, 0.3, 0.14],
  [-84.05, 10.12, 0.35, 0.13],
  [-83.5, 9.45, 0.55, 0.3],
  [-83.55, 8.55, 0.2, 0.1],
  [-85.4, 10.0, 0.25, 0.2],
];
/** Light lines between our towns, so the map reads as a map. */
const ROADS: [string, string][] = [
  ["SJO", "Arenal"],
  ["SJO", "Monteverde"],
  ["SJO", "ManuelAntonio"],
  ["SJO", "PuertoViejo"],
  ["Monteverde", "LIR"],
  ["Arenal", "LIR"],
  ["LIR", "Tamarindo"],
  ["ManuelAntonio", "Sierpe"],
];

interface XY {
  x: number;
  y: number;
}

/** A gentle curve from a to b (bending to one side), as an SVG path piece. */
function curve(a: XY, b: XY, bend: number): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const cx = mx - (b.y - a.y) * bend;
  const cy = my + (b.x - a.x) * bend;
  return "Q" + cx.toFixed(1) + " " + cy.toFixed(1) + " " + b.x.toFixed(1) + " " + b.y.toFixed(1);
}
const through = (pts: XY[], bend: number) => (pts.length < 2 ? "" : "M" + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1) + pts.slice(1).map((p, i) => curve(pts[i], p, i % 2 ? -bend : bend)).join(""));

function DrawnMap({ points, line, lineStyle = "solid", pill, country, pad, onPressPoint, style }: RouteMapProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  let body = null;
  if (size && size.w > 0 && size.h > 0) {
    const all: LatLng[] = [...points, ...(line ?? [])];
    let b = { ...COSTA_RICA };
    if (!country && all.length >= 2) {
      b = { minLat: Math.min(...all.map((p) => p.lat)), maxLat: Math.max(...all.map((p) => p.lat)), minLng: Math.min(...all.map((p) => p.lng)), maxLng: Math.max(...all.map((p) => p.lng)) };
      // Two places close together shouldn't blow the map up to street level.
      const grow = (min: number, max: number, least: number): [number, number] => (max - min >= least ? [min, max] : [(min + max) / 2 - least / 2, (min + max) / 2 + least / 2]);
      [b.minLat, b.maxLat] = grow(b.minLat, b.maxLat, 0.22);
      [b.minLng, b.maxLng] = grow(b.minLng, b.maxLng, 0.22);
    } else if (!country && all.length === 1) {
      b = { minLat: all[0].lat - 0.35, maxLat: all[0].lat + 0.35, minLng: all[0].lng - 0.35, maxLng: all[0].lng + 0.35 };
    }
    const edge = 34;
    const left = (pad?.left ?? 0) + edge;
    const top = (pad?.top ?? 0) + edge;
    const availW = Math.max(40, size.w - left - (pad?.right ?? 0) - edge);
    const availH = Math.max(40, size.h - top - (pad?.bottom ?? 0) - edge);
    const k = Math.cos((((b.minLat + b.maxLat) / 2) * Math.PI) / 180);
    const spanX = (b.maxLng - b.minLng) * k;
    const spanY = b.maxLat - b.minLat;
    const scale = Math.min(availW / spanX, availH / spanY);
    const offX = left + (availW - spanX * scale) / 2;
    const offY = top + (availH - spanY * scale) / 2;
    const xy = (p: LatLng): XY => ({ x: offX + (p.lng - b.minLng) * k * scale, y: offY + (b.maxLat - p.lat) * scale });

    const coast = COAST.map(([lng, lat]) => xy({ lat, lng }));
    const land = "M" + coast.map((p) => p.x.toFixed(1) + " " + p.y.toFixed(1)).join("L") + "Z";
    const route = (line ?? []).map(xy);
    const pins = points.map((p) => ({ p, at: xy(p) }));
    const mid = route.length >= 2 ? { x: (route[0].x + route[route.length - 1].x) / 2, y: (route[0].y + route[route.length - 1].y) / 2 } : null;
    const clampX = (x: number) => Math.min(Math.max(x, 96), size.w - 96);

    body = (
      <>
        <Svg width={size.w} height={size.h} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Rect width={size.w} height={size.h} fill={MAP.sea} />
          <Path d={land} fill={MAP.land} />
          {HILLS.map(([lng, lat, rx, ry], i) => {
            const c = xy({ lat, lng });
            return <Ellipse key={i} cx={c.x} cy={c.y} rx={rx * k * scale} ry={ry * scale} fill={MAP.hills} />;
          })}
          {ROADS.map(([from, to], i) => (
            <Path key={from + to} d={through([xy(HUB_POINTS[from]), xy(HUB_POINTS[to])], i % 2 ? 0.12 : -0.1)} fill="none" stroke={MAP.road} strokeWidth={5} strokeLinecap="round" />
          ))}
          {route.length >= 2 ? (
            <Path d={through(route, 0.16)} fill="none" stroke={C.emerald} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={lineStyle === "dotted" ? "2 12" : undefined} />
          ) : null}
          {pins.map(({ p, at }, i) => {
            if (p.kind === "pickup")
              return (
                <G key={i}>
                  <Circle cx={at.x} cy={at.y} r={24} fill={C.emerald} opacity={0.16} />
                  <Circle cx={at.x} cy={at.y} r={10} fill={C.emerald} stroke="#fff" strokeWidth={4} />
                </G>
              );
            if (p.kind === "dropoff") return <Rect key={i} x={at.x - 9} y={at.y - 9} width={18} height={18} rx={4} fill={C.text} stroke="#fff" strokeWidth={4} />;
            if (p.kind === "driver")
              return (
                <G key={i} transform={"translate(" + at.x.toFixed(1) + " " + at.y.toFixed(1) + ")"}>
                  <Circle r={20} fill={C.text} stroke="#fff" strokeWidth={4} />
                  <Path d="M-9 4h18v-5l-3-1-3-5h-6l-3 5-3 1z" fill="none" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
                </G>
              );
            return p.selected ? (
              <Circle key={i} cx={at.x} cy={at.y} r={11} fill={C.emerald} stroke="#fff" strokeWidth={4} />
            ) : (
              <Circle key={i} cx={at.x} cy={at.y} r={8} fill="#fff" stroke={C.emerald} strokeWidth={3} />
            );
          })}
        </Svg>
        {mid && pill ? (
          <View pointerEvents="none" style={{ position: "absolute", left: clampX(mid.x) - 96, width: 192, top: mid.y - 16, alignItems: "center" }}>
            <View style={{ backgroundColor: C.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                {pill}
              </Text>
            </View>
          </View>
        ) : null}
        {pins.map(({ p, at }, i) =>
          p.label ? (
            // The name sits above its pin, or below it when the pin is near the top.
            <View key={"l" + i} pointerEvents="none" style={{ position: "absolute", left: clampX(at.x) - 96, width: 192, top: at.y - (pad?.top ?? 0) > 70 ? at.y - (p.kind === "driver" ? 58 : 48) : at.y + (p.kind === "driver" ? 26 : 18), alignItems: "center" }}>
              <View style={[{ backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }, SHADOW]}>
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={{ color: C.text, fontSize: 13, fontWeight: "700" }}>
                  {p.label}
                </Text>
              </View>
            </View>
          ) : null,
        )}
        {onPressPoint
          ? pins.map(({ p, at }) =>
              p.id ? (
                <Pressable
                  key={"t" + p.id}
                  accessibilityRole="button"
                  accessibilityLabel={p.label ?? p.id}
                  accessibilityState={{ selected: Boolean(p.selected) }}
                  onPress={() => onPressPoint(p.id as string)}
                  style={{ position: "absolute", left: at.x - 24, top: at.y - 24, width: 48, height: 48 }}
                />
              ) : null,
            )
          : null}
      </>
    );
  }

  return (
    <View style={[{ backgroundColor: MAP.land, overflow: "hidden" }, style]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {body}
    </View>
  );
}
