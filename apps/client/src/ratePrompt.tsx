import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { navigationRef } from "./nav";
import { allBookings, useSession } from "./session";
import type { AppBooking, AppTrip } from "./types";

/**
 * "How was your ride?" as soon as the trip ends (Jorge, 2026-11-11): when the
 * app is opened, comes back to the front or refreshes the trips, and the
 * traveller has a completed trip they haven't rated, the rating panel opens by
 * itself. ONCE per booking: the phone remembers which bookings it has shown
 * the panel for (also when it was opened by hand or from a notification) and
 * never opens it by itself for them again. The "Rate your ride" button stays
 * on the trip, and the server sends one reminder 24 hours later.
 *
 * It never interrupts a booking: the panel only opens by itself over the home
 * screen, My trips or a trip. At most one panel each time the app comes to the
 * front, and only for trips of the last week (older ones keep their button).
 */
const KEY = "rate-prompted-v1";
/** Only the newest ids are kept; far more than anyone has unrated. */
const KEEP = 200;
const RECENT_DAYS = 7;
/** Screens the panel may open over by itself (see src/nav.ts). */
const QUIET_SCREENS = new Set(["Home", "TripsList", "TripDetail"]);

async function promptedIds(): Promise<string[]> {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "[]") as unknown;
    return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Remember that the rating panel was shown for this booking, so it never opens by itself for it again. */
export async function markRatePrompted(id: string): Promise<void> {
  try {
    const ids = await promptedIds();
    if (ids.includes(id)) return;
    await AsyncStorage.setItem(KEY, JSON.stringify([...ids, id].slice(-KEEP)));
  } catch {
    /* worst case the panel opens once more */
  }
}

/**
 * The booking to ask about now, or null: completed, with a driver, not rated,
 * from the last week, and not asked about on this phone before. The most
 * recent one when there are several.
 */
export function bookingToRate(trips: AppTrip[], prompted: string[], now: number = Date.now()): AppBooking | null {
  const since = now - RECENT_DAYS * 86400000;
  const open = allBookings(trips)
    .map((x) => x.booking)
    .filter((b) => b.status === "completed" && b.driver && b.myRating == null && !prompted.includes(b.id) && b.scheduledAt && new Date(b.scheduledAt).getTime() >= since)
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));
  return open[0] ?? null;
}

/** Sits next to the navigator (App.tsx) and opens the rating panel when it should. Draws nothing. */
export function RatePrompt() {
  const { email, trips, loaded, reload } = useSession();
  const latest = useRef({ email, trips, loaded });
  latest.current = { email, trips, loaded };
  /** One panel each time the app comes to the front. */
  const shown = useRef(false);
  const busy = useRef(false);

  const check = useCallback(async () => {
    const { email: who, trips: list, loaded: ready } = latest.current;
    if (busy.current || shown.current || !who || !ready || !navigationRef.isReady()) return;
    if (!QUIET_SCREENS.has(navigationRef.getCurrentRoute()?.name ?? "")) return;
    busy.current = true;
    try {
      const b = bookingToRate(list, await promptedIds());
      // The traveller may have moved on while the phone was reading its notes.
      if (!b || !QUIET_SCREENS.has(navigationRef.getCurrentRoute()?.name ?? "")) return;
      shown.current = true;
      await markRatePrompted(b.id);
      navigationRef.navigate("Rate", { id: b.id });
    } finally {
      busy.current = false;
    }
  }, []);

  // Trips loaded or refreshed (app opened, pull to refresh, a trip just completed).
  useEffect(() => {
    void check();
  }, [check, trips, loaded, email]);

  // Back on one of the quiet screens (for example after finishing a booking).
  useEffect(() => navigationRef.addListener("state", () => void check()), [check]);

  // Back to the front: fetch the trips again, which runs the check above.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      shown.current = false;
      if (latest.current.email) void reload();
    });
    return () => sub.remove();
  }, [reload]);

  return null;
}
