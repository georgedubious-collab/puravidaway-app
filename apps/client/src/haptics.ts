import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Small taps you can feel. `tap` for a main button, `pick` when a choice
 * changes, `success` when a request goes through. Nothing happens in a browser
 * or when the phone has haptics switched off; a failure is never an error.
 */
const on = Platform.OS === "ios" || Platform.OS === "android";

export function tap(): void {
  if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function pick(): void {
  if (on) Haptics.selectionAsync().catch(() => {});
}

export function success(): void {
  if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
