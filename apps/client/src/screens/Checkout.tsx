import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api } from "../api";
import { usd } from "../format";
import { useT } from "../i18n";
import { C, R, S } from "../theme";
import { Btn, Card, IconLine } from "../ui";

/**
 * After a request is sent. Paying online uses a TEST checkout for now (Jorge,
 * 2026-11-09): no card is asked for and no money moves; the server records the
 * booking as paid with a "test" payment so the whole flow can be tried. It is
 * replaced by the real card checkout before launch, and the server refuses it
 * once the site is live.
 */
export function Checkout({
  tripToken,
  payOnline,
  totalCents,
  testCheckout,
  onDone,
}: {
  tripToken: string | null;
  payOnline: boolean;
  totalCents: number;
  testCheckout: boolean;
  onDone: () => void;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    if (!tripToken) return;
    setBusy(true);
    setError("");
    const res = await api("/client/pay-test", { trip: tripToken });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? t("The payment didn't go through.", "El pago no se completó."));
    setPaid(true);
  }

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={{ alignItems: "center", gap: 10, paddingTop: 20, paddingBottom: 6 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.emeraldSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={paid ? "checkmark-done" : "checkmark"} size={44} color={C.emerald} />
        </View>
        <Text style={[S.title, { textAlign: "center" }]}>{paid ? t("Payment received", "Pago recibido") : t("Request sent", "Solicitud enviada")}</Text>
        <Text style={[S.text, { textAlign: "center" }]}>{paid ? t("Thank you! Your trip is paid.", "¡Gracias! Su viaje está pagado.") : t("We got your request. Nothing has been charged.", "Recibimos su solicitud. No se ha cobrado nada.")}</Text>
      </View>
      <Card>
        <Text style={S.label}>{t("What happens next", "Qué sigue")}</Text>
        <IconLine icon="person-circle-outline" text={t("Our team confirms your driver and pickup time.", "Nuestro equipo confirma su conductor y la hora de recogida.")} />
        <IconLine icon="notifications-outline" text={t("You get a notification and an email.", "Recibirá una notificación y un correo electrónico.")} />
        <IconLine icon="map-outline" text={t("The trip is in My trips, with your driver, the car and a chat.", "El viaje aparece en Mis viajes, con su conductor, el vehículo y un chat.")} />
      </Card>

      {payOnline && !paid ? (
        <Card>
          <View style={S.row}>
            <Text style={S.label}>{t("To pay online", "Por pagar en línea")}</Text>
            <Text style={S.money}>{usd(totalCents / 100)}</Text>
          </View>
          {testCheckout && tripToken ? (
            <>
              <View style={{ backgroundColor: C.amberSoft, borderRadius: R.control, padding: 12, gap: 2 }}>
                <Text style={{ color: C.amber, fontWeight: "800" }}>{t("Test checkout", "Pago de prueba")}</Text>
                <Text style={{ color: C.amber, fontSize: 13, lineHeight: 18 }}>
                  {t("No card is needed and no money is charged. This marks the trip as paid for testing.", "No se necesita tarjeta y no se cobra dinero. Esto marca el viaje como pagado para hacer pruebas.")}
                </Text>
              </View>
              <Btn label={t("Pay " + usd(totalCents / 100) + " (test)", "Pagar " + usd(totalCents / 100) + " (prueba)")} icon="lock-closed-outline" onPress={pay} busy={busy} color={C.emerald} />
              {error ? <Text style={S.error}>{error}</Text> : null}
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
      <Btn label={t("Go to my trips", "Ir a Mis viajes")} icon="map-outline" alt={payOnline && !paid && testCheckout && Boolean(tripToken)} onPress={onDone} />
    </ScrollView>
  );
}
