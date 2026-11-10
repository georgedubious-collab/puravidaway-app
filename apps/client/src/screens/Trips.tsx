import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, SectionList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBooking } from "../booking";
import { useDemo } from "../demo";
import { crDateTime, usd } from "../format";
import { LangToggle, useT, type Lang } from "../i18n";
import { photoForTrip } from "../images";
import { useNav } from "../nav";
import { Photo } from "../Photo";
import { allBookings, isPast, upcomingBookings, useSession } from "../session";
import { C, S, SP, T } from "../theme";
import type { AppBooking } from "../types";
import { Badge, Bar, Btn, Card, Empty, ScreenTitle, SkeletonCard, Text, type IconName } from "../ui";
import { SignInCard } from "./SignIn";

/** Where a booking stands, in a couple of words, with a colour and an icon. */
export function bookingStage(b: AppBooking, lang: Lang = "en"): { text: string; tone?: "sky" | "amber" | "red" | "grey"; icon: IconName } {
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  if (b.status === "in_progress") return { text: t("On the road", "En ruta"), icon: "car" };
  if (b.status === "completed") return { text: t("Completed", "Completado"), tone: "grey", icon: "checkmark-circle" };
  if (b.status === "cancelled") return { text: t("Cancelled", "Cancelado"), tone: "red", icon: "close-circle" };
  if (b.status === "confirmed")
    return b.driverOnTheWay ? { text: t("Driver on the way", "Conductor en camino"), tone: "sky", icon: "navigate" } : { text: t("Confirmed", "Confirmado"), icon: "checkmark-circle" };
  if (b.status === "pending_bids") return { text: t("Finding your driver", "Buscando su conductor"), tone: "amber", icon: "search" };
  return { text: t("Request received", "Solicitud recibida"), tone: "amber", icon: "time-outline" };
}

/** The driver's photo in a circle, or their initial when there is no photo. */
export function Avatar({ name, photo, size = 44 }: { name: string; photo?: string | null; size?: number }) {
  const { t } = useT();
  if (photo) return <Image source={{ uri: photo }} accessibilityLabel={name + t(", your driver", ", su conductor")} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surface }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.emerald, alignItems: "center", justifyContent: "center" }}>
      <Text maxFontSizeMultiplier={1} style={{ color: "#fff", fontSize: size * 0.42, fontWeight: "700" }}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

/** My trips when nobody is signed in on this phone: get back in with a code, or plan a trip. */
function SignedOut() {
  const { t } = useT();
  const nav = useNav();
  const demo = useDemo();
  const insets = useSafeAreaInsets();
  const { set } = useBooking();
  return (
    <ScrollView style={S.screen} contentContainerStyle={[S.pad, { paddingTop: insets.top + SP.lg }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
      <Bar style="dark" />
      <ScreenTitle title={t("Your trips", "Sus viajes")} right={<LangToggle />} />
      <SignInCard demoSent={demo?.codeSentTo} />
      <Card tone="emerald">
        <Text style={T.h2}>{t("New here?", "¿Primera vez?")}</Text>
        <Text style={T.body}>
          {t(
            "See prices and book a private ride or day tour. No account needed: we just confirm your email with a code when you send the request.",
            "Vea precios y reserve un traslado privado o un tour de un día. No necesita cuenta: solo confirmamos su correo con un código al enviar la solicitud.",
          )}
        </Text>
        <Btn
          label={t("Plan a trip", "Planear un viaje")}
          icon="search"
          onPress={() => {
            set({ kind: "ride" });
            nav.navigate("BookWhere");
          }}
        />
      </Card>
    </ScrollView>
  );
}

/** Every ride, tour and expedition booked with this email: what's coming up, then what's done. */
export function Trips() {
  const { lang, t } = useT();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { set } = useBooking();
  const { email, trips, loaded, error, reload } = useSession();
  const [pulling, setPulling] = useState(false);
  // Coming back to this tab shows the latest without anyone having to pull.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  if (email === null) return <SignedOut />;

  const byDate = (a: { booking: AppBooking }, b: { booking: AppBooking }) => (a.booking.scheduledAt ?? "").localeCompare(b.booking.scheduledAt ?? "");
  const upcoming = upcomingBookings(trips);
  const done = allBookings(trips)
    .filter((r) => isPast(r.booking.status))
    .sort((a, b) => byDate(b, a));
  const sections = [
    { title: t("Upcoming", "Próximos"), data: upcoming },
    { title: t("Past trips", "Viajes anteriores"), data: done },
  ].filter((s) => s.data.length > 0);

  async function pull() {
    setPulling(true);
    await reload();
    setPulling(false);
  }

  return (
    <SectionList
      style={S.screen}
      contentContainerStyle={[S.pad, { paddingTop: insets.top + SP.lg }]}
      sections={loaded ? sections : []}
      keyExtractor={(r) => r.booking.id}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} tintColor={C.emerald} colors={[C.emerald]} />}
      ListHeaderComponent={
        <View style={{ gap: SP.md }}>
          <Bar style="dark" />
          <ScreenTitle title={t("Your trips", "Sus viajes")} right={<LangToggle />} />
          {error ? (
            <Text accessibilityRole="alert" style={S.error}>
              {error}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !loaded ? (
          <View style={{ gap: SP.lg }} accessibilityLabel={t("Loading your trips", "Cargando sus viajes")}>
            <SkeletonCard photo={130} />
            <SkeletonCard photo={130} />
          </View>
        ) : (
          <View style={{ gap: SP.md }}>
            <Empty icon="map-outline" title={t("No trips yet", "Aún no hay viajes")} text={t("No trips yet for this email. If you booked with another address, sign in with that one.", "Aún no hay viajes con este correo. Si reservó con otra dirección, inicie sesión con esa.")} />
            <Btn
              label={t("Plan a trip", "Planear un viaje")}
              icon="search"
              onPress={() => {
                set({ kind: "ride" });
                nav.navigate("BookWhere");
              }}
            />
          </View>
        )
      }
      renderSectionHeader={({ section }) => <Text style={[T.h2, { marginTop: 4 }]}>{section.title}</Text>}
      renderItem={({ item: { booking: b } }) => {
        const stage = bookingStage(b, lang);
        const live = b.status === "in_progress" || b.driverOnTheWay;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={b.title + ", " + stage.text + ", " + crDateTime(b.scheduledAt, lang)}
            onPress={() => nav.navigate("TripDetail", { id: b.id })}
            style={({ pressed }) => [S.card, { padding: 0, gap: 0, overflow: "hidden", borderWidth: live ? 2 : 0, borderColor: C.emerald, opacity: pressed ? 0.88 : 1 }]}
          >
            <Photo name={photoForTrip(b.title)} style={{ height: 130, opacity: isPast(b.status) ? 0.75 : 1 }}>
              <View style={{ position: "absolute", left: 12, top: 12, right: 12 }}>
                <Badge solid text={stage.text} tone={stage.tone} icon={stage.icon} />
              </View>
            </Photo>
            <View style={{ padding: SP.lg, gap: 10 }}>
              <View style={{ gap: 2 }}>
                <Text style={T.h3}>{b.title}</Text>
                <Text style={T.small}>{crDateTime(b.scheduledAt, lang)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {b.driver ? (
                  <>
                    <Avatar name={b.driver.firstName} photo={b.driver.photo} size={32} />
                    <Text style={[T.smallStrong, { flex: 1 }]} numberOfLines={1}>
                      {t("With ", "Con ") + b.driver.firstName}
                    </Text>
                  </>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                {b.status === "cancelled" ? null : b.dueUsd > 0 ? <Text style={[T.h3, { fontWeight: "800" }]}>{usd(b.dueUsd)}</Text> : <Text style={[T.smallStrong, { color: C.emerald }]}>{t("Paid", "Pagado")}</Text>}
                <Ionicons name="chevron-forward" size={18} color={C.faint} />
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}
