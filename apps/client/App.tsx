import { Ionicons } from "@expo/vector-icons";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { NavigationContainer } from "@react-navigation/native";
import type { Session } from "@supabase/supabase-js";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BookingProvider } from "./src/booking";
import { LangProvider } from "./src/i18n";
import { navigationRef, openChat, openTrip } from "./src/nav";
import { RootNavigator, navTheme } from "./src/Navigator";
import { Preview } from "./src/preview";
import { SessionProvider, useSession } from "./src/session";
import { supabase } from "./src/supabase";

/** Design previews with sample data (web only, never in a phone build): EXPO_PUBLIC_PREVIEW=1. */
const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW === "1";

// Keep the green launch screen up until the fonts are in and we know who is signed in.
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Costa Rica Private Transfers (traveller app). Anyone can plan a trip and see
 * prices without signing in; when they send a request they confirm their email
 * with a 6-digit code (no account, no password), which also lets them see their
 * trips, their driver and car (and where the driver is around the pickup), the
 * chat and the rating. A ride is planned on a map (places, vehicle, confirm:
 * src/screens/book); a test checkout stands in until card payments are connected.
 */
export default function App() {
  // Plus Jakarta Sans, one file per weight (see F in src/theme.ts), and the icon font, so nothing flashes in late.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    ...Ionicons.font,
  });
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (PREVIEW) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // If a font can't be read the app still opens (in the phone's own font) rather than sitting on the launch screen.
  const ready = (fontsLoaded || Boolean(fontError)) && (PREVIEW || session !== undefined);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  if (PREVIEW) return <Preview />;
  return (
    <LangProvider>
      <SafeAreaProvider>
        {/* Both providers sit above the navigator and never remount, so signing in half-way through a booking loses nothing. */}
        <SessionProvider session={session ?? null}>
          <BookingProvider>
            <NavigationContainer ref={navigationRef} theme={navTheme}>
              <RootNavigator />
            </NavigationContainer>
            <NotificationTaps />
          </BookingProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </LangProvider>
  );
}

/** A tapped notification ("your driver is on the way", "rate your ride") opens that booking. */
function NotificationTaps() {
  const { reload } = useSession();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { screen?: string; id?: string } | undefined;
      if (data?.screen === "trip" && data.id) {
        void reload();
        openTrip(data.id);
      }
      if (data?.screen === "chat" && data.id) {
        void reload();
        openChat(data.id);
      }
    });
    return () => sub.remove();
  }, [reload]);
  return null;
}
