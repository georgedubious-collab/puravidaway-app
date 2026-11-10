import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { registerForPush, unregisterPush } from "./src/push";
import { LocationCard } from "./src/screens/LocationCard";
import { stopTracking, syncTracking, type TrackingState } from "./src/tracking";
import { Calendar } from "./src/screens/Calendar";
import { Documents } from "./src/screens/Documents";
import { Help } from "./src/screens/Help";
import { Earnings } from "./src/screens/Earnings";
import { Jobs } from "./src/screens/Jobs";
import { Profile } from "./src/screens/Profile";
import { SignIn } from "./src/screens/SignIn";
import { TripDetail } from "./src/screens/TripDetail";
import { Trips } from "./src/screens/Trips";
import { supabase } from "./src/supabase";
import { C } from "./src/theme";
import type { IconName } from "./src/ui";
import { Preview } from "./src/preview";
import { LangProvider, useT } from "./src/i18n";
import type { DriverInfo, Names, Trip, Vehicle } from "./src/types";

export type Tab = "jobs" | "trips" | "calendar" | "earnings" | "profile";
const TABS: { id: Tab; label: [string, string]; icon: IconName; iconOn: IconName }[] = [
  { id: "jobs", label: ["Trabajos", "Jobs"], icon: "briefcase-outline", iconOn: "briefcase" },
  { id: "trips", label: ["Viajes", "Trips"], icon: "car-outline", iconOn: "car" },
  { id: "calendar", label: ["Calendario", "Calendar"], icon: "calendar-outline", iconOn: "calendar" },
  { id: "earnings", label: ["Ganancias", "Earnings"], icon: "wallet-outline", iconOn: "wallet" },
  { id: "profile", label: ["Perfil", "Profile"], icon: "person-outline", iconOn: "person" },
];

/** Design previews with sample data (web only, never in a phone build): EXPO_PUBLIC_PREVIEW=1. */
const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW === "1";

/** The slim brand line above every screen. */
export function TopBar() {
  const { t } = useT();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, backgroundColor: C.bg }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: C.emeraldDark, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="car-sport" size={15} color="#fff" />
      </View>
      <Text style={{ color: C.emeraldDark, fontSize: 13, fontWeight: "800", flex: 1 }} numberOfLines={1}>
        Costa Rica Private Transfers
      </Text>
      <View style={{ backgroundColor: "#FDE68A", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
        <Text style={{ color: "#78350F", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }}>{t("SOCIO", "PARTNER")}</Text>
      </View>
    </View>
  );
}

/** Bottom tabs: icon over label, filled icon and a tinted pill for the current one. */
export function TabBar({ tab, onChange, tripsBadge }: { tab: Tab; onChange: (t: Tab) => void; tripsBadge?: number }) {
  const { t: tr } = useT();
  return (
    <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: C.border }}>
      <View style={{ flexDirection: "row", paddingTop: 6, paddingBottom: 4 }}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityLabel={tr(...t.label)}
              accessibilityState={{ selected: on }}
              onPress={() => onChange(t.id)}
              style={{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2 }}
            >
              <View style={{ paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999, backgroundColor: on ? C.emeraldSoft : "transparent" }}>
                <Ionicons name={on ? t.iconOn : t.icon} size={22} color={on ? C.emerald : C.muted} />
                {t.id === "trips" && tripsBadge ? (
                  <View style={{ position: "absolute", top: -2, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.amber, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{tripsBadge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontWeight: on ? "800" : "600", fontSize: 11, color: on ? C.emerald : C.muted }} numberOfLines={1}>
                {tr(...t.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

/**
 * Costa Rica Private Transfers Partner (driver app). Five tabs and a trip screen; a small
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

  if (PREVIEW)
    return (
      <LangProvider>
        <Preview />
      </LangProvider>
    );
  return (
    <LangProvider>
      <SafeAreaProvider>
        <StatusBar style={session ? "dark" : "light"} />
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
    </LangProvider>
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
  const [tracking, setTracking] = useState<TrackingState | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const askedToApply = useRef(false);
  const userId = session.user.id;

  const loadDriver = useCallback(async () => {
    const { data } = await supabase
      .from("drivers")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    const d = (data as DriverInfo | null) ?? null;
    setDriver(d);
    // Someone new, with no application yet: take them straight to the application form.
    if (!d && !askedToApply.current) {
      askedToApply.current = true;
      setTab("profile");
      setDocsOpen(true);
    }
    // Location sharing follows the driver's trips: on inside the trip window, off outside it.
    setTracking(await syncTracking(Boolean(d?.location_consent_at)));
  }, [userId]);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("my_trips");
    setLoading(false);
    setTrips((data as Trip[] | null) ?? []);
    await loadDriver();
  }, [loadDriver]);

  const loadVehicles = useCallback(async () => {
    const v = await supabase.from("driver_vehicles").select("*").eq("driver_id", userId).order("created_at");
    setVehicles((v.data as Vehicle[] | null) ?? []);
  }, [userId]);

  useEffect(() => {
    void loadVehicles();
    void (async () => {
      const [tours, stops] = await Promise.all([
        supabase.from("day_tours").select("id, name"),
        supabase.from("sightseeing_stops").select("id, name"),
      ]);
      const toMap = (rows: { id: string; name: string }[] | null) => Object.fromEntries((rows ?? []).map((r) => [r.id, r.name]));
      setNames({ tours: toMap(tours.data as { id: string; name: string }[] | null), stops: toMap(stops.data as { id: string; name: string }[] | null) });
    })();
    void loadTrips();
    void registerForPush();
  }, [userId, loadTrips, loadVehicles]);

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
    await stopTracking();
    await unregisterPush();
    await supabase.auth.signOut();
  }

  const openTrip = tripId ? trips.find((t) => t.id === tripId) : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <TopBar />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {tab === "trips" && openTrip ? (
          <TripDetail trip={openTrip} names={names} onBack={() => setTripId(null)} onChanged={loadTrips} />
        ) : tab === "jobs" ? (
          <Jobs driver={driver} vehicles={vehicles} names={names} trips={trips} focusId={focusJob} />
        ) : tab === "trips" ? (
          <Trips
            trips={trips}
            names={names}
            loading={loading}
            onRefresh={loadTrips}
            onOpen={setTripId}
            header={driver && !driver.location_consent_at ? <LocationCard consented={false} state={tracking} onChanged={loadDriver} /> : undefined}
          />
        ) : tab === "calendar" ? (
          <Calendar trips={trips} />
        ) : tab === "earnings" ? (
          <Earnings trips={trips} names={names} loading={loading} onRefresh={loadTrips} />
        ) : helpOpen ? (
          <Help onBack={() => setHelpOpen(false)} />
        ) : docsOpen ? (
          <Documents
            userId={userId}
            onBack={() => setDocsOpen(false)}
            onChanged={() => {
              void loadVehicles();
              void loadDriver();
            }}
          />
        ) : (
          <Profile
            email={session.user.email ?? ""}
            onDocuments={() => setDocsOpen(true)}
            onHelp={() => setHelpOpen(true)}
            driver={driver}
            vehicles={vehicles}
            onSignOut={signOut}
            location={driver ? <LocationCard consented={Boolean(driver.location_consent_at)} state={tracking} onChanged={loadDriver} /> : undefined}
          />
        )}
      </View>
      <TabBar
        tab={tab}
        tripsBadge={trips.filter((t) => t.status === "confirmed" || t.status === "in_progress").length}
        onChange={(id) => {
          setTab(id);
          setDocsOpen(false);
          setHelpOpen(false);
          if (id !== "trips") setTripId(null);
          if (id === "calendar" || id === "trips" || id === "earnings") void loadTrips();
        }}
      />
    </SafeAreaView>
  );
}
