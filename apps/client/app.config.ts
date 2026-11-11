import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Everything is in app.json; this file only adds the maps.
 *
 * - iPhone uses Apple Maps and needs no key.
 * - Android uses Google Maps, which needs a key made in Google Cloud ("Maps SDK
 *   for Android", restricted to this app's package and signing certificate).
 *   Put it in the EAS environment variable EXPO_PUBLIC_GOOGLE_MAPS_KEY (or in
 *   apps/client/.env.local for a local build) and make a new Android build.
 *   Never write the key in this repo.
 * - Without the key the Android app still works: it shows the app's own drawn
 *   map instead of Google's (src/MapView.tsx reads `extra.androidMapsKey`).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "").trim();
  return {
    ...config,
    name: config.name ?? "CR Transfers",
    slug: config.slug ?? "crpt-traveller",
    plugins: [...(config.plugins ?? []), ["react-native-maps", androidKey ? { androidGoogleMapsApiKey: androidKey } : {}]],
    extra: { ...config.extra, androidMapsKey: Boolean(androidKey) },
  };
};
