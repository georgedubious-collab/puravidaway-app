import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api } from "../api";
import { usd } from "../format";
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
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    if (!tripToken) return;
    setBusy(true);
    setError("");
    const res = await api("/client/pay-test", { trip: tripToken });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "The payment didn't go through.");
    setPaid(true);
  }

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <View style={{ alignItems: "center", gap: 10, paddingTop: 20, paddingBottom: 6 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.emeraldSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={paid ? "checkmark-done" : "checkmark"} size={44} color={C.emerald} />
        </View>
        <Text style={[S.title, { textAlign: "center" }]}>{paid ? "Payment received" : "Request sent"}</Text>
        <Text style={[S.text, { textAlign: "center" }]}>{paid ? "Thank you! Your trip is paid." : "We got your request. Nothing has been charged."}</Text>
      </View>
      <Card>
        <Text style={S.label}>What happens next</Text>
        <IconLine icon="person-circle-outline" text="Our team confirms your driver and pickup time." />
        <IconLine icon="notifications-outline" text="You get a notification and an email." />
        <IconLine icon="map-outline" text="The trip is in My trips, with your driver, the car and a chat." />
      </Card>

      {payOnline && !paid ? (
        <Card>
          <View style={S.row}>
            <Text style={S.label}>To pay online</Text>
            <Text style={S.money}>{usd(totalCents / 100)}</Text>
          </View>
          {testCheckout && tripToken ? (
            <>
              <View style={{ backgroundColor: C.amberSoft, borderRadius: R.control, padding: 12, gap: 2 }}>
                <Text style={{ color: C.amber, fontWeight: "800" }}>Test checkout</Text>
                <Text style={{ color: C.amber, fontSize: 13, lineHeight: 18 }}>No card is needed and no money is charged. This marks the trip as paid for testing.</Text>
              </View>
              <Btn label={"Pay " + usd(totalCents / 100) + " (test)"} icon="lock-closed-outline" onPress={pay} busy={busy} color={C.emerald} />
              {error ? <Text style={S.error}>{error}</Text> : null}
            </>
          ) : (
            <IconLine icon="card-outline" text="We'll send you a secure payment link once your trip is confirmed." />
          )}
        </Card>
      ) : null}
      {!payOnline ? (
        <Card>
          <IconLine icon="cash-outline" text="You'll pay your driver in cash on the day. The amount is in My trips." />
        </Card>
      ) : null}
      <Btn label="Go to my trips" icon="map-outline" alt={payOnline && !paid && testCheckout && Boolean(tripToken)} onPress={onDone} />
    </ScrollView>
  );
}
