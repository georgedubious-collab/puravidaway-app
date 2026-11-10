import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useBooking } from "../../booking";
import { pick } from "../../haptics";
import { useT } from "../../i18n";
import { photoFor } from "../../images";
import { useNav } from "../../nav";
import { Photo } from "../../Photo";
import { C, R, SHADOW } from "../../theme";
import { Bar, Card, Divider, IconLine, LinkBtn, Page } from "../../ui";
import { FromBar, PickRow, QuoteFacts, QuoteProblem, StepIntro } from "./parts";

/** Step 1 of 5 — Where: pickup and drop-off. Each opens the search panel. */
export function BookWhere() {
  const { t } = useT();
  const nav = useNav();
  const { state, set, quote } = useBooking();
  const { from, to } = state;

  return (
    <Page footer={<FromBar canNext={Boolean(quote && quote.vehicles.length)} onNext={() => nav.navigate("BookWhen")} />}>
      <Bar style="dark" />
      <StepIntro step={1} title={t("Where to?", "¿A dónde va?")} subtitle={t("Any airport, town, hotel or address in Costa Rica.", "Cualquier aeropuerto, pueblo, hotel o dirección en Costa Rica.")} />
      <Card>
        <View>
          <PickRow icon="radio-button-on-outline" label={t("Pickup", "Recogida")} value={from?.label} placeholder={t("Choose your pickup", "Elija su punto de recogida")} onPress={() => nav.navigate("PlaceSearch", { field: "from" })} />
          <Divider />
          <PickRow icon="location" label={t("Drop-off", "Destino")} value={to?.label} placeholder={t("Choose your drop-off", "Elija su destino")} onPress={() => nav.navigate("PlaceSearch", { field: "to" })} />
          {from && to ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Swap pickup and drop-off", "Intercambiar recogida y destino")}
              hitSlop={6}
              onPress={() => {
                pick();
                set({ from: to, to: from, stopIds: [] });
              }}
              style={({ pressed }) => [
                { position: "absolute", right: 28, top: "50%", marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 },
                SHADOW,
              ]}
            >
              <Ionicons name="swap-vertical" size={20} color={C.text} />
            </Pressable>
          ) : null}
        </View>
      </Card>
      <QuoteProblem />
      {to ? (
        <View style={{ gap: 12 }}>
          <Photo name={photoFor(to.label)} style={{ height: 150, borderRadius: R.card }} label={to.label} />
          <QuoteFacts />
        </View>
      ) : (
        <IconLine icon="information-circle-outline" text={t("Choose your drop-off to see the price. It's a fixed price for the whole car, not per person.", "Elija su destino para ver el precio. Es un precio fijo por todo el vehículo, no por persona.")} />
      )}
      <View style={{ alignItems: "flex-start" }}>
        <LinkBtn
          label={t("Looking for a day tour instead?", "¿Busca más bien un tour de un día?")}
          icon="trail-sign-outline"
          onPress={() => {
            set({ kind: "tour" });
            nav.navigate("Tours");
          }}
        />
      </View>
    </Page>
  );
}
