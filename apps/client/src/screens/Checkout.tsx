import { Ionicons } from "@expo/vector-icons";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api";
import { useDemo } from "../demo";
import { usd } from "../format";
import { success } from "../haptics";
import { useT } from "../i18n";
import { useNav, type RootParams } from "../nav";
import { useSession } from "../session";
import { C, R, S, SP, T } from "../theme";
import { Bar, Btn, Card, IconLine, Text } from "../ui";

const native = Platform.OS !== "web";

/** The green tick that pops in, with a ring that ripples out once. */
function SuccessMark({ done }: { done: boolean }) {
  const pop = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pop.setValue(0);
    ring.setValue(0);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: native }),
      Animated.timing(ring, { toValue: 1, duration: 900, delay: 150, easing: Easing.out(Easing.quad), useNativeDriver: native }),
    ]).start();
  }, [done, pop, ring]);
  return (
    <View style={{ width: 132, height: 132, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: 96,
          height: 96,
          borderRadius: 48,
          borderWidth: 3,
          borderColor: C.emeraldBright,
          opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
        }}
      />
      <Animated.View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.emerald, alignItems: "center", justifyContent: "center", opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
        <Ionicons name={done ? "checkmark-done" : "checkmark"} size={52} color="#fff" />
      </Animated.View>
    </View>
  );
}

/**
 * After a request is sent. Paying online uses a TEST checkout for now (Jorge,
 * 2026-11-09): no card is asked for and no money moves; the server records the
 * booking as paid with a "test" payment so the whole flow can be tried. It is
 * replaced by the real card checkout before launch, and the server refuses it
 * once the site is live.
 */
export function Checkout() {
  const { t } = useT();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const demo = useDemo();
  const { reload } = useSession();
  const { tripToken, payOnline, totalCents, testCheckout } = useRoute<RouteProp<RootParams, "Sent">>().params;
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(Boolean(demo?.paid));
  const [error, setError] = useState("");

  async function pay() {
    if (!tripToken) return;
    setBusy(true);
    setError("");
    const res = await api("/client/pay-test", { trip: tripToken });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? t("The payment didn't go through.", "El pago no se completó."));
    success();
    setPaid(true);
  }

  function done() {
    void reload();
    nav.reset({ index: 0, routes: [{ name: "Tabs", params: { screen: "Trips" } }] });
  }

  const canPayNow = payOnline && !paid && testCheckout && Boolean(tripToken);
  return (
    <ScrollView style={S.screen} contentContainerStyle={{ paddingTop: insets.top + SP.xl, paddingHorizontal: SP.page, paddingBottom: insets.bottom + SP.xl, gap: SP.lg }} showsVerticalScrollIndicator={false}>
      <Bar style="dark" />
      <View style={{ alignItems: "center", gap: 8, paddingBottom: 4 }}>
        <SuccessMark done={paid} />
        <Text accessibilityRole="header" style={[T.display, { textAlign: "center" }]}>
          {paid ? t("Payment received", "Pago recibido") : t("Request sent", "Solicitud enviada")}
        </Text>
        <Text style={[T.body, { textAlign: "center" }]}>{paid ? t("Thank you! Your trip is paid.", "¡Gracias! Su viaje está pagado.") : t("We got your request. Nothing has been charged.", "Recibimos su solicitud. No se ha cobrado nada.")}</Text>
      </View>
      <Card>
        <Text style={T.label}>{t("What happens next", "Qué sigue")}</Text>
        <IconLine icon="person-circle-outline" color={C.emerald} text={t("Our team confirms your driver and pickup time.", "Nuestro equipo confirma su conductor y la hora de recogida.")} />
        <IconLine icon="notifications-outline" color={C.emerald} text={t("You get a notification and an email.", "Recibirá una notificación y un correo electrónico.")} />
        <IconLine icon="map-outline" color={C.emerald} text={t("The trip is in My trips, with your driver, the car and a chat.", "El viaje aparece en Mis viajes, con su conductor, el vehículo y un chat.")} />
      </Card>

      {payOnline && !paid ? (
        <Card>
          <View style={S.row}>
            <Text style={T.bodyStrong}>{t("To pay online", "Por pagar en línea")}</Text>
            <Text style={T.money}>{usd(totalCents / 100)}</Text>
          </View>
          {testCheckout && tripToken ? (
            <>
              <View style={{ backgroundColor: C.amberSoft, borderRadius: R.control, padding: 14, gap: 2 }}>
                <Text style={{ color: C.amber, fontWeight: "700", fontSize: 15 }}>{t("Test checkout", "Pago de prueba")}</Text>
                <Text style={{ color: C.amber, fontSize: 15, lineHeight: 21 }}>
                  {t("No card is needed and no money is charged. This marks the trip as paid for testing.", "No se necesita tarjeta y no se cobra dinero. Esto marca el viaje como pagado para hacer pruebas.")}
                </Text>
              </View>
              <Btn label={t("Pay " + usd(totalCents / 100) + " (test)", "Pagar " + usd(totalCents / 100) + " (prueba)")} icon="lock-closed-outline" onPress={() => void pay()} busy={busy} />
              {error ? (
                <Text accessibilityRole="alert" style={S.error}>
                  {error}
                </Text>
              ) : null}
            </>
          ) : (
            <IconLine icon="card-outline" text={t("We'll send you a secure payment link once your trip is confirmed.", "Le enviaremos un enlace de pago seguro cuando su viaje esté confirmado.")} />
          )}
        </Card>
      ) : null}
      {!payOnline ? (
        <Card>
          <IconLine icon="cash-outline" text={t("You'll pay your driver in cash on the day. The amount is in My trips.", "Pagará a su conductor en efectivo el día del viaje. El monto está en Mis viajes.")} />
        </Card>
      ) : null}
      <Btn label={t("Go to my trips", "Ir a Mis viajes")} icon="map-outline" alt={canPayNow} onPress={done} />
    </ScrollView>
  );
}
