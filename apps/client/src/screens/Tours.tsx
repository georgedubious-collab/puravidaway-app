import { Ionicons } from "@expo/vector-icons";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cents, useBooking } from "../booking";
import { shortDate } from "../DatePicker";
import { plural } from "../format";
import { pick, tap } from "../haptics";
import { LangToggle, useT } from "../i18n";
import { photoFor } from "../images";
import { useNav, type RootParams } from "../nav";
import { Photo } from "../Photo";
import { C, R, S, SHADOW, SP, T } from "../theme";
import type { Tour } from "../types";
import { Badge, Bar, Chip, Page, RoundBtn, SkeletonCard, Text } from "../ui";
import { PriceBar } from "./book/parts";

const tourPhoto = (tour: Tour) => ({ name: "tour:" + tour.id, fallback: photoFor((tour.regionName ?? "") + " " + tour.name) });

/** The date and group size a tour is priced for; tap to change them. */
function WhenPill() {
  const { lang, t } = useT();
  const nav = useNav();
  const { state } = useBooking();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("Change the date or the number of travellers", "Cambiar la fecha o el número de viajeros")}
      onPress={() => nav.navigate("TourWhen")}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: R.pill, borderWidth: 1, borderColor: C.border, paddingHorizontal: 18, minHeight: 56, opacity: pressed ? 0.7 : 1 }, SHADOW]}
    >
      <Ionicons name="calendar-outline" size={20} color={C.emerald} />
      <Text style={[T.bodyStrong, { flex: 1 }]}>
        {shortDate(state.date, lang)} · {plural(state.pax, "traveller", lang)}
      </Text>
      <Text style={{ color: C.emerald, fontWeight: "700", fontSize: 15 }}>{t("Change", "Cambiar")}</Text>
    </Pressable>
  );
}

/** Day tours: region chips, then a big card per tour. */
export function Tours() {
  const { lang, t } = useT();
  const nav = useNav();
  const { state, set, tours, toursError } = useBooking();
  const [region, setRegion] = useState("ALL");
  // Opened from a link while planning a ride: from here on a tour is being planned.
  useEffect(() => {
    if (state.kind !== "tour") set({ kind: "tour" });
  }, [state.kind, set]);

  const regions = [...new Map((tours ?? []).filter((x) => x.region && x.regionName).map((x) => [x.region as string, x.regionName as string])).entries()];
  const shown = (tours ?? []).filter((tour) => region === "ALL" || tour.region === region);
  return (
    <Page>
      <Bar style="dark" />
      <View style={{ gap: 6 }}>
        <Text accessibilityRole="header" style={T.display}>
          {t("Day tours", "Tours de un día")}
        </Text>
        <Text style={T.body}>{t("Private, with a guide, entrances and lunch included.", "Privados, con guía, entradas y almuerzo incluidos.")}</Text>
      </View>
      <WhenPill />
      {toursError ? (
        <Text accessibilityRole="alert" style={S.error}>
          {toursError}
        </Text>
      ) : null}
      {regions.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -SP.page }} contentContainerStyle={{ gap: 8, paddingHorizontal: SP.page }} accessibilityRole="radiogroup">
          <Chip label={t("All regions", "Todas las regiones")} on={region === "ALL"} onPress={() => setRegion("ALL")} />
          {regions.map(([id, name]) => (
            <Chip key={id} label={name} on={region === id} onPress={() => setRegion(id)} />
          ))}
        </ScrollView>
      ) : null}
      {tours === null && !toursError ? (
        <>
          <SkeletonCard photo={180} />
          <SkeletonCard photo={180} />
        </>
      ) : null}
      {shown.map((tour) => (
        <Pressable
          key={tour.id}
          accessibilityRole="button"
          accessibilityLabel={tour.name + ", " + cents(tour.totalCents)}
          onPress={() => {
            tap();
            set({ tourId: tour.id, upgrade: state.tourId === tour.id ? state.upgrade : false });
            nav.navigate("TourDetail", { id: tour.id });
          }}
          style={({ pressed }) => [S.card, { padding: 0, gap: 0, overflow: "hidden", opacity: pressed ? 0.88 : 1 }]}
        >
          <Photo {...tourPhoto(tour)} style={{ height: 180 }}>
            {tour.regionName ? (
              <View style={{ position: "absolute", left: 12, top: 12, right: 12 }}>
                <Badge solid icon="location-outline" text={tour.regionName} />
              </View>
            ) : null}
          </Photo>
          <View style={{ padding: SP.lg, gap: 8 }}>
            <Text style={T.h2}>{tour.name}</Text>
            <Text style={T.small}>{tour.highlights.join(" · ")}</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Badge text={plural(tour.durationHours, "hour", lang)} tone="grey" icon="time-outline" />
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={T.money}>{cents(tour.totalCents)}</Text>
                <Text style={T.caption}>
                  {plural(state.pax, "traveller", lang)} · {cents(tour.perPersonCents) + t(" per person", " por persona")}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      ))}
    </Page>
  );
}

/** One tour: big picture, what's in it, the en-route upgrade, and "Choose this tour". */
export function TourDetail() {
  const { lang, t } = useT();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { id } = useRoute<RouteProp<RootParams, "TourDetail">>().params;
  const { state, set, tours, toursError } = useBooking();
  const tour = tours?.find((x) => x.id === id);
  useEffect(() => {
    if (state.kind !== "tour" || state.tourId !== id) set({ kind: "tour", tourId: id });
  }, [state.kind, state.tourId, id, set]);

  const upgradeCents = tour?.totalWithUpgradeCents != null ? tour.totalWithUpgradeCents - tour.totalCents : 0;
  const upgrade = state.upgrade && upgradeCents > 0;
  const total = tour ? (upgrade ? (tour.totalWithUpgradeCents as number) : tour.totalCents) : 0;

  return (
    <View style={S.screen}>
      <Bar style="light" />
      <Page
        pad={false}
        footer={
          <PriceBar
            label={plural(state.pax, "traveller", lang) + (tour ? " · " + cents(tour.perPersonCents) + t(" per person", " por persona") : "")}
            amount={tour ? cents(total) : toursError ? "—" : null}
            action={t("Choose this tour", "Elegir este tour")}
            icon={null}
            onPress={() => nav.navigate("BookReview")}
            disabled={!tour}
          />
        }
      >
        <Photo name={"tour:" + id} fallback={tour ? tourPhoto(tour).fallback : undefined} scrim style={{ height: 300 }} label={tour?.name} />
        <View style={{ padding: SP.page, gap: SP.lg, marginTop: -28, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
          {tour ? (
            <>
              {tour.regionName ? <Badge text={tour.regionName} icon="location-outline" /> : null}
              <Text accessibilityRole="header" style={T.h1}>
                {tour.name}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Badge text={plural(tour.durationHours, "hour", lang)} tone="grey" icon="time-outline" />
                <Badge text={t("Private", "Privado")} tone="grey" icon="lock-closed-outline" />
                <Badge text={t("Guide, entrances and lunch included", "Guía, entradas y almuerzo incluidos")} tone="grey" icon="restaurant-outline" />
              </View>
              <WhenPill />
              <View style={{ gap: 12 }}>
                <Text style={T.h2}>{t("Highlights", "Lo más destacado")}</Text>
                {tour.highlights.map((h) => (
                  <View key={h} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="checkmark" size={18} color={C.emerald} />
                    </View>
                    <Text style={[T.body, { flex: 1, color: C.text }]}>{h}</Text>
                  </View>
                ))}
              </View>
              {upgradeCents > 0 ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: upgrade }}
                  onPress={() => {
                    pick();
                    set({ upgrade: !state.upgrade });
                  }}
                  style={({ pressed }) => ({ flexDirection: "row", gap: 12, backgroundColor: upgrade ? C.emeraldTint : "#FFF7DD", borderRadius: R.card, borderWidth: 2, borderColor: upgrade ? C.emerald : "transparent", padding: SP.lg, opacity: pressed ? 0.75 : 1 })}
                >
                  <Ionicons name={upgrade ? "checkbox" : "square-outline"} size={26} color={upgrade ? C.emerald : C.amber} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={T.h3}>{"Smart En-Route Transfer (+" + cents(upgradeCents) + ")"}</Text>
                    <Text style={T.small}>{t("End the day at your next hotel instead of returning.", "Termine el día en su próximo hotel en lugar de regresar.")}</Text>
                  </View>
                </Pressable>
              ) : null}
            </>
          ) : toursError ? (
            <Text accessibilityRole="alert" style={S.error}>
              {toursError}
            </Text>
          ) : (
            <SkeletonCard photo={0} />
          )}
        </View>
      </Page>
      <View style={{ position: "absolute", top: insets.top + 8, left: SP.page, right: SP.page, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <RoundBtn icon="chevron-back" label={t("Back", "Volver")} onPress={() => nav.goBack()} />
        <LangToggle />
      </View>
    </View>
  );
}
