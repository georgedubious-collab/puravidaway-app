import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bagsFor, useBooking } from "../../booking";
import { Calendar, longDate } from "../../DatePicker";
import { pick } from "../../haptics";
import { useT } from "../../i18n";
import { useNav } from "../../nav";
import { TIMES, crDatePlus, time12, validDate } from "../../prices";
import { C, S, SP, T } from "../../theme";
import { Bar, BottomBar, Btn, Card, Divider, Page, Stepper, Text } from "../../ui";
import { BagNote, PickRow, QuoteProblem } from "./parts";

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

/** One bags counter: an icon, a label and − n +. */
function BagRow({ icon, label, value, onChange, less, more }: { icon: "briefcase-outline" | "bag-handle-outline"; label: string; value: number; onChange: (n: number) => void; less: string; more: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 62, paddingVertical: 8 }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={C.emerald} />
      </View>
      <Text style={[T.bodyStrong, { flex: 1 }]}>{label}</Text>
      <Stepper value={value} min={0} max={20} onChange={onChange} lessLabel={less} moreLabel={more} />
    </View>
  );
}

/** Bags: large suitcases and carry-ons, each starting at 1 per traveller; the driver sees both numbers. */
function Bags() {
  const { t } = useT();
  const { state, set } = useBooking();
  const bags = bagsFor(state);
  return (
    <View style={{ paddingBottom: 10 }}>
      <BagRow
        icon="briefcase-outline"
        label={t("Large suitcases", "Maletas grandes")}
        value={bags.large}
        onChange={(n) => set({ bags: n })}
        less={t("One large suitcase fewer", "Una maleta grande menos")}
        more={t("One more large suitcase", "Una maleta grande más")}
      />
      <BagRow
        icon="bag-handle-outline"
        label={t("Carry-ons", "Maletas de mano")}
        value={bags.carryOns}
        onChange={(n) => set({ carryOns: n })}
        less={t("One carry-on fewer", "Una maleta de mano menos")}
        more={t("One more carry-on", "Una maleta de mano más")}
      />
      <Text style={T.small}>
        {t("We start with 1 large suitcase and 1 carry-on per person. Change it if you bring more or less.", "Empezamos con 1 maleta grande y 1 de mano por persona. Cámbielo si lleva más o menos.")}
      </Text>
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

/**
 * Slide-up panel for a ride — when and who: the day, the pickup time, how many travel and their bags.
 * "Done" also records that the traveller has seen these, which the ride needs before it can be sent.
 */
export function BookWhen() {
  const { t } = useT();
  const nav = useNav();
  const { state, set } = useBooking();
  return (
    <Page
      footer={
        <BottomBar>
          <Btn
            label={t("Done", "Listo")}
            onPress={() => {
              set({ whenSet: true });
              nav.goBack();
            }}
          />
        </BottomBar>
      }
    >
      <Bar style="dark" />
      <DateCard />
      <Card>
        <View>
          <PickRow icon="time-outline" label={t("Pickup time · Costa Rica time", "Hora de recogida · hora de Costa Rica")} value={time12(state.time)} onPress={() => nav.navigate("TimePicker")} />
          <Divider />
          <Travellers />
          <Divider />
          <Bags />
        </View>
      </Card>
      <BagNote />
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
