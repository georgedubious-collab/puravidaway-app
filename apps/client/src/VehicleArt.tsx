import { Image, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { PHOTOS, photoForVehicle } from "./images";
import { C } from "./theme";

const CAR = "M4 25h4.5M20.5 25h20M49.5 25H56v-7l-8-3-6-8H22l-8 8-10 3v7";
const VAN = "M4 25h7.5M20.5 25h20M49.5 25H56V13l-5-7H8L4 12v13";

/**
 * The small picture of a vehicle type (home "Choose your ride", and the list in
 * "Choose your vehicle"). A photo when src/images.ts has one for the type: an
 * EXAMPLE of the body type, not the car that will come (the text next to it
 * says "… or similar"; until we have photos of our own vehicles these are
 * temporary stock photos, docs/PHOTOS.md). Otherwise a simple drawing on a soft
 * green panel: a van for more than five travellers, a car otherwise.
 * Decorative: the name next to it says what it is.
 */
export function VehicleArt({ id, name = "", maxPax, width = 68, height = 52 }: { id: string; name?: string; maxPax: number; width?: number; height?: number }) {
  const source = PHOTOS[photoForVehicle(id, name)];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, height, borderRadius: 14, overflow: "hidden", backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
      {source ? (
        <Image source={source} resizeMode="cover" style={{ width, height }} />
      ) : (
        <Svg width={width * 0.74} height={height * 0.54} viewBox="0 0 60 32" fill="none">
          <Path d={maxPax > 5 ? VAN : CAR} stroke={C.emeraldDeep} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={16} cy={25} r={4.5} stroke={C.emeraldDeep} strokeWidth={2.4} fill={C.emeraldTint} />
          <Circle cx={45} cy={25} r={4.5} stroke={C.emeraldDeep} strokeWidth={2.4} fill={C.emeraldTint} />
        </Svg>
      )}
    </View>
  );
}
