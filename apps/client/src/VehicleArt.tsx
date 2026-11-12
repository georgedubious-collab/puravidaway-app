import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { C } from "./theme";

const CAR = "M4 25h4.5M20.5 25h20M49.5 25H56v-7l-8-3-6-8H22l-8 8-10 3v7";
const VAN = "M4 25h7.5M20.5 25h20M49.5 25H56V13l-5-7H8L4 12v13";

/**
 * The small drawing of a vehicle type on a soft green panel (home "Choose your
 * ride"). A drawing, never a photo: we only show our own photos, and there are
 * none of the vehicles yet. `maxPax` picks the shape: a van for more than five
 * travellers, a car otherwise.
 */
export function VehicleArt({ maxPax, width = 68, height = 52 }: { id?: string; maxPax: number; width?: number; height?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, height, borderRadius: 14, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
      <Svg width={width * 0.74} height={height * 0.54} viewBox="0 0 60 32" fill="none">
        <Path d={maxPax > 5 ? VAN : CAR} stroke={C.emeraldDeep} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={16} cy={25} r={4.5} stroke={C.emeraldDeep} strokeWidth={2.4} fill={C.emeraldTint} />
        <Circle cx={45} cy={25} r={4.5} stroke={C.emeraldDeep} strokeWidth={2.4} fill={C.emeraldTint} />
      </Svg>
    </View>
  );
}
