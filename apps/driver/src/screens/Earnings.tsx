import { Ionicons } from "@expo/vector-icons";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { crDateTime, plural, usd } from "../format";
import { C, R, S, SHADOW } from "../theme";
import type { Names, Trip } from "../types";
import { Empty, ScreenTitle } from "../ui";
import { tripTitle } from "./Trips";

/** Positive: we owe the driver. Negative: the driver owes us (they collected cash). */
function settlement(t: Trip): number {
  return Math.round((Number(t.driver_payout ?? 0) - (t.cash_to_collect == null ? 0 : Number(t.cash_to_collect))) * 100) / 100;
}
function balanceText(n: number): string {
  if (Math.abs(n) < 0.005) return "Nothing owed either way";
  return n > 0 ? "We owe you " + usd(n) : "You owe us " + usd(-n);
}

/** Completed trips, the payout on each, and the balance still to settle (weekly). */
export function Earnings({ trips, names, loading, onRefresh }: { trips: Trip[]; names: Names; loading: boolean; onRefresh: () => void }) {
  const done = trips.filter((t) => t.status === "completed" && t.driver_payout != null).reverse();
  const open = done.filter((t) => !t.driver_settled_at);
  const balance = open.reduce((n, t) => n + settlement(t), 0);
  const earned = done.reduce((n, t) => n + Number(t.driver_payout ?? 0), 0);
  const even = Math.abs(balance) < 0.005;
  return (
    <FlatList
      style={S.screen}
      contentContainerStyle={S.pad}
      data={done}
      keyExtractor={(t) => t.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.emerald} />}
      ListHeaderComponent={
        <View style={{ gap: 14 }}>
          <ScreenTitle title="Earnings" />
          <View style={[{ backgroundColor: C.emeraldDark, borderRadius: R.card, padding: 20, gap: 6 }, SHADOW]}>
            <Text style={[S.label, { color: "#6EE7B7" }]}>{even ? "To settle" : balance > 0 ? "We owe you" : "You owe us"}</Text>
            <Text style={{ color: balance < 0 ? "#FCD34D" : "#fff", fontSize: even ? 22 : 40, fontWeight: "800", letterSpacing: -1 }}>
              {even ? "Nothing owed either way" : usd(Math.abs(balance))}
            </Text>
            <Text style={{ color: "#A7F3D0", fontSize: 13 }}>{plural(open.length, "completed trip")} not settled yet. We settle weekly.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={[S.card, { flex: 1 }]}>
              <Text style={S.label}>Earned so far</Text>
              <Text style={[S.money, { color: C.text }]}>{usd(earned)}</Text>
            </View>
            <View style={[S.card, { flex: 1 }]}>
              <Text style={S.label}>Trips done</Text>
              <Text style={[S.money, { color: C.text }]}>{done.length}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 4 }}>
            <Ionicons name="information-circle-outline" size={16} color={C.muted} style={{ marginTop: 1 }} />
            <Text style={[S.muted, { flex: 1 }]}>
              Trips paid online: we pay you your payout. Cash trips: you collect the traveller&apos;s payment, keep your payout and pass on the rest.
            </Text>
          </View>
          {done.length ? <Text style={[S.label, { marginTop: 4 }]}>Completed trips</Text> : null}
        </View>
      }
      ListEmptyComponent={<Empty icon="wallet-outline" text="No completed trips yet. Your payouts show up here after each trip." />}
      renderItem={({ item }) => (
        <View style={[S.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: item.driver_settled_at ? C.emeraldTint : C.amberSoft,
            }}
          >
            <Ionicons name={item.driver_settled_at ? "checkmark" : "time-outline"} size={18} color={item.driver_settled_at ? C.emerald : C.amber} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }} numberOfLines={1}>
              {tripTitle(item, names)}
            </Text>
            <Text style={S.muted}>{crDateTime(item.scheduled_at)}</Text>
            <Text style={S.muted}>{item.driver_settled_at ? "Settled " + item.driver_settled_at.slice(0, 10) : balanceText(settlement(item))}</Text>
          </View>
          <Text style={{ fontWeight: "800", color: C.emerald, fontSize: 17 }}>{usd(item.driver_payout)}</Text>
        </View>
      )}
    />
  );
}
