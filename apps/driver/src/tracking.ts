import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { loadLang, tr } from "./i18n";
import { supabase } from "./supabase";

/**
 * Location sharing around trips (Jorge, 2026-11-09). With the driver's consent,
 * the phone reports its position from 3 hours before a pickup until the trip is
 * completed, so the team can follow active trips. Outside that window nothing is
 * sent: the database refuses the position (report_location returns false) and
 * this task switches itself off.
 */
const TASK = "trip-location";

/** At most one position every 30 seconds goes to the server (the phone may report more often). */
const MIN_SEND_MS = 30000;
let lastSentAt = 0;

/** Send one position; false = the server no longer wants it (trip over or consent withdrawn). */
async function sendPosition(loc: Location.LocationObject, force = false): Promise<void> {
  if (!force && Date.now() - lastSentAt < MIN_SEND_MS) return;
  lastSentAt = Date.now();
  try {
    const { data: accepted, error: err } = await supabase.rpc("report_location", {
      p_lat: loc.coords.latitude,
      p_lng: loc.coords.longitude,
      p_accuracy: loc.coords.accuracy,
      p_speed: loc.coords.speed,
      p_heading: loc.coords.heading,
    });
    // false = no trip in the window any more (or consent withdrawn): stop sharing.
    if (!err && accepted === false) return await stopTracking();
    if (!err) await maybeCheckEta();
  } catch {
    /* offline: the next update tries again */
  }
}

// Must be defined at the top level so it also runs when the app is in the background.
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await sendPosition(data.locations[data.locations.length - 1]);
});

/**
 * While the app is open during a trip, send the current position every minute even when
 * the car is standing still (an iPhone only reports by distance moved, so a parked or
 * stopped driver otherwise looked like "no recent signal" on the team's live map).
 */
export async function heartbeat(): Promise<void> {
  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(TASK))) return;
    const loc =
      (await Location.getLastKnownPositionAsync({ maxAge: 60000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    if (loc) await sendPosition(loc, true);
  } catch {
    /* no fix right now: the next beat tries again */
  }
}

/**
 * Every 5 minutes, ask the server whether we'll reach the pickup on time. The server
 * works it out from the position it already has, with live traffic, and alerts the
 * team if we'd be more than 20 minutes late. It also throttles on its side.
 */
const ETA_KEY = "eta-last-check";
async function maybeCheckEta(): Promise<void> {
  const last = Number((await AsyncStorage.getItem(ETA_KEY)) ?? 0);
  if (Date.now() - last < 5 * 60000) return;
  await AsyncStorage.setItem(ETA_KEY, String(Date.now()));
  await api("/driver/eta", {});
}

export async function stopTracking(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
  } catch {
    /* not running */
  }
}

export type TrackingState =
  | { kind: "off"; reason: "no-consent" | "no-permission" | "no-trip" }
  | { kind: "on"; bookingRef: string };

/** Has the phone been allowed to share location in the background ("Allow all the time")? */
export async function hasLocationPermission(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) return false;
  return (await Location.getBackgroundPermissionsAsync()).granted;
}

/** Ask for location access: first while using the app, then all the time (needed during the drive). */
export async function requestLocationPermission(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return false;
  return (await Location.requestBackgroundPermissionsAsync()).granted;
}

/**
 * Start or stop sharing to match the driver's trips. Called when the app opens,
 * when trips reload and after Start / Complete trip.
 */
export async function syncTracking(consented: boolean): Promise<TrackingState> {
  try {
    if (!consented) {
      await stopTracking();
      return { kind: "off", reason: "no-consent" };
    }
    if (!(await hasLocationPermission())) {
      await stopTracking();
      return { kind: "off", reason: "no-permission" };
    }
    const { data } = await supabase.rpc("tracking_window");
    const trip = (data as { booking_ref: string }[] | null)?.[0];
    if (!trip) {
      await stopTracking();
      return { kind: "off", reason: "no-trip" };
    }
    if (!(await Location.hasStartedLocationUpdatesAsync(TASK))) {
      await loadLang();
      await Location.startLocationUpdatesAsync(TASK, {
        accuracy: Location.Accuracy.Balanced,
        // Android: a position every minute even when parked. iPhone reports by distance moved,
        // so a small distance keeps it reporting in slow traffic and at stops; sendPosition()
        // passes on at most one every 30 s, and heartbeat() covers a phone standing still.
        timeInterval: 60000,
        distanceInterval: Platform.OS === "android" ? 0 : 20,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        activityType: Location.ActivityType.AutomotiveNavigation,
        // Android shows this notification the whole time location is being shared.
        foregroundService: {
          notificationTitle: tr("Compartiendo su ubicación para el viaje ", "Sharing your location for trip ") + trip.booking_ref,
          notificationBody: tr(
            "Nuestro equipo y sus clientes pueden ver dónde está hasta que termine el viaje.",
            "Our team and your travellers can see where you are until the trip ends.",
          ),
          notificationColor: "#059669",
        },
      });
    }
    return { kind: "on", bookingRef: trip.booking_ref };
  } catch {
    return { kind: "off", reason: "no-permission" };
  }
}
