import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cents, useBooking } from "../booking";
import { SITE_URL } from "../config";
import { useDemo } from "../demo";
import { TOWNS, crDateTime } from "../format";
import { tap } from "../haptics";
import { LangToggle, useT } from "../i18n";
import { photoFor, photoForTrip } from "../images";
import { Logo } from "../Logo";
import { openTrip, useNav } from "../nav";
import { Photo } from "../Photo";
import { POPULAR, driveTime, fetchTours, hub, popularPrices, type PopularPrice } from "../prices";
import { upcomingBookings, useSession } from "../session";
import { C, R, S, SHADOW, SP, T } from "../theme";
import type { Tour } from "../types";
import { Badge, Bar, LinkBtn, SectionTitle, Skeleton, Text } from "../ui";
import { bookingStage } from "./Trips";

const CARD_W = 248;

/**
 * The first screen: a "Where to?" search card, popular rides and day tours
 * with a picture each, what we promise, and the next trip on top for someone
 * who is signed in and has one coming up.
 */
export function Home() {
  const { lang, t } = useT();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const demo = useDemo();
  const { state, set } = useBooking();
  const { trips, reload, loading, email } = useSession();
  const [prices, setPrices] = useState<Record<string, PopularPrice>>(demo?.popular ?? {});
  const [pricesDone, setPricesDone] = useState(Boolean(demo && !demo.loading));
  const [tours, setTours] = useState<Tour[] | null>(demo ? (demo.loading ? null : (demo.homeTours ?? [])) : null);
  const { date, pax } = state;

  const load = useCallback(async () => {
    if (demo) return;
    void fetchTours(date, pax).then((res) => setTours(res.ok && res.data ? res.data.tours : []));
    await popularPrices(date, pax, setPrices);
    setPricesDone(true);
  }, [date, pax, demo]);
  useEffect(() => {
    void load();
  }, [load]);

  const next = upcomingBookings(trips)[0]?.booking;

  function startRide(from?: string, to?: string) {
    tap();
    set(from && to ? { kind: "ride", from: hub(from), to: hub(to), stopIds: [] } : { kind: "ride" });
    nav.navigate("BookWhere");
  }
  function openTour(id: string) {
    tap();
    set({ kind: "tour", tourId: id, upgrade: false });
    nav.navigate("TourDetail", { id });
  }
  function allTours() {
    set({ kind: "tour" });
    nav.navigate("Tours");
  }

  return (
    <ScrollView
      style={S.screen}
      contentContainerStyle={{ paddingTop: insets.top + SP.md, paddingBottom: SP.xxl, gap: SP.xl }}
      showsVerticalScrollIndicator={false}
      refreshControl={email ? <RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={C.emerald} /> : undefined}
    >
      <Bar style="dark" />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SP.page }}>
        <Logo size={38} />
        <LangToggle />
      </View>

      {next ? (
        <View style={{ paddingHorizontal: SP.page, gap: SP.md }}>
          <Text style={T.label}>{t("Your next trip", "Su próximo viaje")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Your next trip: ", "Su próximo viaje: ") + next.title}
            onPress={() => openTrip(next.id)}
            style={({ pressed }) => [S.card, { padding: 0, gap: 0, flexDirection: "row", overflow: "hidden", opacity: pressed ? 0.85 : 1 }]}
          >
            <Photo name={photoForTrip(next.title)} style={{ width: 104, alignSelf: "stretch", minHeight: 112 }} />
            <View style={{ flex: 1, padding: SP.lg, gap: 6 }}>
              <NextStage booking={next} />
              <Text style={T.h3} numberOfLines={2}>
                {next.title}
              </Text>
              <Text style={T.small}>
                {crDateTime(next.scheduledAt, lang)}
                {next.driver ? t(" · with ", " · con ") + next.driver.firstName : ""}
              </Text>
            </View>
            <View style={{ justifyContent: "center", paddingRight: SP.md }}>
              <Ionicons name="chevron-forward" size={20} color={C.faint} />
            </View>
          </Pressable>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: SP.page, gap: SP.lg }}>
        <View style={{ gap: 6 }}>
          <Text accessibilityRole="header" style={T.display}>
            {t("Private rides across Costa Rica", "Traslados privados por Costa Rica")}
          </Text>
          <Text style={T.body}>{t("Door to door with a hand-picked local driver. See the price before you book.", "De puerta a puerta con un conductor local seleccionado. Vea el precio antes de reservar.")}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Where to? Plan a private ride", "¿A dónde va? Planee un traslado privado")}
          onPress={() => startRide()}
          style={({ pressed }) => [
            { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", borderRadius: R.pill, paddingLeft: 20, paddingRight: 8, paddingVertical: 8, minHeight: 68, borderWidth: 1, borderColor: C.border, opacity: pressed ? 0.85 : 1 },
            SHADOW,
          ]}
        >
          <Ionicons name="search" size={22} color={C.text} />
          <View style={{ flex: 1 }}>
            <Text style={T.bodyStrong}>{t("Where to?", "¿A dónde va?")}</Text>
            <Text style={T.small} numberOfLines={1}>
              {t("Airport, town, hotel or address", "Aeropuerto, pueblo, hotel o dirección")}
            </Text>
          </View>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.emerald, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          </View>
        </Pressable>
      </View>

      <View style={{ gap: SP.md }}>
        <View style={{ paddingHorizontal: SP.page }}>
          <SectionTitle title={t("Popular rides", "Traslados populares")} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.page, gap: SP.md, paddingBottom: 14 }} snapToInterval={CARD_W + SP.md} decelerationRate="fast">
          {POPULAR.map((r) => {
            const p = prices[r.from + ">" + r.to];
            return (
              <Pressable
                key={r.from + r.to}
                accessibilityRole="button"
                accessibilityLabel={TOWNS[r.from] + " → " + TOWNS[r.to] + (p ? t(", from ", ", desde ") + cents(p.fromCents) : "")}
                onPress={() => startRide(r.from, r.to)}
                style={({ pressed }) => [S.card, { width: CARD_W, padding: 0, gap: 0, overflow: "hidden", opacity: pressed ? 0.85 : 1 }]}
              >
                <Photo name={r.photo} style={{ height: 150 }}>
                  {p ? (
                    <View style={{ position: "absolute", left: 12, top: 12 }}>
                      <Badge solid icon="time-outline" text={driveTime(p.minutes)} />
                    </View>
                  ) : null}
                </Photo>
                <View style={{ padding: SP.lg, gap: 4 }}>
                  <Text style={T.h3} numberOfLines={1}>
                    {TOWNS[r.to]}
                  </Text>
                  <Text style={T.small} numberOfLines={1}>
                    {t("from ", "desde ") + TOWNS[r.from]}
                  </Text>
                  {p ? (
                    <Text style={[T.small, { marginTop: 4 }]}>
                      {t("From ", "Desde ")}
                      <Text style={{ fontWeight: "700", color: C.text, fontSize: 17 }}>{cents(p.fromCents)}</Text>
                      {t(" per car", " por vehículo")}
                    </Text>
                  ) : pricesDone ? (
                    <Text style={[T.smallStrong, { color: C.emerald, marginTop: 4 }]}>{t("See price", "Ver precio")}</Text>
                  ) : (
                    <Skeleton height={18} width={120} style={{ marginTop: 6 }} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {tours === null || tours.length > 0 ? (
        <View style={{ gap: SP.md }}>
          <View style={{ paddingHorizontal: SP.page }}>
            <SectionTitle title={t("Day tours", "Tours de un día")} action={t("See all", "Ver todos")} onAction={allTours} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.page, gap: SP.md, paddingBottom: 14 }} snapToInterval={CARD_W + SP.md} decelerationRate="fast">
            {tours === null
              ? [0, 1].map((i) => (
                  <View key={i} style={[S.card, { width: CARD_W, padding: 0, gap: 0, overflow: "hidden" }]}>
                    <Skeleton height={150} radius={0} />
                    <View style={{ padding: SP.lg, gap: 10 }}>
                      <Skeleton height={18} width="85%" />
                      <Skeleton height={14} width="55%" />
                    </View>
                  </View>
                ))
              : tours.map((tour) => (
                  <Pressable
                    key={tour.id}
                    accessibilityRole="button"
                    accessibilityLabel={tour.name}
                    onPress={() => openTour(tour.id)}
                    style={({ pressed }) => [S.card, { width: CARD_W, padding: 0, gap: 0, overflow: "hidden", opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Photo name={"tour:" + tour.id} fallback={photoFor((tour.regionName ?? "") + " " + tour.name)} style={{ height: 150 }}>
                      {tour.regionName ? (
                        <View style={{ position: "absolute", left: 12, top: 12, right: 12 }}>
                          <Badge solid icon="location-outline" text={tour.regionName.split(" / ")[0].split(" & ")[0]} />
                        </View>
                      ) : null}
                    </Photo>
                    <View style={{ padding: SP.lg, gap: 4 }}>
                      <Text style={T.h3} numberOfLines={2}>
                        {tour.name}
                      </Text>
                      <Text style={[T.small, { marginTop: 4 }]}>
                        {tour.durationHours + " h · "}
                        <Text style={{ fontWeight: "700", color: C.text, fontSize: 17 }}>{cents(tour.perPersonCents)}</Text>
                        {t(" per person", " por persona")}
                      </Text>
                    </View>
                  </Pressable>
                ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: SP.page, gap: SP.md }}>
        <SectionTitle title={t("Travel with peace of mind", "Viaje con tranquilidad")} />
        <View style={{ backgroundColor: C.surface, borderRadius: R.card, padding: SP.lg, gap: SP.lg }}>
          <Pledge icon="pricetag-outline" title={t("Fixed price before you pay", "Precio fijo antes de pagar")} text={t("For the whole car, taxes included.", "Por todo el vehículo, impuestos incluidos.")} />
          <Pledge icon="calendar-clear-outline" title={t("Free cancellation", "Cancelación gratis")} text={t("Up to 24 hours before pickup.", "Hasta 24 horas antes de la recogida.")} />
          <Pledge icon="shield-checkmark-outline" title={t("Drivers with documents checked", "Conductores con documentos verificados")} text={t("ID, licence and insurance reviewed by our team.", "Identificación, licencia y seguro revisados por nuestro equipo.")} />
          <Pledge icon="logo-whatsapp" title={t("WhatsApp support", "Soporte por WhatsApp")} text={t("Our team answers before and during your trip.", "Nuestro equipo le responde antes y durante su viaje.")} />
        </View>
        <View style={{ alignItems: "center" }}>
          <LinkBtn label={t("Multi-day expeditions are on our website", "Las expediciones de varios días están en nuestro sitio web")} icon="open-outline" onPress={() => void WebBrowser.openBrowserAsync(SITE_URL)} />
        </View>
      </View>
    </ScrollView>
  );
}

function NextStage({ booking }: { booking: Parameters<typeof bookingStage>[0] }) {
  const { lang } = useT();
  const stage = bookingStage(booking, lang);
  return <Badge text={stage.text} tone={stage.tone} icon={stage.icon} />;
}

function Pledge({ icon, title, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={22} color={C.emerald} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={T.bodyStrong}>{title}</Text>
        <Text style={T.small}>{text}</Text>
      </View>
    </View>
  );
}
