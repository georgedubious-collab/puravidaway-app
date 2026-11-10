import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api } from "../api";
import { usd } from "../format";
import { C, S } from "../theme";
import { Btn, Card } from "../ui";

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
      <Text style={S.h1}>{paid ? "Payment received" : "Request sent"}</Text>
      <Card>
        <Text style={{ color: C.emerald, fontWeight: "800", fontSize: 16 }}>
          {paid ? "Thank you! Your trip is paid." : "We got your request. Nothing has been charged."}
        </Text>
        <Text style={S.text}>Our team is confirming your driver and pickup time. You&apos;ll get a notification and an email, and the trip is in My trips.</Text>
      </Card>

      {payOnline && !paid ? (
        <Card>
          <View style={S.row}>
            <Text style={S.h2}>To pay online</Text>
            <Text style={S.money}>{usd(totalCents / 100)}</Text>
          </View>
          {testCheckout && tripToken ? (
            <>
              <View style={{ backgroundColor: C.amberSoft, borderRadius: 10, padding: 10 }}>
                <Text style={{ color: C.amber, fontWeight: "800" }}>Test checkout</Text>
                <Text style={{ color: C.amber }}>No card is needed and no money is charged. This marks the trip as paid for testing.</Text>
              </View>
              <Btn label={"Pay " + usd(totalCents / 100) + " (test)"} onPress={pay} busy={busy} color={C.emerald} />
              {error ? <Text style={S.error}>{error}</Text> : null}
            </>
          ) : (
            <Text style={S.muted}>We&apos;ll send you a secure payment link once your trip is confirmed.</Text>
          )}
        </Card>
      ) : null}
      {!payOnline ? (
        <Card>
          <Text style={S.text}>You&apos;ll pay your driver in cash on the day. The amount is in My trips.</Text>
        </Card>
      ) : null}
      <Btn label="Go to my trips" onPress={onDone} />
    </ScrollView>
  );
}
