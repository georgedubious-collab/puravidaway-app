import type { Session } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
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
import { crDateTime } from "./src/format";
import { Bar, Drawer, drawerProfile, SECTION_TITLE, SEGMENT_TITLE, type Section, type Segment } from "./src/nav";
import { Preview } from "./src/preview";
import { LangProvider, useT } from "./src/i18n";
import type { DriverInfo, Names, Trip, Vehicle } from "./src/types";

/** Design previews with sample data (web only, never in a phone build): EXPO_PUBLIC_PREVIEW=1. */
const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW === "1";

/**
 * Costa Rica Private Transfers Partner (driver app). A side menu (☰) over the sections and a
 * trip screen; a small hand-rolled navigator, no navigation library. Reading goes straight
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
  const { t, lang } = useT();
  // Upcoming trips are the home screen; everything else is in the side menu.
  const [section, setSection] = useState<Section>("trips");
  const [segment, setSegment] = useState<Segment>("upcoming");
  const [menuOpen, setMenuOpen] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [focusJob, setFocusJob] = useState<string | undefined>(undefined);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [fullName, setFullName] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [offers, setOffers] = useState(0);
  const [names, setNames] = useState<Names>({ tours: {}, stops: {} });
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState<TrackingState | null>(null);
  const askedToApply = useRef(false);
  const userId = session.user.id;

  const loadDriver = useCallback(async () => {
    const [{ data }, prof] = await Promise.all([
      supabase.from("drivers").select("*").eq("id", userId).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);
    const d = (data as DriverInfo | null) ?? null;
    setDriver(d);
    setFullName(((prof.data as { full_name?: string | null } | null)?.full_name ?? "").trim());
    // Someone new, with no application yet: take them straight to the application form.
    if (!d && !askedToApply.current) {
      askedToApply.current = true;
      setSection("documents");
    }
    // Location sharing follows the driver's trips: on inside the trip window, off outside it.
    setTracking(await syncTracking(Boolean(d?.location_consent_at)));
  }, [userId]);

  // How many open jobs the driver can offer on (the gold count in the menu and on the bell).
  const loadOffers = useCallback(async () => {
    const { data, error } = await supabase.rpc("driver_jobs");
    if (!error) setOffers(((data as unknown[] | null) ?? []).length);
  }, []);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    const [{ data }, unread] = await Promise.all([supabase.rpc("my_trips"), supabase.rpc("my_chat_unread")]);
    setLoading(false);
    // Unread chat messages per trip (badge on the trip card); missing before migration 0034.
    const counts = new Map(((unread.data as { booking_id: string; unread: number }[] | null) ?? []).map((u) => [u.booking_id, u.unread]));
    setTrips(((data as Trip[] | null) ?? []).map((x) => ({ ...x, unread_chat: counts.get(x.id) ?? 0 })));
    void loadOffers();
    await loadDriver();
  }, [loadDriver, loadOffers]);

  const loadVehicles = useCallback(async () => {
    const v = await supabase.from("driver_vehicles").select("*").eq("driver_id", userId).order("created_at");
    setVehicles((v.data as Vehicle[] | null) ?? []);
  }, [userId]);

  useEffect(() => {
    void loadVehicles();
    void (async () => {
      const [tours, stops] = await Promise.all([
        supabase.from("day_tours").select("id, name"),
        supabase.from("sightseeing_stops").select("id, name, duration_min"),
      ]);
      type Row = { id: string; name: string; duration_min?: number };
      const toMap = (rows: Row[] | null) => Object.fromEntries((rows ?? []).map((r) => [r.id, r.name]));
      const stopRows = stops.data as Row[] | null;
      setNames({
        tours: toMap(tours.data as Row[] | null),
        stops: toMap(stopRows),
        stopMinutes: Object.fromEntries((stopRows ?? []).filter((r) => r.duration_min).map((r) => [r.id, Number(r.duration_min)])),
      });
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
        setSection("trips");
        setTripId(data.id);
      } else if (data?.screen === "job") {
        setTripId(null);
        setFocusJob(data.id);
        setSection("jobs");
      }
    });
    return () => sub.remove();
  }, [loadTrips]);

  async function signOut() {
    await stopTracking();
    await unregisterPush();
    await supabase.auth.signOut();
  }

  function go(s: Section) {
    setSection(s);
    setTripId(null);
    if (s === "calendar" || s === "trips" || s === "earnings") void loadTrips();
  }

  const openTrip = section === "trips" && tripId ? trips.find((x) => x.id === tripId) : undefined;
  const title = openTrip ? crDateTime(openTrip.scheduled_at, lang) : section === "trips" ? t(...SEGMENT_TITLE[segment]) : t(...SECTION_TITLE[section]);
  const location = driver ? <LocationCard consented={Boolean(driver.location_consent_at)} state={tracking} onChanged={loadDriver} /> : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={["top"]}>
      <Bar
        title={title}
        onMenu={() => setMenuOpen(true)}
        onBack={openTrip ? () => setTripId(null) : undefined}
        onBell={openTrip ? undefined : () => go("jobs")}
        bellCount={offers}
      />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {openTrip ? (
          <TripDetail trip={openTrip} names={names} onChanged={loadTrips} />
        ) : section === "trips" ? (
          <Trips
            trips={trips}
            names={names}
            loading={loading}
            onRefresh={loadTrips}
            onOpen={setTripId}
            segment={segment}
            onSegment={setSegment}
            header={driver && !driver.location_consent_at ? location : undefined}
          />
        ) : section === "jobs" ? (
          <Jobs driver={driver} vehicles={vehicles} names={names} trips={trips} focusId={focusJob} onCount={setOffers} />
        ) : section === "calendar" ? (
          <Calendar trips={trips} />
        ) : section === "earnings" ? (
          <Earnings trips={trips} names={names} loading={loading} onRefresh={loadTrips} />
        ) : section === "help" ? (
          <Help />
        ) : section === "documents" ? (
          <Documents
            userId={userId}
            onChanged={() => {
              void loadVehicles();
              void loadDriver();
            }}
          />
        ) : (
          <Profile
            email={session.user.email ?? ""}
            onDocuments={() => go("documents")}
            onHelp={() => go("help")}
            driver={driver}
            vehicles={vehicles}
            onSignOut={signOut}
            location={location}
          />
        )}
      </View>
      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        current={section}
        onGo={go}
        offers={offers}
        onSignOut={() => void signOut()}
        profile={drawerProfile(driver, fullName || (session.user.email ?? ""), t)}
      />
    </SafeAreaView>
  );
}
