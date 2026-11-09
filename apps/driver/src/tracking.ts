import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "./supabase";

/**
 * Location sharing around trips (Jorge, 2026-11-09). With the driver's consent,
 * the phone reports its position from 3 hours before a pickup until the trip is
 * completed, so the team can follow active trips. Outside that window nothing is
 * sent: the database refuses the position (report_location returns false) and
 * this task switches itself off.
 */
const TASK = "trip-location";

// Must be defined at the top level so it also runs when the app is in the background.
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const last = data.locations[data.locations.length - 1];
  try {
    const { data: accepted, error: err } = await supabase.rpc("report_location", {
      p_lat: last.coords.latitude,
      p_lng: last.coords.longitude,
      p_accuracy: last.coords.accuracy,
      p_speed: last.coords.speed,
      p_heading: last.coords.heading,
    });
    // false = no trip in the window any more (or consent withdrawn): stop sharing.
    if (!err && accepted === false) await stopTracking();
  } catch {
    /* offline: the next update tries again */
  }
});

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
      await Location.startLocationUpdatesAsync(TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000,
        distanceInterval: 200,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        activityType: Location.ActivityType.AutomotiveNavigation,
        // Android shows this notification the whole time location is being shared.
        foregroundService: {
          notificationTitle: "Sharing your location for trip " + trip.booking_ref,
          notificationBody: "Our team can see where you are until the trip is completed.",
          notificationColor: "#059669",
        },
      });
    }
    return { kind: "on", bookingRef: trip.booking_ref };
  } catch {
    return { kind: "off", reason: "no-permission" };
  }
}
