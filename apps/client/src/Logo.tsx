import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { C } from "./theme";
import { Text } from "./ui";

/**
 * The brand mark ("CR route", chosen by Jorge): a C and an R drawn as one road,
 * with a gold dot at the start and at the end. Emerald with gold dots on a
 * light background; white with brighter gold dots on a dark one (`dark`).
 */
export function LogoMark({ size = 32, dark }: { size?: number; dark?: boolean }) {
  const m1 = dark ? "#FFFFFF" : C.emerald;
  const m3 = dark ? C.goldBright : C.gold;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M30 21.8A13 13 0 1 0 30 42.2" fill="none" stroke={m1} strokeWidth={6.5} strokeLinecap="round" />
      <Path d="M40 45V19h7a7.5 7.5 0 0 1 0 15h-7m7 0 8 11" fill="none" stroke={m1} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={30} cy={21.8} r={4.6} fill={m3} />
      <Circle cx={55} cy={45} r={4.6} fill={m3} />
    </Svg>
  );
}

/**
 * Mark + wordmark: small tracked "COSTA RICA" over bold "Private Transfers".
 * `short` is the one-line form, "CR Transfers" (the name under the app icon).
 */
export function Logo({ size = 36, dark, short }: { size?: number; dark?: boolean; short?: boolean }) {
  const ink = dark ? "#FFFFFF" : C.text;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Costa Rica Private Transfers" style={{ flexDirection: "row", alignItems: "center", gap: size * 0.22 }}>
      <LogoMark size={size} dark={dark} />
      {short ? (
        <Text style={{ fontSize: size * 0.5, fontWeight: "800", color: ink, letterSpacing: -0.3 }}>CR Transfers</Text>
      ) : (
        <View>
          <Text style={{ fontSize: size * 0.27, lineHeight: size * 0.36, fontWeight: "700", color: dark ? "rgba(255,255,255,0.8)" : C.emerald, letterSpacing: size * 0.06 }}>COSTA RICA</Text>
          <Text style={{ fontSize: size * 0.44, lineHeight: size * 0.56, fontWeight: "800", color: ink, letterSpacing: -0.3 }}>Private Transfers</Text>
        </View>
      )}
    </View>
  );
}
