import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBooking } from "../../booking";
import { Calendar, longDate } from "../../DatePicker";
import { pick } from "../../haptics";
import { useT } from "../../i18n";
import { useNav } from "../../nav";
import { TIMES, crDatePlus, time12, validDate } from "../../prices";
import { C, S, SP, T } from "../../theme";
import { Bar, BottomBar, Btn, Card, Divider, Page, Stepper, Text } from "../../ui";
import { FromBar, PickRow, QuoteProblem, StepIntro } from "./parts";

/** The travellers row: a label and − n +. */
function Travellers() {
  const { t } = useT();
  const { state, set } = useBooking();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingVertical: 10 }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="people-outline" size={20} color={C.emerald} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={T.bodyStrong}>{t("Travellers", "Viajeros")}</Text>
        <Text style={T.small}>{t("Children count too", "Los niños también cuentan")}</Text>
      </View>
      <Stepper value={state.pax} min={1} max={10} onChange={(pax) => set({ pax })} lessLabel={t("One fewer traveller", "Un viajero menos")} moreLabel={t("One more traveller", "Un viajero más")} />
    </View>
  );
}

function DateCard() {
  const { lang } = useT();
  const { state, set } = useBooking();
  const value = validDate(state.date) ? state.date : crDatePlus(14);
  return (
    <Card>
      <Text style={[T.h3, { color: C.emerald }]}>{longDate(value, lang)}</Text>
      <Calendar value={value} min={crDatePlus(1)} onChange={(date) => set({ date })} />
    </Card>
  );
}

/** Step 2 of 5 — When & who: the day, the pickup time, how many travel. */
export function BookWhen() {
  const { t } = useT();
  const nav = useNav();
  const { state, quote } = useBooking();
  return (
    <Page footer={<FromBar canNext={Boolean(quote && quote.vehicles.length)} onNext={() => nav.navigate("BookRide")} />}>
      <Bar style="dark" />
      <StepIntro step={2} title={t("When, and how many?", "¿Cuándo y cuántos viajan?")} />
      <DateCard />
      <Card>
        <View>
          <PickRow icon="time-outline" label={t("Pickup time · Costa Rica time", "Hora de recogida · hora de Costa Rica")} value={time12(state.time)} onPress={() => nav.navigate("TimePicker")} />
          <Divider />
          <Travellers />
        </View>
      </Card>
      <QuoteProblem />
    </Page>
  );
}

/** Slide-up panel for a day tour: the day and how many travel (tours have no pickup-time choice). */
export function TourWhen() {
  const { t } = useT();
  const nav = useNav();
  return (
    <Page
      footer={
        <BottomBar>
          <Btn label={t("Done", "Listo")} onPress={() => nav.goBack()} />
        </BottomBar>
      }
    >
      <Bar style="dark" />
      <DateCard />
      <Card>
        <Travellers />
      </Card>
    </Page>
  );
}

const ROW = 60;

/** Slide-up panel: the pickup time, as one clean list from 4:00 AM to 10:00 PM. */
export function TimePicker() {
  const { t } = useT();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { state, set } = useBooking();
  const list = useRef<FlatList<string>>(null);
  const index = Math.max(0, TIMES.indexOf(state.time));
  useEffect(() => {
    // Open with the chosen time a few rows from the top.
    const id = setTimeout(() => list.current?.scrollToOffset({ offset: Math.max(0, (index - 3) * ROW), animated: false }), 0);
    return () => clearTimeout(id);
    // Only when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={S.screen}>
      <Bar style="dark" />
      <Text style={[T.small, { paddingHorizontal: SP.page, paddingBottom: SP.sm }]}>{t("Times are in Costa Rica time.", "Las horas son en hora de Costa Rica.")}</Text>
      <FlatList
        ref={list}
        data={TIMES}
        keyExtractor={(x) => x}
        getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
        initialNumToRender={TIMES.length}
        contentContainerStyle={{ paddingHorizontal: SP.page, paddingBottom: insets.bottom + SP.xl }}
        accessibilityRole="radiogroup"
        renderItem={({ item }) => {
          const on = item === state.time;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={time12(item)}
              onPress={() => {
                pick();
                set({ time: item });
                nav.goBack();
              }}
              style={({ pressed }) => ({
                height: ROW - 6,
                marginBottom: 6,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 18,
                borderRadius: 16,
                backgroundColor: on ? C.emeraldTint : pressed ? C.surface : "transparent",
                borderWidth: on ? 2 : 0,
                borderColor: C.emerald,
              })}
            >
              <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 20, fontWeight: on ? "700" : "500", color: on ? C.emeraldDark : C.text }}>
                {time12(item)}
              </Text>
              {on ? <Ionicons name="checkmark-circle" size={24} color={C.emerald} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
