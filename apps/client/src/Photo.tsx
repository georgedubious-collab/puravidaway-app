import { useId, type ReactNode } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { resolvePhoto, type Art, type Placeholder } from "./images";
import { C } from "./theme";

/**
 * Every image slot in the app. `name` is looked up in src/images.ts: a real
 * photo when one has been added there, otherwise a designed placeholder (soft
 * gradient + line drawing). Size and corner radius come from `style`; anything
 * passed as children is laid over the picture (badges, a back button).
 * `scrim` darkens the top edge so white status-bar icons stay readable.
 */
export function Photo({
  name,
  fallback,
  style,
  children,
  scrim,
  label,
}: {
  name: string;
  /** A second name to try (a tour falls back to its region). */
  fallback?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  scrim?: boolean;
  /** Read by screen readers; leave out when the text next to the picture already says it. */
  label?: string;
}) {
  const { source, placeholder } = resolvePhoto(name, fallback);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View
      accessible={Boolean(label)}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      style={[{ overflow: "hidden", backgroundColor: placeholder.to }, style]}
    >
      {/* A bundled photo brings its own pixel size; 100% makes it fill the slot instead. */}
      {source ? <Image source={source} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]} /> : <PlaceholderArt p={placeholder} id={id} />}
      {scrim ? (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10">
          <Defs>
            <LinearGradient id={"s" + id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#022C22" stopOpacity={0.45} />
              <Stop offset="0.5" stopColor="#022C22" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="10" height="10" fill={"url(#s" + id + ")"} />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

const INK = "#FFFFFF";
const line = { fill: "none", stroke: INK, strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const thin = { ...line, strokeWidth: 3.5, opacity: 0.85 } as const;
const soft = { fill: INK, opacity: 0.2 } as const;

/** Gradient + drawing in a 400 × 300 box that is cropped to fill whatever shape the slot has. */
function PlaceholderArt({ p, id }: { p: Placeholder; id: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={"g" + id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={p.from} />
          <Stop offset="1" stopColor={p.to} />
        </LinearGradient>
      </Defs>
      <Rect x="-200" y="-200" width="800" height="700" fill={"url(#g" + id + ")"} />
      {scene(p.art, p.accent)}
    </Svg>
  );
}

function scene(art: Art, accent: string) {
  switch (art) {
    case "volcano":
      return (
        <G>
          <Circle cx={292} cy={92} r={24} fill={accent} opacity={0.9} />
          <Path d="M-40 250 Q60 215 130 232 T300 226 T460 240 V400 H-40Z" {...soft} />
          <Path d="M92 226 L170 122 Q200 104 230 122 L308 226Z" {...soft} />
          <Path d="M92 226 L170 122 Q200 104 230 122 L308 226" {...line} />
          <Path d="M178 124 Q200 138 222 124" {...thin} />
          <Path d="M200 100 q-12 -12 0 -24 q12 -12 2 -24" {...thin} />
          <Path d="M60 226 H340" {...thin} />
        </G>
      );
    case "beach":
      return (
        <G>
          <Circle cx={290} cy={96} r={26} fill={accent} opacity={0.9} />
          <Path d="M-40 236 Q120 214 260 232 T460 226 V400 H-40Z" {...soft} />
          <Path d="M150 232 Q158 176 184 132" {...line} />
          <Path d="M184 132 Q150 112 118 128" {...line} />
          <Path d="M184 132 Q160 96 132 88" {...line} />
          <Path d="M184 132 Q196 96 226 84" {...line} />
          <Path d="M184 132 Q222 112 250 132" {...line} />
          <Path d="M184 132 Q212 136 226 160" {...line} />
          <Path d="M214 214 q14 -10 28 0 t28 0 t28 0 t28 0" {...thin} />
          <Path d="M236 236 q14 -10 28 0 t28 0 t28 0" {...thin} />
        </G>
      );
    case "bridge":
      return (
        <G>
          <Circle cx={300} cy={84} r={22} fill={accent} opacity={0.7} />
          <Path d="M-40 240 Q40 180 104 206 V400 H-40Z" {...soft} />
          <Path d="M440 240 Q360 180 296 206 V400 H440Z" {...soft} />
          <Path d="M104 122 V214 M296 122 V214" {...line} />
          <Path d="M104 126 Q200 196 296 126" {...line} />
          <Path d="M104 176 Q200 204 296 176" {...line} />
          <Path d="M136 150 V186 M168 168 V192 M200 172 V196 M232 168 V192 M264 150 V186" {...thin} />
          <Path d="M70 214 l16 -40 l16 40 M300 214 l16 -44 l16 44" {...thin} />
          <Path d="M130 92 q14 -16 30 -4 q16 -14 30 2" {...thin} />
        </G>
      );
    case "wave":
      return (
        <G>
          <Circle cx={292} cy={92} r={26} fill={accent} opacity={0.95} />
          <Path d="M-40 222 Q70 222 130 184 Q176 130 236 138 Q206 152 214 182 Q226 220 460 222 V400 H-40Z" {...soft} />
          <Path d="M64 222 Q110 216 138 180 Q178 128 238 138 Q206 152 214 182 Q222 214 336 222" {...line} />
          <Path d="M160 196 q10 -22 30 -30" {...thin} />
          <Path d="M96 246 q14 -10 28 0 t28 0 t28 0 M214 250 q14 -10 28 0 t28 0 t28 0" {...thin} />
        </G>
      );
    case "boat":
      return (
        <G>
          <Circle cx={296} cy={90} r={24} fill={accent} opacity={0.9} />
          <Path d="M-40 220 H440 V400 H-40Z" {...soft} />
          <Path d="M118 184 H286 L266 216 H140Z" {...line} />
          <Path d="M150 184 V160 H236 L256 184" {...line} />
          <Path d="M172 160 V184 M204 160 V184" {...thin} />
          <Path d="M150 148 H246" {...thin} />
          <Path d="M84 238 q14 -10 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0" {...thin} />
          <Path d="M130 258 q14 -10 28 0 t28 0 t28 0 t28 0" {...thin} />
        </G>
      );
    case "plane":
      return (
        <G>
          <Circle cx={96} cy={96} r={22} fill={accent} opacity={0.9} />
          <Path d="M-40 250 Q100 226 220 244 T460 236 V400 H-40Z" {...soft} />
          <G transform="rotate(-12 200 160)">
            <Path d="M112 148 H268 Q300 148 308 162 Q300 176 268 176 H112 Q98 176 98 162 Q98 148 112 148Z" {...line} />
            <Path d="M112 148 L98 110 H120 L146 148" {...line} />
            <Path d="M196 176 L164 222 H190 L242 176" {...line} />
            <Path d="M206 148 L188 122 H206 L234 148" {...thin} />
            <Path d="M262 162 H282" {...thin} />
          </G>
          <Path d="M262 92 q14 -16 30 -4 q16 -12 28 4" {...thin} />
        </G>
      );
    case "waterfall":
      return (
        <G>
          <Circle cx={300} cy={84} r={22} fill={accent} opacity={0.8} />
          <Path d="M90 110 H170 V230 H90Z M230 110 H310 V230 H230Z" {...soft} />
          <Path d="M90 110 H170 V226 M230 226 V110 H310" {...line} />
          <Path d="M186 112 V214 M200 112 V222 M214 112 V214" {...thin} />
          <Path d="M150 236 q16 -14 32 0 t32 0 t32 0" {...line} />
          <Path d="M110 110 q-6 -30 16 -40 q22 -6 28 16 M262 110 q0 -28 24 -32" {...thin} />
        </G>
      );
    case "hills":
      return (
        <G>
          <Circle cx={288} cy={96} r={28} fill={accent} opacity={0.95} />
          <Path d="M-40 232 Q40 150 120 200 Q180 120 260 190 Q320 150 440 220 V400 H-40Z" {...soft} />
          <Path d="M40 222 Q84 160 124 200 Q182 122 258 190 Q304 160 360 206" {...line} />
          <Path d="M70 250 Q200 226 330 250" {...thin} />
          <Path d="M150 250 q20 -22 50 -8 q30 -18 52 8" {...thin} />
        </G>
      );
    default:
      // Cars are drawn small; enlarge them around the middle of the box so they fill the slot.
      return <G transform="translate(200 172) scale(1.4) translate(-200 -172)">{car(art, accent)}</G>;
  }
}

/** Side views of the five vehicle classes, drawn as simple outlines on a road. */
function car(art: Art, accent: string) {
  const ink = C.emerald;
  const body = { fill: "#FFFFFF", stroke: ink, strokeWidth: 5, strokeLinejoin: "round", strokeLinecap: "round" } as const;
  const glass = { fill: "none", stroke: ink, strokeWidth: 4, strokeLinejoin: "round", strokeLinecap: "round", opacity: 0.7 } as const;
  const wheels = (x1: number, x2: number, r = 21) => (
    <G>
      {[x1, x2].map((x) => (
        <G key={x}>
          <Circle cx={x} cy={204} r={r} fill={ink} />
          <Circle cx={x} cy={204} r={r * 0.42} fill="#FFFFFF" />
        </G>
      ))}
    </G>
  );
  const road = <Line x1={40} y1={226} x2={360} y2={226} stroke={ink} strokeWidth={4} strokeLinecap="round" opacity={0.35} />;
  const sun = <Circle cx={318} cy={84} r={24} fill={accent} />;
  switch (art) {
    case "car-economy":
      return (
        <G>
          {sun}
          {road}
          <Path d="M92 204 H308 V178 Q308 166 294 164 L262 158 L236 128 Q230 122 220 122 H164 Q154 122 148 130 L126 160 L104 166 Q92 170 92 182Z" {...body} />
          <Path d="M146 158 L162 136 H192 V158Z M204 136 H218 L238 158 H204Z" {...glass} />
          {wheels(138, 262, 19)}
        </G>
      );
    case "car-sedan":
      return (
        <G>
          {sun}
          {road}
          <Path d="M66 204 H334 V180 Q334 168 320 166 L282 160 L250 130 Q244 124 234 124 H170 Q160 124 152 132 L124 160 L84 166 Q66 170 66 184Z" {...body} />
          <Path d="M146 158 L166 138 H196 V158Z M208 138 H232 L254 158 H208Z" {...glass} />
          {wheels(124, 278)}
        </G>
      );
    case "car-suv":
      return (
        <G>
          {sun}
          {road}
          <Path d="M66 204 H334 V168 Q334 156 322 154 L296 150 L272 116 Q266 108 256 108 H152 Q142 108 137 118 L120 150 L82 156 Q66 160 66 174Z" {...body} />
          <Path d="M140 148 L154 124 H192 V148Z M204 124 H254 L270 148 H204Z" {...glass} />
          <Path d="M158 100 H250" {...glass} />
          {wheels(124, 278, 23)}
        </G>
      );
    case "car-4x4":
      return (
        <G>
          {sun}
          {road}
          <Path d="M70 200 H322 V162 Q322 150 310 148 L290 146 L270 110 Q265 102 255 102 H150 Q140 102 136 112 L120 146 L86 152 Q70 156 70 170Z" {...body} />
          <Path d="M140 144 L152 118 H190 V144Z M202 118 H252 L266 144 H202Z" {...glass} />
          <Path d="M150 92 H256 M166 92 V102 M240 92 V102" {...glass} />
          <Circle cx={336} cy={170} r={17} fill="#FFFFFF" stroke={ink} strokeWidth={5} />
          {wheels(128, 272, 26)}
        </G>
      );
    default:
      return (
        <G>
          {sun}
          {road}
          <Path d="M54 204 H346 V120 Q346 104 330 104 H160 Q148 104 140 114 L106 154 L72 162 Q54 166 54 182Z" {...body} />
          <Path d="M130 152 L156 122 H188 V152Z M200 122 H244 V152 H200Z M256 122 H300 V152 H256Z M312 122 H328 V152 H312Z" {...glass} />
          {wheels(118, 290, 22)}
        </G>
      );
  }
}
