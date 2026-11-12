import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { C, SP } from "../theme";
import { Text } from "../ui";

/** How far the white card under the band (the From / To card, the tour date) reaches up into it. */
export const BAND_OVERLAP = 44;

/**
 * The dark green band at the top of the Explore tab, the same on the rides and
 * the day tours side: the menu button and the Rides | Day tours switch (`top`),
 * the headline in white, one line under it, and a faint volcano skyline. It
 * runs up behind the clock and battery, and leaves room at the bottom for the
 * white card that overlaps its edge.
 */
export function ExploreBand({ top, title, subtitle }: { top: ReactNode; title: string; subtitle: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      {/* Pulling the page down on an iPhone shows more green, not the page colour. */}
      <View style={{ position: "absolute", left: 0, right: 0, top: -600, height: 600, backgroundColor: C.emeraldDeep }} />
      <View style={{ backgroundColor: C.emeraldDeep, paddingTop: insets.top + 8, paddingHorizontal: SP.lg, paddingBottom: BAND_OVERLAP + SP.xl, gap: 18, overflow: "hidden" }}>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 200 }}>
          <Svg width="100%" height="100%" viewBox="0 0 390 200" preserveAspectRatio="xMidYMax slice">
            <Path d="M-10 200 L-10 170 L70 90 L110 125 L190 35 L240 90 L270 68 L400 170 L400 200 Z" fill="#FFFFFF" opacity={0.06} />
            <Path d="M-10 190 L60 140 L130 170 L210 115 L300 165 L400 130 L400 200 L-10 200 Z" fill="#FFFFFF" opacity={0.07} />
          </Svg>
        </View>
        {top}
        <View style={{ gap: 6, paddingHorizontal: 2 }}>
          <Text accessibilityRole="header" style={{ fontSize: 27, lineHeight: 33, fontWeight: "800", color: "#fff", letterSpacing: -0.6 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: "500", color: C.emeraldSoft }}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}
