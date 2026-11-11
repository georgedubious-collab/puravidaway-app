import { Ionicons } from "@expo/vector-icons";
import { Pressable, TextInput, View } from "react-native";
import { bagsFor, cents, luggageCapacity, useBooking } from "../../booking";
import { pick } from "../../haptics";
import { useT } from "../../i18n";
import { photoForVehicle } from "../../images";
import { useNav } from "../../nav";
import { Photo } from "../../Photo";
import { C, R, S, SP, T, fontFor } from "../../theme";
import { Badge, Bar, Card, Page, Segments, Skeleton, Text } from "../../ui";
import { PriceBar, QuoteFacts, QuoteProblem, StepIntro } from "./parts";

/** Step 3 of 5 — Your ride: the fixed price or an offer for drivers to bid on, and the vehicle. */
export function BookRide() {
  const { t } = useT();
  const nav = useNav();
  const { state, set, quote, quoteBusy, vehicle, minOffer, offerValid, offerLow, itemCents } = useBooking();
  const { mode } = state;
  const canNext = Boolean(vehicle) && (mode === "fixed" || offerValid);
  // A gentle hint, never a block: more large suitcases than the chosen vehicle lists.
  const fits = luggageCapacity(vehicle?.luggage);
  const largeBags = bagsFor(state).large;

  function setMode(next: "fixed" | "bid") {
    // Start the offer at the fixed price for the chosen vehicle.
    set(next === "bid" && !state.offer && vehicle ? { mode: next, offer: String(Math.round(vehicle.totalCents / 100)) } : { mode: next });
  }

  return (
    <Page
      footer={
        <PriceBar
          label={mode === "bid" ? t("Your offer", "Su oferta") : vehicle ? "Total · " + vehicle.name : "Total"}
          amount={!quote && quoteBusy ? null : !vehicle || (mode === "bid" && !offerValid) ? "—" : cents(itemCents)}
          note={t("For the whole car, taxes included", "Por todo el vehículo, impuestos incluidos")}
          action={t("Continue", "Continuar")}
          onPress={() => nav.navigate("BookExtras")}
          disabled={!canNext}
          busy={Boolean(quote) && quoteBusy}
        />
      }
    >
      <Bar style="dark" />
      <StepIntro step={3} title={t("Choose your ride", "Elija su vehículo")} subtitle={t("One price for the whole car, not per person.", "Un solo precio por todo el vehículo, no por persona.")} />
      <QuoteFacts />
      <QuoteProblem />
      {quote?.vehicles.length ? (
        <Segments
          value={mode}
          onChange={setMode}
          options={[
            { id: "fixed", label: t("Fixed price", "Precio fijo"), icon: "pricetag-outline" },
            { id: "bid", label: t("Driver bids", "Ofertas de conductores"), icon: "hammer-outline" },
          ]}
        />
      ) : null}
      {mode === "bid" && vehicle ? (
        <Card tone="amber">
          <Text style={T.h2}>{t("Name your price", "Proponga su precio")}</Text>
          <Text style={T.body}>
            {t(
              "Hand-picked local drivers see your offer and bid on it. Our team confirms the best match and emails you the driver's profile and car. Nothing is charged until then.",
              "Conductores locales seleccionados ven su oferta y ofertan. Nuestro equipo confirma la mejor opción y le envía por correo el perfil del conductor y el vehículo. No se cobra nada hasta entonces.",
            )}
          </Text>
          <Text style={T.small}>{t("Fixed price for the " + vehicle.name + ": ", "Precio fijo del " + vehicle.name + ": ") + cents(vehicle.totalCents)}</Text>
          <View style={[S.input, { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }]}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: C.text }}>$</Text>
            <TextInput
              accessibilityLabel={t("Your offer in US dollars", "Su oferta en dólares")}
              value={state.offer}
              onChangeText={(v) => set({ offer: v.replace(/[^0-9]/g, "").slice(0, 5) })}
              keyboardType="number-pad"
              maxFontSizeMultiplier={1.2}
              style={{ flex: 1, fontSize: 26, color: C.text, padding: 0, fontFamily: fontFor("800") }}
            />
            <Text style={T.small}>USD</Text>
          </View>
          {!offerValid ? <Text style={S.error}>{t("Enter an offer of at least ", "Ingrese una oferta de al menos ") + cents(minOffer) + "."}</Text> : null}
          {offerLow ? <Text style={{ color: C.amber, fontWeight: "700", fontSize: 15, lineHeight: 21 }}>{t("That's well below the fixed price, so drivers may not accept it.", "Está muy por debajo del precio fijo, así que es posible que los conductores no la acepten.")}</Text> : null}
        </Card>
      ) : null}

      {!quote && quoteBusy ? (
        <View style={{ gap: SP.md }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[S.card, { flexDirection: "row", padding: SP.md, gap: SP.md, alignItems: "center" }]}>
              <Skeleton width={112} height={92} radius={14} />
              <View style={{ flex: 1, gap: 10 }}>
                <Skeleton height={18} width="80%" />
                <Skeleton height={14} width="60%" />
                <Skeleton height={20} width="40%" />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {quote?.vehicles.length ? <Text style={T.label}>{mode === "bid" ? t("Vehicle you'd like", "Vehículo que desea") : t("Choose your vehicle", "Elija su vehículo")}</Text> : null}
      <View accessibilityRole="radiogroup" style={{ gap: SP.md }}>
        {quote?.vehicles.map((v) => {
          const on = v.id === vehicle?.id;
          return (
            <Pressable
              key={v.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={v.name + ", " + cents(v.totalCents) + t(" per car", " por vehículo")}
              onPress={() => {
                if (!on) pick();
                set({ vehicleId: v.id });
              }}
              style={({ pressed }) => [S.card, { padding: SP.md - (on ? 2 : 0), gap: SP.md, borderWidth: on ? 2 : 0, borderColor: C.emerald, opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={{ flexDirection: "row", gap: SP.md }}>
                <Photo name={photoForVehicle(v.id, v.name)} style={{ width: 112, height: 88, borderRadius: R.control }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Text style={[T.h3, { flex: 1 }]}>{v.name}</Text>
                    <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={24} color={on ? C.emerald : C.faint} />
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 2 }}>
                    <Fact icon="people-outline" text={t("Up to ", "Hasta ") + v.maxPax} />
                    <Fact icon="briefcase-outline" text={v.luggage} />
                  </View>
                  {v.allowsStops ? null : <Text style={T.caption}>{t("Direct ride, no stops", "Traslado directo, sin paradas")}</Text>}
                  <Badge text={v.badge} tone="gold" />
                  <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 8, marginTop: 2 }}>
                    <Text style={[T.money, mode === "bid" ? { color: C.muted, fontSize: 20 } : null]}>{cents(v.totalCents)}</Text>
                    <Text style={T.caption}>{t("per car", "por vehículo")}</Text>
                  </View>
                  {v.perPersonCents ? <Text style={T.caption}>{t("from " + cents(v.perPersonCents) + "/person", "desde " + cents(v.perPersonCents) + "/persona")}</Text> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      {fits != null && largeBags > fits ? (
        <View style={{ backgroundColor: C.amberSoft, borderRadius: R.control, padding: SP.md }}>
          <Text style={[T.small, { color: C.amber, fontWeight: "700" }]}>
            {t(
              "This vehicle lists " + fits + (fits === 1 ? " suitcase" : " suitcases") + " and you have " + largeBags + " large. Consider a larger vehicle or ask our team.",
              "Este vehículo indica " + fits + (fits === 1 ? " maleta" : " maletas") + " y usted lleva " + largeBags + " grandes. Considere un vehículo más grande o consulte a nuestro equipo.",
            )}
          </Text>
        </View>
      ) : null}
    </Page>
  );
}

function Fact({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Ionicons name={icon} size={15} color={C.muted} />
      <Text style={T.small}>{text}</Text>
    </View>
  );
}
