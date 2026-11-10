import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { api } from "./src/api";
import { SITE_URL } from "./src/config";
import { registerForPush, unregisterPush } from "./src/push";
import { Book } from "./src/screens/Book";
import { Checkout } from "./src/screens/Checkout";
import { SignInCard } from "./src/screens/SignIn";
import { TripDetail } from "./src/screens/TripDetail";
import { Trips } from "./src/screens/Trips";
import { supabase } from "./src/supabase";
import { C, S } from "./src/theme";
import type { AppTrip } from "./src/types";
import { Btn, Card, Divider, ListRow, ScreenTitle, type IconName } from "./src/ui";
import { Preview } from "./src/preview";
import { LangProvider, LangToggle, useT } from "./src/i18n";

export type Tab = "trips" | "book" | "account";
const TABS: { id: Tab; en: string; es: string; icon: IconName; iconOn: IconName }[] = [
  { id: "trips", en: "My trips", es: "Mis viajes", icon: "map-outline", iconOn: "map" },
  { id: "book", en: "Plan a trip", es: "Planear un viaje", icon: "add-circle-outline", iconOn: "add-circle" },
  { id: "account", en: "Account", es: "Cuenta", icon: "person-outline", iconOn: "person" },
];

/** Design previews with sample data (web only, never in a phone build): EXPO_PUBLIC_PREVIEW=1. */
const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW === "1";

/** The slim brand line above every screen, with the language switch on the right. */
export function TopBar() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, backgroundColor: C.bg }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: C.emeraldDark, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="car-sport" size={15} color="#fff" />
      </View>
      <Text style={{ color: C.emeraldDark, fontSize: 13, fontWeight: "800", flex: 1 }} numberOfLines={1}>
        Costa Rica Private Transfers
      </Text>
      <LangToggle />
    </View>
  );
}

/** Bottom tabs: icon over label, filled icon and a tinted pill for the current one. */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
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
              accessibilityLabel={tr(t.en, t.es)}
              accessibilityState={{ selected: on }}
              onPress={() => onChange(t.id)}
              style={{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2 }}
            >
              <View style={{ paddingHorizontal: 20, paddingVertical: 4, borderRadius: 999, backgroundColor: on ? C.emeraldSoft : "transparent" }}>
                <Ionicons name={on ? t.iconOn : t.icon} size={22} color={on ? C.emerald : C.muted} />
              </View>
              <Text style={{ fontWeight: on ? "800" : "600", fontSize: 11, color: on ? C.emerald : C.muted }} numberOfLines={1}>
                {tr(t.en, t.es)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

/** My trips when nobody is signed in on this phone: get back in with a code, or plan a trip. */
export function SignedOutTrips({ onBook, demoSent }: { onBook: () => void; demoSent?: string }) {
  const { t } = useT();
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <ScreenTitle title={t("Your trips", "Sus viajes")} />
      <SignInCard demoSent={demoSent} />
      <Card tone="emerald">
        <Text style={S.h2}>{t("New here?", "¿Primera vez?")}</Text>
        <Text style={S.text}>
          {t(
            "See prices and book a private ride or day tour. No account needed: we just confirm your email with a code when you send the request.",
            "Vea precios y reserve un traslado privado o un tour de un día. No necesita cuenta: solo confirmamos su correo con un código al enviar la solicitud.",
          )}
        </Text>
        <Btn label={t("Plan a trip", "Planear un viaje")} icon="add-circle-outline" onPress={onBook} color={C.emerald} />
      </Card>
    </ScrollView>
  );
}

/** Who is signed in, how to reach us, the policies, and sign out. `email` is null when nobody is signed in. */
export function Account({ email, whatsapp, onSignOut }: { email: string | null; whatsapp: string; onSignOut: () => void }) {
  const { lang, setLang, t } = useT();
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <ScreenTitle title={t("Account", "Cuenta")} />
      {email === null ? (
        <SignInCard />
      ) : (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.emeraldDark, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>{(email[0] ?? "?").toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={S.label}>{t("Signed in as", "Sesión iniciada como")}</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }} numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>
          <Text style={S.muted}>{t("Your trips are found by this email. Use the same address when you send a trip request.", "Sus viajes se encuentran con este correo. Use la misma dirección cuando envíe una solicitud de viaje.")}</Text>
        </Card>
      )}
      {whatsapp ? (
        <Card>
          <ListRow icon="logo-whatsapp" title={t("Message us on WhatsApp", "Escríbanos por WhatsApp")} detail={t("Questions before or during your trip", "Preguntas antes o durante su viaje")} onPress={() => void Linking.openURL("https://wa.me/" + whatsapp)} />
        </Card>
      ) : null}
      <Card>
        <ListRow
          icon="language-outline"
          title="Language / Idioma"
          detail={lang === "es" ? "Español · toque para cambiar a inglés" : "English · tap to switch to Spanish"}
          onPress={() => setLang(lang === "es" ? "en" : "es")}
        />
      </Card>
      <Card>
        <ListRow icon="document-text-outline" title={t("Terms", "Términos")} onPress={() => void WebBrowser.openBrowserAsync(SITE_URL + "/terms")} />
        <Divider />
        <ListRow icon="lock-closed-outline" title={t("Privacy policy", "Política de privacidad")} onPress={() => void WebBrowser.openBrowserAsync(SITE_URL + "/privacy")} />
        <Divider />
        <ListRow icon="calendar-clear-outline" title={t("Cancellation policy", "Política de cancelación")} detail={t("Free up to 24 hours before pickup", "Gratis hasta 24 horas antes de la recogida")} onPress={() => void WebBrowser.openBrowserAsync(SITE_URL + "/cancellation")} />
      </Card>
      {email !== null ? (
        <Card>
          <ListRow icon="log-out-outline" title={t("Sign out", "Cerrar sesión")} onPress={onSignOut} tone="red" />
        </Card>
      ) : null}
    </ScrollView>
  );
}

/**
 * Costa Rica Private Transfers (traveller app). Anyone can plan a trip and see
 * prices without signing in; when they send a request they confirm their email
 * with a 6-digit code (no account, no password), which also lets them see their trips, their driver and car (and where the driver
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

  if (PREVIEW) return <Preview />;
  return (
    <LangProvider>
    <SafeAreaProvider>
      <StatusBar style={session === undefined ? "light" : "dark"} />
      {session === undefined ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.emeraldDark }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        // Stays mounted when someone signs in from the booking form, so the trip they planned isn't lost.
        <Home session={session} />
      )}
    </SafeAreaProvider>
    </LangProvider>
  );
}

function Home({ session }: { session: Session | null }) {
  const { t } = useT();
  // Read inside load() without making it re-run (and re-register push) when the language changes.
  const tRef = useRef(t);
  tRef.current = t;
  // Signed out, the app opens on Plan a trip; signed in, on their trips.
  const [tab, setTab] = useState<Tab>(session ? "trips" : "book");
  const [openId, setOpenId] = useState<string | null>(null);
  const [trips, setTrips] = useState<AppTrip[]>([]);
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // After a request is sent from the app: the "sent / pay" screen.
  const [sent, setSent] = useState<{ tripToken: string | null; payOnline: boolean; totalCents: number; testCheckout: boolean } | null>(null);

  const signedIn = Boolean(session);
  const load = useCallback(async () => {
    if (!signedIn) {
      setTrips([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await api<{ trips: AppTrip[]; whatsapp: string }>("/client/trips");
    setLoading(false);
    if (!res.ok || !res.data) return setError(res.error ?? tRef.current("Couldn't load your trips.", "No pudimos cargar sus viajes."));
    setError("");
    setTrips(res.data.trips);
    setWhatsapp(res.data.whatsapp ?? "");
  }, [signedIn]);

  useEffect(() => {
    void load();
    if (signedIn) void registerForPush();
  }, [load, signedIn]);

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
    setOpenId(null);
    setSent(null);
    setTab("book");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <TopBar />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {tab === "trips" && open ? (
          <TripDetail booking={open.b} token={open.t.token} onBack={() => setOpenId(null)} onChanged={load} />
        ) : tab === "trips" && !session ? (
          <SignedOutTrips onBook={book} />
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
            email={session ? (session.user.email ?? "") : null}
            onBooked={(tripToken, payOnline, totalCents, testCheckout) => {
              setSent({ tripToken, payOnline, totalCents, testCheckout });
              void load();
            }}
          />
        ) : (
          <Account email={session ? (session.user.email ?? "") : null} whatsapp={whatsapp} onSignOut={() => void signOut()} />
        )}
      </View>
      <TabBar
        tab={tab}
        onChange={(id) => {
          setTab(id);
          setOpenId(null);
          if (id !== "book") setSent(null);
          if (id === "trips") void load();
        }}
      />
    </SafeAreaView>
  );
}
