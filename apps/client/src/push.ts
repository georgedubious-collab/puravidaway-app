import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Show notifications even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function easProjectId(): string | undefined {
  // Set by "eas init" (see apps/client/README.md).
  return Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
}

/**
 * Ask for permission and register this phone for push (driver confirmed, driver on the way, rating requests).
 * Needs a real phone and a development or store build; quietly does nothing in a
 * simulator or when the traveller says no. Email stays the backup.
 */
export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    if (Platform.OS === "android") {
      // Android 13+ only shows the permission prompt once a channel exists.
      await Notifications.setNotificationChannelAsync("trips", {
        name: "Your trips",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#059669",
      });
    }
    let granted = (await Notifications.getPermissionsAsync()).granted;
    if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;
    const projectId = easProjectId();
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.rpc("register_device", { p_token: token, p_platform: Platform.OS === "ios" ? "ios" : "android", p_app: "client" });
  } catch (e) {
    console.warn("[push] not registered", e);
  }
}

/** Forget this phone when the traveller signs out, so the next person doesn't get their pushes. */
export async function unregisterPush(): Promise<void> {
  try {
    const projectId = easProjectId();
    if (!Device.isDevice || !projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from("device_tokens").delete().eq("token", token);
  } catch {
    /* nothing to forget */
  }
}
