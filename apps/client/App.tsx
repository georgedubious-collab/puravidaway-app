import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { api } from "./src/api";
import { SITE_URL } from "./src/config";
import { registerForPush, unregisterPush } from "./src/push";
import { Book } from "./src/screens/Book";
import { Checkout } from "./src/screens/Checkout";
import { SignIn } from "./src/screens/SignIn";
import { TripDetail } from "./src/screens/TripDetail";
import { Trips } from "./src/screens/Trips";
import { supabase } from "./src/supabase";
import { C, S } from "./src/theme";
import type { AppTrip } from "./src/types";
import { Btn, Card, Field } from "./src/ui";

type Tab = "trips" | "book" | "account";
const TABS: { id: Tab; label: string }[] = [
  { id: "trips", label: "My trips" },
  { id: "book", label: "Plan a trip" },
  { id: "account", label: "Account" },
];

/**
 * Costa Rica Private Transfers (traveller app). Travellers sign in with the email
 * they book with and see their trips, their driver and car (and where the driver
 * is around the pickup), the chat and the rating, and can plan, send and pay for
 * a ride or day tour in the app (test checkout until card payments are connected).
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
  const [tab, setTab] = useState<Tab>("trips");
  const [openId, setOpenId] = useState<string | null>(null);
  const [trips, setTrips] = useState<AppTrip[]>([]);
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // After a request is sent from the app: the "sent / pay" screen.
  const [sent, setSent] = useState<{ tripToken: string | null; payOnline: boolean; totalCents: number; testCheckout: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api<{ trips: AppTrip[]; whatsapp: string }>("/client/trips");
    setLoading(false);
    if (!res.ok || !res.data) return setError(res.error ?? "Couldn't load your trips.");
    setError("");
    setTrips(res.data.trips);
    setWhatsapp(res.data.whatsapp ?? "");
  }, []);

  useEffect(() => {
    void load();
    void registerForPush();
  }, [load]);

  // A tapped notification ("your driver is on the way", "rate your ride") opens that booking.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { screen?: string; id?: string } | undefined;
      if (data?.screen === "trip" && data.id) {
        void load();
        setTab("trips");
        setOpenId(data.id);
      }
    });
    return () => sub.remove();
  }, [load]);

  const open = openId ? trips.flatMap((t) => t.bookings.map((b) => ({ t, b }))).find((x) => x.b.id === openId) : undefined;
  const book = () => setTab("book");

  async function signOut() {
    await unregisterPush();
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.emeraldDark }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>Costa Rica Private Transfers</Text>
      </View>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {tab === "trips" && open ? (
          <TripDetail booking={open.b} token={open.t.token} onBack={() => setOpenId(null)} onChanged={load} />
        ) : tab === "trips" ? (
          <>
            {error ? <Text style={[S.error, { padding: 16 }]}>{error}</Text> : null}
            <Trips trips={trips} loading={loading} onRefresh={load} onOpen={setOpenId} onBook={book} />
          </>
        ) : tab === "book" && sent ? (
          <Checkout
            {...sent}
            onDone={() => {
              setSent(null);
              setTab("trips");
              void load();
            }}
          />
        ) : tab === "book" ? (
          <Book
            email={session.user.email ?? ""}
            onBooked={(tripToken, payOnline, totalCents, testCheckout) => {
              setSent({ tripToken, payOnline, totalCents, testCheckout });
              void load();
            }}
          />
        ) : (
          <ScrollView style={S.screen} contentContainerStyle={S.pad}>
            <Text style={S.h1}>Account</Text>
            <Card>
              <Field label="Signed in as" value={session.user.email} />
              <Text style={S.muted}>Your trips are found by this email. Use the same address when you send a trip request.</Text>
            </Card>
            {whatsapp ? <Btn label="Message us on WhatsApp" alt onPress={() => void Linking.openURL("https://wa.me/" + whatsapp)} /> : null}
            <Btn label="Terms" alt onPress={() => void WebBrowser.openBrowserAsync(SITE_URL + "/terms")} />
            <Btn label="Privacy policy" alt onPress={() => void WebBrowser.openBrowserAsync(SITE_URL + "/privacy")} />
            <Btn label="Cancellation policy" alt onPress={() => void WebBrowser.openBrowserAsync(SITE_URL + "/cancellation")} />
            <Btn label="Sign out" onPress={signOut} color={C.red} />
          </ScrollView>
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
                setOpenId(null);
                if (t.id !== "book") setSent(null);
                if (t.id === "trips") void load();
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
