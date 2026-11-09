import type { Session } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { registerForPush, unregisterPush } from "./src/push";
import { Earnings } from "./src/screens/Earnings";
import { Jobs } from "./src/screens/Jobs";
import { Profile } from "./src/screens/Profile";
import { SignIn } from "./src/screens/SignIn";
import { TripDetail } from "./src/screens/TripDetail";
import { Trips } from "./src/screens/Trips";
import { supabase } from "./src/supabase";
import { C } from "./src/theme";
import type { DriverInfo, Names, Trip, Vehicle } from "./src/types";

type Tab = "jobs" | "trips" | "earnings" | "profile";
const TABS: { id: Tab; label: string }[] = [
  { id: "jobs", label: "Jobs" },
  { id: "trips", label: "Trips" },
  { id: "earnings", label: "Earnings" },
  { id: "profile", label: "Profile" },
];

/**
 * PuraVidaWay Partner (driver app). Four tabs and a trip screen; a small
 * hand-rolled navigator keeps the first version simple. Reading goes straight
 * to Supabase as the signed-in driver; actions go through the website's /api/v1.
 */
export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {session === undefined ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.emeraldDark }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : session ? (
        <Home session={session} />
      ) : (
        <SignIn />
      )}
    </SafeAreaProvider>
  );
}

function Home({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>("jobs");
  const [tripId, setTripId] = useState<string | null>(null);
  const [focusJob, setFocusJob] = useState<string | undefined>(undefined);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [names, setNames] = useState<Names>({ tours: {}, stops: {} });
  const [loading, setLoading] = useState(false);
  const userId = session.user.id;

  const loadTrips = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("my_trips");
    setLoading(false);
    setTrips((data as Trip[] | null) ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      const [d, v, tours, stops] = await Promise.all([
        supabase.from("drivers").select("kyc_status, home_hub, rating_avg, rating_count").eq("id", userId).maybeSingle(),
        supabase.from("driver_vehicles").select("id, make_model, plate, passenger_capacity, status").eq("driver_id", userId).order("created_at"),
        supabase.from("day_tours").select("id, name"),
        supabase.from("sightseeing_stops").select("id, name"),
      ]);
      setDriver((d.data as DriverInfo | null) ?? null);
      setVehicles((v.data as Vehicle[] | null) ?? []);
      const toMap = (rows: { id: string; name: string }[] | null) => Object.fromEntries((rows ?? []).map((r) => [r.id, r.name]));
      setNames({ tours: toMap(tours.data as { id: string; name: string }[] | null), stops: toMap(stops.data as { id: string; name: string }[] | null) });
    })();
    void loadTrips();
    void registerForPush();
  }, [userId, loadTrips]);

  // A tapped notification opens the job or the trip it is about.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { screen?: string; id?: string } | undefined;
      if (data?.screen === "trip" && data.id) {
        void loadTrips();
        setTab("trips");
        setTripId(data.id);
      } else if (data?.screen === "job") {
        setTripId(null);
        setFocusJob(data.id);
        setTab("jobs");
      }
    });
    return () => sub.remove();
  }, [loadTrips]);

  async function signOut() {
    await unregisterPush();
    await supabase.auth.signOut();
  }

  const openTrip = tripId ? trips.find((t) => t.id === tripId) : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.emeraldDark }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
          PuraVidaWay <Text style={{ color: "#FBBF24" }}>Partner</Text>
        </Text>
      </View>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {tab === "trips" && openTrip ? (
          <TripDetail trip={openTrip} names={names} onBack={() => setTripId(null)} onChanged={loadTrips} />
        ) : tab === "jobs" ? (
          <Jobs driver={driver} vehicles={vehicles} names={names} trips={trips} focusId={focusJob} />
        ) : tab === "trips" ? (
          <Trips trips={trips} names={names} loading={loading} onRefresh={loadTrips} onOpen={setTripId} />
        ) : tab === "earnings" ? (
          <Earnings trips={trips} names={names} loading={loading} onRefresh={loadTrips} />
        ) : (
          <Profile email={session.user.email ?? ""} driver={driver} vehicles={vehicles} onSignOut={signOut} />
        )}
      </View>
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: C.border }}>
        <View style={{ flexDirection: "row" }}>
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.id }}
              onPress={() => {
                setTab(t.id);
                if (t.id !== "trips") setTripId(null);
                if (t.id === "trips" || t.id === "earnings") void loadTrips();
              }}
              style={{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontWeight: "800", fontSize: 13, color: tab === t.id ? C.emerald : C.muted }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}
